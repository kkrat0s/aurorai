export type IconName = 'storm'|'map'|'sensor'|'spark'|'arrow'|'clock'|'reset'|'book'|'close'|'external'|'check';
const paths:Record<IconName,string> = {
  storm:'M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  map:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18',
  sensor:'M3 12h4l2-7 5 14 2-7h5',
  spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z',
  arrow:'M5 12h14m-6-6 6 6-6 6',
  clock:'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  reset:'M3 11a9 9 0 1 1 3 8M3 4v7h7',
  book:'M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1m0-15c3-2 6-2 9-1v15c-3-1-6-1-9 1V5',
  close:'m6 6 12 12M6 18 18 6',
  external:'M14 3h7v7m0-7-11 11m-1-9H3v16h16v-6',
  check:'m5 12 4 4L19 6',
};
export default function Icon({name,size=20}:{name:IconName;size?:number}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;}
