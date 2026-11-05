import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { coarseLocationFromCoordinates, type CoarseLocation } from '@aurorasense/shared/ground-reference';

export type ForegroundLocationState = { status: 'idle' | 'locating' | 'ready' | 'denied' | 'unavailable' | 'stale'; location?: CoarseLocation; observedAtUtc?: string; message: string };
let state: ForegroundLocationState = { status: 'idle', message: 'Finding your region…' };
const listeners = new Set<() => void>();
let pending: Promise<void> | null = null;
let cancelAcquisition: (() => void) | null = null;
let lifecycle: ReturnType<typeof AppState.addEventListener> | null = null;
let expiry: ReturnType<typeof setTimeout> | null = null;
function publish(next: ForegroundLocationState) { state = next; listeners.forEach(listener => listener()); }

/** One foreground fix shared by all panels. Exact coordinates never enter state, storage or requests. */
export function refreshForegroundLocation(): Promise<void> {
  if (pending) return pending;
  if (AppState.currentState !== 'active') return Promise.resolve();
  pending = (async () => {
    publish({ status: 'locating', message: 'Finding your region…' });
    let finished = false;
    let subscription: Location.LocationSubscription | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let release: (() => void) | undefined;
    const finish = (next?: ForegroundLocationState) => {
      if (finished) return; finished = true;
      subscription?.remove(); if (timeout) clearTimeout(timeout);
      if (next) publish(next);
      release?.();
    };
    cancelAcquisition = () => finish({ status: 'idle', message: 'Location paused while the app is inactive.' });
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (finished || AppState.currentState !== 'active') return;
      if (!permission.granted) { finish({ status: 'denied', message: 'Location access is off. Global space-weather context remains available.' }); return; }
      await new Promise<void>((resolve) => {
        release = resolve;
        timeout = setTimeout(() => finish({ status: 'unavailable', message: 'Location fix delayed. Showing global context while you retry.' }), 15_000);
        void Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, mayShowUserSettingsDialog: false, timeInterval: 1000, distanceInterval: 0 }, fix => {
          if (finished || AppState.currentState !== 'active') return;
          const age = Date.now() - fix.timestamp;
          const coarse = fix.coords.accuracy === null ? undefined : coarseLocationFromCoordinates(fix.coords.latitude, fix.coords.longitude, fix.coords.accuracy);
          if (!coarse || !Number.isFinite(age) || age < -60_000 || age > 120_000) return;
          if (expiry) clearTimeout(expiry);
          finish({ status: 'ready', location: coarse, observedAtUtc: new Date(fix.timestamp).toISOString(), message: 'Region detected · precise location stays on this device.' });
          expiry = setTimeout(() => publish({ status: 'stale', message: 'Refresh location for current local viewing context.' }), 5 * 60_000);
        }, () => finish({ status: 'unavailable', message: 'Location temporarily unavailable. Global context remains available.' })).then(watch => { subscription = watch; if (finished) watch.remove(); }).catch(() => finish({ status: 'unavailable', message: 'Location temporarily unavailable. Global context remains available.' }));
      });
    } catch { finish({ status: 'unavailable', message: 'Location temporarily unavailable. Global context remains available.' }); }
    finally { subscription?.remove(); if (timeout) clearTimeout(timeout); cancelAcquisition = null; }
  })().finally(() => { pending = null; if (state.status === 'idle' && AppState.currentState === 'active' && listeners.size) setTimeout(() => { void refreshForegroundLocation(); }, 0); });
  return pending;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!lifecycle) lifecycle = AppState.addEventListener('change', next => {
    if (next !== 'active') { cancelAcquisition?.(); if (expiry) clearTimeout(expiry); publish({ status: 'idle', message: 'Location paused while the app is inactive.' }); }
    else if (state.status === 'idle' || state.status === 'stale') void refreshForegroundLocation();
  });
  return () => { listeners.delete(listener); if (!listeners.size) { lifecycle?.remove(); lifecycle = null; cancelAcquisition?.(); } };
}
const inactiveSubscription = () => () => undefined;

export function useForegroundLocation(enabled = true) {
  const current = useSyncExternalStore(enabled ? subscribe : inactiveSubscription, () => state, () => state);
  useEffect(() => { if (enabled && (state.status === 'idle' || state.status === 'stale')) void refreshForegroundLocation(); }, [enabled, current.status]);
  return { ...current, refresh: refreshForegroundLocation };
}

/** A current fix cannot establish where an older exported session was recorded. */
export function locationForCurrentCapture(startedAtUtc: string | undefined, fix: ForegroundLocationState): CoarseLocation | undefined {
  if (!startedAtUtc || fix.status !== 'ready' || !fix.location || !fix.observedAtUtc) return undefined;
  const sinceFix = Date.parse(startedAtUtc) - Date.parse(fix.observedAtUtc);
  return sinceFix >= 0 && sinceFix <= 5 * 60_000 ? fix.location : undefined;
}

const captureLocations = new Map<string, { location: CoarseLocation; capturedAt: number }>();
export function rememberCaptureLocation(sessionId: string) {
  if (state.status !== 'ready' || !state.location || !state.observedAtUtc || Date.now() - Date.parse(state.observedAtUtc) > 5 * 60_000) return;
  captureLocations.set(sessionId, { location: { ...state.location }, capturedAt: Date.now() });
  if (captureLocations.size > 5) captureLocations.delete(captureLocations.keys().next().value!);
}
export function captureLocation(sessionId?: string): CoarseLocation | undefined { const capture = sessionId ? captureLocations.get(sessionId) : undefined; if (capture && Date.now() - capture.capturedAt < 30 * 60_000) return capture.location; if (sessionId) captureLocations.delete(sessionId); return undefined; }
export function forgetCaptureLocation(sessionId: string) { captureLocations.delete(sessionId); }
export function clearCaptureLocations() { captureLocations.clear(); }
