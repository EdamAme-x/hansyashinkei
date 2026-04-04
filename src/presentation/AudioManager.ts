const STORAGE_KEY = "hansyashinkei-audio";

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private seGain: GainNode | null = null;
  private bgmOscillators: OscillatorNode[] = [];
  private _enabled: boolean;

  constructor() {
    this._enabled = this.loadPref();
  }

  get enabled(): boolean {
    return this._enabled;
  }

  toggle(): boolean {
    this._enabled = !this._enabled;
    localStorage.setItem(STORAGE_KEY, this._enabled ? "1" : "0");

    if (this._enabled) {
      this.ensureCtx();
    } else {
      this.stopBgm();
      this.ctx?.suspend();
    }
    return this._enabled;
  }

  // --- BGM: ambient drone ---

  startBgm(): void {
    if (!this._enabled) return;
    this.ensureCtx();
    this.stopBgm();

    const ctx = this.ctx;
    const gain = this.bgmGain;
    if (!ctx || !gain) return;

    // Layered detuned sine waves for ethereal pad
    const freqs = [55, 82.41, 110, 164.81]; // A1, E2, A2, E3
    const detunes = [-8, 5, -3, 7];

    for (let i = 0; i < freqs.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freqs[i];
      osc.detune.value = detunes[i];

      const oscGain = ctx.createGain();
      oscGain.gain.value = 0.06;

      osc.connect(oscGain);
      oscGain.connect(gain);
      osc.start();
      this.bgmOscillators.push(osc);
    }

    // Slow LFO modulating volume for breathing effect
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.15;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();
    this.bgmOscillators.push(lfo);
  }

  stopBgm(): void {
    for (const osc of this.bgmOscillators) {
      try { osc.stop(); } catch { /* already stopped */ }
    }
    this.bgmOscillators = [];
  }

  // --- SE ---

  playDodge(): void {
    this.playSe((ctx, dest) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.06);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain).connect(dest);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    });
  }

  playWallPass(): void {
    this.playSe((ctx, dest) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain).connect(dest);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    });
  }

  playSpeedUp(): void {
    this.playSe((ctx, dest) => {
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      for (let i = 0; i < notes.length; i++) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = notes[i];
        const gain = ctx.createGain();
        const t = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.1, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(gain).connect(dest);
        osc.start(t);
        osc.stop(t + 0.2);
      }
    });
  }

  playDeath(): void {
    this.playSe((ctx, dest) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.5);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(800, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.5);

      osc.connect(filter).connect(gain).connect(dest);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    });
  }

  playNewBest(): void {
    this.playSe((ctx, dest) => {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      for (let i = 0; i < notes.length; i++) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = notes[i];
        const gain = ctx.createGain();
        const t = ctx.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.08, t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain).connect(dest);
        osc.start(t);
        osc.stop(t + 0.3);
      }
    });
  }

  // --- Internal ---

  private ensureCtx(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1.0;
      this.masterGain.connect(this.ctx.destination);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.5;
      this.bgmGain.connect(this.masterGain);

      this.seGain = this.ctx.createGain();
      this.seGain.gain.value = 0.7;
      this.seGain.connect(this.masterGain);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  private playSe(fn: (ctx: AudioContext, dest: AudioNode) => void): void {
    if (!this._enabled) return;
    this.ensureCtx();
    if (!this.ctx || !this.seGain) return;
    fn(this.ctx, this.seGain);
  }

  private loadPref(): boolean {
    const v = localStorage.getItem(STORAGE_KEY);
    return v !== "0";
  }
}
