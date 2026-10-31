import { Directory, File, Paths } from 'expo-file-system';
import type { AudioPlayer } from 'expo-audio';

declare const require: (id: string) => any;

export interface BloomNote {
  name: string;
  noteLabel: string;
  fractionMin: number;
  fractionMax: number;
  minDeltaMicroT: number;
  maxDeltaMicroT: number;
  frequencyHz: number;
  color: string;
  description: string;
}

/**
 * Ambient Harmonic Tiers for visual feedback and color mapping.
 * Inspired by Brian Eno and Peter Chilvers' "Bloom".
 */
export const BLOOM_PENTATONIC_SCALE: BloomNote[] = [
  { name: 'QUIET BASELINE', noteLabel: 'A1 · 55 Hz Sub-Hum', fractionMin: 0.0, fractionMax: 0.125, minDeltaMicroT: 0, maxDeltaMicroT: 0.5, frequencyHz: 55.0, color: '#68edc3', description: 'Resting room geomagnetic baseline. Calm low humming.' },
  { name: 'DEEP AURA', noteLabel: 'A2 · 110 Hz Hum', fractionMin: 0.125, fractionMax: 0.25, minDeltaMicroT: 0.5, maxDeltaMicroT: 1.2, frequencyHz: 110.0, color: '#4dd0e1', description: 'Hand approaching at 10–12 inches. Pitch begins to rise.' },
  { name: 'WARM AIR', noteLabel: 'C3 · 131 Hz Swoosh', fractionMin: 0.25, fractionMax: 0.375, minDeltaMicroT: 1.2, maxDeltaMicroT: 2.5, frequencyHz: 130.8, color: '#80cbc4', description: 'Gentle hand movement at 8–10 inches.' },
  { name: 'SINGING FIFTH', noteLabel: 'E3 · 165 Hz Resonance', fractionMin: 0.375, fractionMax: 0.50, minDeltaMicroT: 2.5, maxDeltaMicroT: 4.5, frequencyHz: 164.8, color: '#ffd58c', description: 'Hand hovering at 6–8 inches. Harmonic resonance swells.' },
  { name: 'FIELD SWELL', noteLabel: 'G3 · 196 Hz Harmonic', fractionMin: 0.50, fractionMax: 0.625, minDeltaMicroT: 4.5, maxDeltaMicroT: 7.5, frequencyHz: 196.0, color: '#ffb74d', description: 'Hand hovering at 4–6 inches.' },
  { name: 'AIR CHORUS', noteLabel: 'A3 · 220 Hz Shimmer', fractionMin: 0.625, fractionMax: 0.75, minDeltaMicroT: 7.5, maxDeltaMicroT: 12.0, frequencyHz: 220.0, color: '#f06292', description: 'Hand closing in at 2–4 inches.' },
  { name: 'UPPER HARMONIC', noteLabel: 'B3 · 247 Hz Shimmer', fractionMin: 0.75, fractionMax: 0.875, minDeltaMicroT: 12.0, maxDeltaMicroT: 18.0, frequencyHz: 246.9, color: '#ba68c8', description: 'Hand 1–2 inches above phone.' },
  { name: 'PROXIMITY APEX', noteLabel: 'C4 · 262 Hz Apex', fractionMin: 0.875, fractionMax: 1.0, minDeltaMicroT: 18.0, maxDeltaMicroT: Infinity, frequencyHz: 261.6, color: '#b9a5ff', description: 'Closest hand proximity or touch.' },
];

export type SonificationTier = BloomNote;
export const SONIFICATION_TIERS = BLOOM_PENTATONIC_SCALE;

/**
 * Generates an uncompressed 16-bit mono PCM WAV file containing
 * a seamless, continuous ambient background hum with gentle warm noise.
 *
 * Modeled after Brian Eno's ambient drone textures:
 * - Pure, warm analog harmonics: 55 Hz sub, 110 Hz fundamental, 165 Hz fifth, 220 Hz octave
 * - Filtered warm pink noise (pleasant ocean/air breath, no harsh treble)
 * - 4.0 seconds long, perfectly seamless loop without zero-crossing clicks
 * - Designed to be looped continuously and dynamically pitch-modulated via playbackRate.
 */
export function generateAmbientDroneWavBytes(
  durationSec = 4.0,
  sampleRate = 16000
): Uint8Array {
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2;
  const buffer = new Uint8Array(44 + dataSize);
  const view = new DataView(buffer.buffer);

  // 'RIFF' chunk descriptor
  buffer.set([0x52, 0x49, 0x46, 0x46], 0);
  view.setUint32(4, 36 + dataSize, true);
  buffer.set([0x57, 0x41, 0x56, 0x45], 8);

  // 'fmt ' subchunk (16 bytes for PCM)
  buffer.set([0x66, 0x6d, 0x74, 0x20], 12);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format (1)
  view.setUint16(22, 1, true); // Mono (1)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // 16-bit samples

  // 'data' subchunk
  buffer.set([0x64, 0x61, 0x74, 0x61], 36);
  view.setUint32(40, dataSize, true);

  // 1. Generate filtered warm pink noise buffer with crossfade seam
  const noise = new Float32Array(numSamples);
  let lp = 0;
  for (let i = 0; i < numSamples; i++) {
    const white = Math.random() * 2 - 1;
    lp += 0.035 * (white - lp); // Gentle low-pass filter
    noise[i] = lp * 0.16;
  }
  // Crossfade noise seam at the loop boundary (last 250ms blends into first 250ms)
  const fadeLen = Math.floor(sampleRate * 0.25);
  for (let i = 0; i < fadeLen; i++) {
    const alpha = 0.5 * (1 - Math.cos(Math.PI * (i / fadeLen)));
    const tailIdx = numSamples - fadeLen + i;
    noise[tailIdx] = (1 - alpha) * noise[tailIdx] + alpha * noise[i];
  }

  // 2. Synthesize multi-harmonic ambient drone with slow chorus breathing
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // Harmonic integers completing exact cycles in 4.0s:
    // 55 Hz = 220 cycles, 110 Hz = 440 cycles, 165 Hz = 660 cycles, 220 Hz = 880 cycles
    const hSub = 0.26 * Math.sin(2 * Math.PI * 55.0 * t);
    const hFund = 0.40 * Math.sin(2 * Math.PI * 110.0 * t);
    const hFifth = 0.20 * Math.sin(2 * Math.PI * 165.0 * t);
    const hOct = 0.10 * Math.sin(2 * Math.PI * 220.0 * t);

    // Ultra-slow organic chorus beating (0.25 Hz = exactly 1 cycle per 4 sec)
    const chorus = 0.12 * Math.sin(2 * Math.PI * (110.0 + 0.25) * t);

    const wave = hSub + hFund + hFifth + hOct + chorus + noise[i];
    const sample = Math.round(24000 * wave);
    const clamped = Math.max(-32768, Math.min(32767, sample));
    view.setInt16(44 + i * 2, clamped, true);
  }

  return buffer;
}

export const generateEnoBloomWavBytes = generateAmbientDroneWavBytes;
export const generateToneWavBytes = generateAmbientDroneWavBytes;
export const generateEnoBellWavBytes = generateAmbientDroneWavBytes;

type ExpoAudioModuleType = typeof import('expo-audio');

let cachedAudioModule: ExpoAudioModuleType | null = null;
let moduleResolutionAttempted = false;

function resolveExpoAudio(): ExpoAudioModuleType | null {
  if (moduleResolutionAttempted) return cachedAudioModule;
  moduleResolutionAttempted = true;
  try {
    const mod = require('expo-audio') as ExpoAudioModuleType;
    if (mod && typeof mod.createAudioPlayer === 'function') {
      cachedAudioModule = mod;
    }
  } catch (err) {
    console.warn('[MagneticSoundscapeEngine] expo-audio native module unavailable in this environment:', err);
    cachedAudioModule = null;
  }
  return cachedAudioModule;
}

/**
 * Continuous Ambient Magnetic Soundscape Engine.
 * Plays a soft, soothing, continuous background hum with warm white-noise air.
 * As the magnetic field strengthens (hand closer), the pitch glides smoothly upward.
 * As the magnetic field weakens (hand farther), the pitch glides smoothly back down.
 * Non-intrusive, calming, and free of sharp keyboard clicks.
 */
export class MagneticSoundscapeEngine {
  private dronePlayer: AudioPlayer | null = null;
  private initialized = false;
  private audioAvailable = false;
  private muted = false;

  private currentRate = 0.72;
  private targetRate = 0.72;
  private currentVolume = 0.20;
  private targetVolume = 0.20;
  private currentNoteIndex = 0;

  get isAudioAvailable(): boolean {
    return this.audioAvailable;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  get currentNote(): BloomNote {
    return BLOOM_PENTATONIC_SCALE[this.currentNoteIndex] ?? BLOOM_PENTATONIC_SCALE[0];
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    const audioMod = resolveExpoAudio();
    if (!audioMod) {
      this.audioAvailable = false;
      this.initialized = true;
      return;
    }

    try {
      if (typeof audioMod.setAudioModeAsync === 'function') {
        await audioMod.setAudioModeAsync({
          playsInSilentMode: true,
        });
      }

      const folder = new Directory(Paths.cache, 'aurorasense-ambient-drone-v1');
      if (!folder.exists) {
        folder.create();
      }

      const file = new File(folder, 'ambient-hum-loop-4s.wav');
      const wavBytes = generateAmbientDroneWavBytes(4.0, 16000);
      file.writeSync(wavBytes);

      const player = audioMod.createAudioPlayer(file.uri);
      player.loop = true;
      player.volume = this.muted ? 0 : 0.20;

      // Disable pitch correction so playbackRate directly alters audio pitch like analog tape modulation
      if ('shouldCorrectPitch' in player) {
        (player as any).shouldCorrectPitch = false;
      }
      if (typeof player.setPlaybackRate === 'function') {
        player.setPlaybackRate(0.72);
      } else if ('playbackRate' in player) {
        player.playbackRate = 0.72;
      }

      this.dronePlayer = player;
      this.audioAvailable = true;
      this.initialized = true;

      // Start continuous ambient drone playback
      if (!this.muted) {
        player.play();
      }
    } catch (err) {
      console.warn('[MagneticSoundscapeEngine] Ambient drone initialization failed:', err);
      this.audioAvailable = false;
      this.initialized = true;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.dronePlayer) return;
    try {
      if (muted) {
        this.dronePlayer.volume = 0;
        this.dronePlayer.pause();
      } else {
        this.dronePlayer.volume = this.currentVolume;
        this.dronePlayer.play();
      }
    } catch {}
  }

  getTier(deltaMicroT: number, maxObservedDelta = 2.5): { tier: BloomNote; index: number } {
    const absDelta = Math.abs(deltaMicroT);
    const effectiveMax = Math.max(1.0, maxObservedDelta);
    const normalized = Math.min(0.999, absDelta / effectiveMax);

    for (let i = 0; i < BLOOM_PENTATONIC_SCALE.length; i++) {
      if (normalized >= BLOOM_PENTATONIC_SCALE[i].fractionMin && normalized < BLOOM_PENTATONIC_SCALE[i].fractionMax) {
        return { tier: BLOOM_PENTATONIC_SCALE[i], index: i };
      }
    }
    const lastIndex = BLOOM_PENTATONIC_SCALE.length - 1;
    return { tier: BLOOM_PENTATONIC_SCALE[lastIndex], index: lastIndex };
  }

  /**
   * Smoothly modulates the background humming pitch and volume in real-time
   * based on the magnetic field strength.
   *
   * As field strengthens: pitch glides up smoothly (0.72 -> 1.65), volume gently swells.
   * As field weakens: pitch glides down smoothly (1.65 -> 0.72), resting in peaceful hum.
   */
  async playForDeviation(
    deltaMicroT: number,
    maxObservedDelta = 2.5
  ): Promise<{ index: number; note: BloomNote; triggered: boolean }> {
    const { index, tier } = this.getTier(deltaMicroT, maxObservedDelta);
    this.currentNoteIndex = index;

    if (!this.initialized || !this.audioAvailable || !this.dronePlayer) {
      return { index, note: tier, triggered: false };
    }

    if (this.muted) {
      return { index, note: tier, triggered: false };
    }

    const absDelta = Math.abs(deltaMicroT);
    const effectiveMax = Math.max(0.8, maxObservedDelta);
    const norm = Math.min(1.0, absDelta / effectiveMax);

    // Compute target pitch rate: 0.72 at resting quiet up to 1.62 at peak proximity
    this.targetRate = 0.72 + norm * 0.90;

    // Compute target volume: gentle 0.20 at rest up to 0.44 when hand is hovering close
    this.targetVolume = 0.20 + norm * 0.24;

    // Smooth exponential gliding (portamento filter) so pitch slides like continuous air
    this.currentRate += 0.25 * (this.targetRate - this.currentRate);
    this.currentVolume += 0.25 * (this.targetVolume - this.currentVolume);

    try {
      // Ensure player is actively playing
      if (!this.dronePlayer.playing && !this.muted) {
        this.dronePlayer.play();
      }

      this.dronePlayer.volume = this.currentVolume;
      if (typeof this.dronePlayer.setPlaybackRate === 'function') {
        this.dronePlayer.setPlaybackRate(this.currentRate);
      } else if ('playbackRate' in this.dronePlayer) {
        this.dronePlayer.playbackRate = this.currentRate;
      }
      return { index, note: tier, triggered: true };
    } catch {
      return { index, note: tier, triggered: false };
    }
  }

  async dispose(): Promise<void> {
    this.initialized = false;
    this.audioAvailable = false;
    if (this.dronePlayer) {
      try {
        this.dronePlayer.pause();
      } catch {}
      this.dronePlayer = null;
    }
  }
}

// Backwards compatibility aliases
export type MagneticSonificationEngine = MagneticSoundscapeEngine;
export const MagneticSonificationEngine = MagneticSoundscapeEngine;
