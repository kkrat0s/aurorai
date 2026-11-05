import { NativeModules, Platform } from 'react-native';
// Explicit deployment URL takes precedence. Local development uses Metro's host,
// not the physical phone's loopback address. No credentials belong in this value.
export function apiBaseUrl(): string {
  const configured=process.env.EXPO_PUBLIC_API_URL?.trim();
  if(configured){try{const url=new URL(configured); if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return ''; if(Platform.OS!=='web'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))return ''; return configured.replace(/\/$/,'');}catch{return '';}}
  const scriptURL=NativeModules.SourceCode?.scriptURL as string|undefined;
  if(__DEV__ && scriptURL){try{const host=new URL(scriptURL).hostname; if(host.endsWith('.exp.direct')||host.endsWith('.expo.dev')||host.endsWith('.ngrok.io')||['localhost','127.0.0.1','[::1]'].includes(host))return ''; return `http://${host}:3000`;}catch{/* expose absence below */}}
  return Platform.OS==='web' && typeof window!=='undefined' ? window.location.origin : '';
}
