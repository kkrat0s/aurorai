/** Foreground/consent lifecycle independent of native APIs so races are testable. */
export class CaptureGate {
  private adult = false;
  private consent = false;
  private foreground = true;
  private disposed = false;
  private generation = 0;
  private subscriptions: Array<{ remove(): void }> = [];
  private active = false;
  private pending = false;
  constructor(private readonly onStop: (reason: string) => void) {}
  get recording(): boolean { return this.active; }
  get starting(): boolean { return this.pending; }
  setConsent(adult: boolean, recording: boolean): void {
    this.adult = adult; this.consent = recording;
    if (!adult || !recording) this.stop('CONSENT_REVOKED');
  }
  setForeground(value: boolean): void {
    this.foreground = value;
    if (!value) this.stop('APP_BACKGROUNDED');
  }
  async start(prepare: () => Promise<void>, subscribe: (register: (subscription: { remove(): void }) => void) => void): Promise<boolean> {
    if (this.disposed || this.active || this.pending || !this.foreground || !this.adult || !this.consent) throw new Error('Recording requires current adult consent, foreground state, and an idle recorder.');
    const generation = ++this.generation;
    this.pending = true;
    try {
      await prepare();
      if (generation !== this.generation || this.disposed || !this.foreground || !this.adult || !this.consent) return false;
      this.active = true;
      subscribe((subscription) => { this.subscriptions.push(subscription); });
      return true;
    } catch (error) {
      this.stop('SENSOR_START_FAILED');
      throw error;
    } finally { this.pending = false; }
  }
  stop(reason = 'USER_STOPPED'): void {
    this.generation++;
    const wasActive = this.active;
    this.active = false;
    const subscriptions = this.subscriptions; this.subscriptions = [];
    for (const subscription of subscriptions) { try { subscription.remove(); } catch { /* Continue removing every other listener. */ } }
    if (wasActive) this.onStop(reason);
  }
  dispose(): void { this.disposed = true; this.stop('UNMOUNTED'); }
}
