/** Explicit, bounded public-source connectivity check. Never reads phone files. */
import { acquireGroundReference, isGroundStation } from '../apps/web/lib/ground-reference';

const stations = process.argv.slice(2);
if (!stations.length) stations.push('BOU');
if (stations.length > 5 || stations.some(station => !isGroundStation(station))) throw new Error('Choose up to five allowed stations: BOU FRD BSL CMO TUC.');
for (const station of stations) {
  if (!isGroundStation(station)) continue;
  try {
    const reference = await acquireGroundReference(station);
    console.log(JSON.stringify({ station: reference.stationId, source: reference.sourceUrl, retrievedAtUtc: reference.retrievedAtUtc, generatedAtUtc: reference.generatedAtUtc, latestObservedAtUtc: reference.latestObservedAtUtc, freshness: reference.freshness, samples: reference.samples.length, validSamples: reference.samples.filter(sample => sample.value !== null).length, latestScalarNt: reference.samples.findLast(sample => sample.value !== null)?.value ?? null, sha256: reference.sha256 }));
  } catch (error) {
    console.error(`${station}: ${error instanceof Error ? error.message : 'Source validation failed'}`);
    process.exitCode = 1;
  }
}
