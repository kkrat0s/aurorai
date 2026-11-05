'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { coarseBrowserPosition, type BrowserLocation } from '../lib/browser-location';

type Status = 'idle' | 'locating' | 'ready' | 'denied' | 'unavailable';
export function useBrowserLocation(active: boolean) {
  const [position, setPosition] = useState<BrowserLocation | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const attempted = useRef(false), generation = useRef(0);
  const refresh = useCallback(() => {
    attempted.current = true;
    const request = ++generation.current;
    setPosition(null);
    if (!navigator.geolocation || !window.isSecureContext) { setStatus('unavailable'); return; }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(result => {
      if (request !== generation.current) return;
      const coarse = coarseBrowserPosition(result);
      setPosition(coarse); setStatus(coarse ? 'ready' : 'unavailable');
    }, error => {
      if (request !== generation.current) return;
      setPosition(null); setStatus(error.code === 1 ? 'denied' : 'unavailable');
    }, { enableHighAccuracy: false, maximumAge: 60_000, timeout: 12_000 });
  }, []);
  useEffect(() => { if (active && !attempted.current) refresh(); }, [active, refresh]);
  useEffect(() => {
    if (!active || !position) return;
    const check = () => { if (document.visibilityState === 'visible' && Date.now() - Date.parse(position.observedAtUtc) > 5 * 60_000) refresh(); };
    check();
    const timer = setInterval(check, 30_000); document.addEventListener('visibilitychange', check);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', check); };
  }, [active, position, refresh]);
  useEffect(() => {
    let disposed = false; let permission: PermissionStatus | undefined;
    const changed = () => { if (permission?.state === 'denied') { generation.current++; setPosition(null); setStatus('denied'); } };
    void navigator.permissions?.query({ name: 'geolocation' }).then(value => {
      if (disposed) return; permission = value; value.addEventListener('change', changed); changed();
    }).catch(() => {});
    return () => { disposed = true; generation.current++; attempted.current = false; permission?.removeEventListener('change', changed); };
  }, []);
  return { position, status, refresh };
}
