import { describe, expect, it } from 'vitest';
import { coarseBrowserPosition } from './browser-location';
const now = Date.parse('2026-11-04T15:00:00Z');
const make = (latitude = 28.12345, longitude = -82.12345, accuracy = 50, timestamp = now) => ({ coords: { latitude, longitude, accuracy } as GeolocationCoordinates, timestamp });
describe('browser location privacy and validity', () => {
  it('keeps only coarse coordinates, time and uncertainty', () => {
    const result = coarseBrowserPosition(make(), now)!;
    expect(result.location.latitude).toBe(28); expect(result.location.longitude).toBe(-82);
    expect(result.uncertaintyKm).toBe(40.05);
    expect(JSON.stringify(result)).not.toContain('12345');
  });
  it('rejects stale, future, invalid and excessively uncertain fixes', () => {
    for (const position of [make(91), make(28, 181), make(28, -82, -1), make(28, -82, 50001), make(28, -82, NaN), make(28, -82, 10, now - 300001), make(28, -82, 10, now + 60001)]) expect(coarseBrowserPosition(position, now)).toBeNull();
  });
  it('accepts the equator and international date line without a default region', () => {
    expect(coarseBrowserPosition(make(0, 180), now)?.location.latitude).toBe(0);
    expect(coarseBrowserPosition(make(-43.1, 147.1), now)?.location.latitude).toBe(-43);
  });
});
