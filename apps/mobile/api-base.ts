import { NativeModules, Platform } from 'react-native';
// Explicit deployment URL takes precedence. Local development uses Metro's host,
// not the physical phone's loopback address. No credentials belong in this value.
export function apiBaseUrl(): string {
  const configured=process.env.EXPO_PUBLIC_API_URL?.trim();
  if(configured)return configured.replace(/\/$/,'');
  const scriptURL=NativeModules.SourceCode?.scriptURL as string|undefined;
  if(__DEV__ && scriptURL){try{return `http://${new URL(scriptURL).hostname}:3000`;}catch{/* expose absence below */}}
  return Platform.OS==='web' && typeof window!=='undefined' ? window.location.origin : '';
}
