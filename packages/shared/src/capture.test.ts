import { describe, expect, it, vi } from 'vitest';
import { CaptureGate } from './capture';

describe('foreground consent lifecycle', () => {
  it('never subscribes without adult and recording consent', async () => {
    const gate = new CaptureGate(vi.fn()); const subscribe = vi.fn();
    await expect(gate.start(async () => {}, subscribe)).rejects.toThrow();
    gate.setConsent(true, false);
    await expect(gate.start(async () => {}, subscribe)).rejects.toThrow();
    expect(subscribe).not.toHaveBeenCalled();
  });
  it('cancels a pending permission response if backgrounded or consent withdrawn', async () => {
    const gate = new CaptureGate(vi.fn()); const subscribe = vi.fn(); gate.setConsent(true, true);
    let finish!: () => void;
    const start = gate.start(() => new Promise<void>((resolve) => { finish = resolve; }), subscribe);
    gate.setForeground(false); gate.setForeground(true); finish();
    expect(await start).toBe(false); expect(subscribe).not.toHaveBeenCalled();
  });
  it('removes all listeners on stop, background, revocation and disposal, without auto-resume', async () => {
    for (const action of ['stop', 'background', 'revoke', 'dispose']) {
      const onStop = vi.fn(); const a = vi.fn(); const b = vi.fn();
      const gate = new CaptureGate(onStop); gate.setConsent(true, true);
      await gate.start(async () => {}, (register) => { register({ remove: a }); register({ remove: b }); });
      expect(gate.recording).toBe(true);
      if (action === 'stop') gate.stop();
      if (action === 'background') gate.setForeground(false);
      if (action === 'revoke') gate.setConsent(true, false);
      if (action === 'dispose') gate.dispose();
      expect(a).toHaveBeenCalledTimes(1); expect(b).toHaveBeenCalledTimes(1); expect(onStop).toHaveBeenCalledTimes(1);
      gate.setForeground(true); gate.setConsent(true, true); expect(gate.recording).toBe(false);
    }
  });
  it('cleans partially registered listeners if a second sensor fails', async () => {
    const gate = new CaptureGate(vi.fn()); const remove = vi.fn(); gate.setConsent(true, true);
    await expect(gate.start(async () => {}, (register) => { register({ remove }); throw new Error('second sensor'); })).rejects.toThrow('second sensor');
    expect(remove).toHaveBeenCalledOnce(); expect(gate.recording).toBe(false);
  });
});
