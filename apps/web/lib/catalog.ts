import { z } from 'zod';

const utc = z.string().datetime({ offset: true });
const numberOrNull = z.number().finite().nullable();
export const cmeSchema = z.object({ id:z.string(),eventId:z.string(),method:z.string(),issuedAtUtc:utc,predictedArrivalUtc:utc,observedArrivalUtc:utc.nullable(),sourceId:z.string(),sourceUrl:z.string().url(),kind:z.literal('ISSUED_FORECAST') });
export const referenceSchema = z.object({stationId:z.string(),sourceId:z.string(),sourceUrl:z.string().url(),kind:z.literal('MEASURED_ARCHIVAL'),component:z.string(),frame:z.string(),unit:z.literal('nT'),cadenceSeconds:z.number().positive(),status:z.string(),availableAtUtc:utc.nullable(),retrievedAtUtc:utc,samples:z.array(z.object({observedAtUtc:utc,value:numberOrNull}))});
export const ovationSchema = z.object({sourceId:z.string(),sourceUrl:z.string().url(),kind:z.literal('ISSUED_FORECAST'),observedAtUtc:utc,validAtUtc:utc,retrievedAtUtc:utc,coordinates:z.array(z.tuple([z.number().finite(),z.number().min(-90).max(90),z.number().min(0).max(100)]))});
export const windSchema = z.object({sourceId:z.string(),sourceUrl:z.string().url(),retrievedAtUtc:utc,samples:z.array(z.object({observedAtUtc:utc,bzNt:numberOrNull,speedKmS:numberOrNull,densityCm3:numberOrNull}))});
export const catalogSchema = z.object({schemaVersion:z.literal(1),generatedAtUtc:utc,cmeForecasts:z.array(cmeSchema),referenceSeries:z.array(referenceSchema),latestNoaa:z.object({ovation:ovationSchema.nullable(),solarWind:windSchema.nullable()}),manifests:z.array(z.record(z.string(),z.unknown())),limitations:z.array(z.string())});
export type Catalog = z.infer<typeof catalogSchema>;
export type Cme = z.infer<typeof cmeSchema>;
export type ReferenceSeries = z.infer<typeof referenceSchema>;
export type Ovation = z.infer<typeof ovationSchema>;
export type Wind = z.infer<typeof windSchema>;
export type ClockMode = 'replay' | 'live';
export const REPLAY_START = '2024-05-08T18:00:00Z';
export const REPLAY_END = '2024-05-13T00:00:00Z';

export function visibleForecasts(records:Cme[], asOf:string):Cme[] {
  return records.filter(r => Date.parse(r.issuedAtUtc) <= Date.parse(asOf) && (!r.observedArrivalUtc || Date.parse(r.issuedAtUtc) < Date.parse(r.observedArrivalUtc)));
}
export function dataFreshness(time:string|null|undefined, now:string, maxAgeMinutes=30):'fresh'|'stale'|'missing'|'future' {
  if (!time || !Number.isFinite(Date.parse(time))) return 'missing';
  const elapsed = Date.parse(now)-Date.parse(time);
  return elapsed < -60_000 ? 'future' : elapsed > maxAgeMinutes*60_000 ? 'stale' : 'fresh';
}
export function formatUtc(time:string|null|undefined):string {
  if (!time || !Number.isFinite(Date.parse(time))) return 'Not available';
  return new Date(time).toISOString().replace('T',' ').replace(/:\d{2}\.\d{3}Z$/, ' UTC');
}
export function emptyCatalog(reason:string):Catalog {
  return {schemaVersion:1,generatedAtUtc:new Date().toISOString(),cmeForecasts:[],referenceSeries:[],latestNoaa:{ovation:null,solarWind:null},manifests:[],limitations:[reason]};
}
