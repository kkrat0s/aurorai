// Approximate geometric solar elevation. NOAA fractional-year equations;
// https://gml.noaa.gov/grad/solcalc/solareqns.PDF. No refraction/weather correction.
export function solarElevation(latitude:number,longitude:number,time:string):number {
  const date = new Date(time);
  if (![latitude,longitude,date.getTime()].every(Number.isFinite) || Math.abs(latitude)>90 || Math.abs(longitude)>180) throw new Error('Invalid location or time');
  const radians = Math.PI/180;
  const year = date.getUTCFullYear();
  const day = Math.floor((date.getTime()-Date.UTC(year,0,1))/86_400_000)+1;
  const hour = date.getUTCHours()+date.getUTCMinutes()/60+date.getUTCSeconds()/3600;
  const daysInYear = (Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86_400_000;
  const gamma = 2*Math.PI/daysInYear*(day-1+(hour-12)/24);
  const eq = 229.18*(0.000075+0.001868*Math.cos(gamma)-0.032077*Math.sin(gamma)-0.014615*Math.cos(2*gamma)-0.040849*Math.sin(2*gamma));
  const dec = 0.006918-0.399912*Math.cos(gamma)+0.070257*Math.sin(gamma)-0.006758*Math.cos(2*gamma)+0.000907*Math.sin(2*gamma)-0.002697*Math.cos(3*gamma)+0.00148*Math.sin(3*gamma);
  const angle = ((hour*60+eq+4*longitude)/4-180)*radians;
  const sin = Math.sin(latitude*radians)*Math.sin(dec)+Math.cos(latitude*radians)*Math.cos(dec)*Math.cos(angle);
  return Math.asin(Math.min(1,Math.max(-1,sin)))/radians;
}
export function darkness(elevation:number):string {
  return elevation >= 0 ? 'Daylight' : elevation > -6 ? 'Civil twilight' : elevation > -12 ? 'Nautical twilight' : elevation > -18 ? 'Astronomical twilight' : 'Dark sky';
}
export const LOCATIONS = [
  {name:'Boulder region',latitude:40,longitude:-105},
  {name:'Fairbanks region',latitude:65,longitude:-148},
  {name:'Tromsø region',latitude:70,longitude:19},
  {name:'Hobart region',latitude:-43,longitude:147},
];
