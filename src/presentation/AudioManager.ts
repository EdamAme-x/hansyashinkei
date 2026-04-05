import type { AudioTheme } from "@domain/entities/ThemeConfig";
import type { KVStore } from "@domain/repositories/KVStore";

const STORAGE_KEY = "hs-audio";

export class AudioManager {
  private readonly audio: AudioTheme;
  private readonly kv: KVStore;
  private bgm: HTMLAudioElement | null = null;
  private _enabled: boolean;

  constructor(audioTheme: AudioTheme, kv: KVStore) {
    this.audio = audioTheme;
    this.kv = kv;
    this._enabled = this.loadPref();
  }

  get enabled(): boolean {
    return this._enabled;
  }

  toggle(): boolean {
    this._enabled = !this._enabled;
    this.kv.set(STORAGE_KEY, this._enabled ? "1" : "0");

    if (!this._enabled) {
      this.stopBgm();
    }
    return this._enabled;
  }

  startBgm(): void {
    if (!this._enabled) return;
    this.stopBgm();

    this.bgm = new Audio(this.audio.bgmUrl);
    this.bgm.loop = true;
    this.bgm.volume = this.audio.bgmVolume;
    this.bgm.play().catch(() => {});
  }

  stopBgm(): void {
    if (this.bgm) {
      this.bgm.pause();
      this.bgm.currentTime = 0;
      this.bgm = null;
    }
  }

  playDodge(): void {
    const urls = this.audio.se.dodge;
    this.playSe(urls[Math.floor(Math.random() * urls.length)], 0.04);
  }

  playSpeedUp(): void {
    this.playSe(this.audio.se.speedUp, 0.1);
  }

  playDeath(): void {
    this.playSe(this.audio.se.death, 0.15);
  }

  playNewBest(): void {
    this.playSe(this.audio.se.newBest, 0.12);
  }

  playStart(): void {
    this.playSe(this.audio.se.start, 0.1);
  }

  private playSe(url: string, volume: number): void {
    if (!this._enabled) return;
    const a = new Audio(url);
    a.volume = volume;
    a.play().catch(() => {});
  }

  private loadPref(): boolean {
    const v = this.kv.get(STORAGE_KEY);
    return v !== "0";
  }
}
