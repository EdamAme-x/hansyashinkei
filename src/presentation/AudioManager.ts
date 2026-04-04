const STORAGE_KEY = "hansyashinkei-audio";

const BGM_URL = "/audio/bgm.mp3";
const SE = {
  dodge: ["/audio/dodge1.mp3", "/audio/dodge2.mp3"],
  wallPass: "/audio/bell-accent.mp3",
  speedUp: "/audio/bell-accent.mp3",
  death: "/audio/death.mp3",
  newBest: "/audio/new-best.mp3",
  start: "/audio/start.mp3",
} as const;

export class AudioManager {
  private bgm: HTMLAudioElement | null = null;
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

    if (!this._enabled) {
      this.stopBgm();
    }
    return this._enabled;
  }

  startBgm(): void {
    if (!this._enabled) return;
    this.stopBgm();

    this.bgm = new Audio(BGM_URL);
    this.bgm.loop = true;
    this.bgm.volume = 0.25;
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
    const urls = SE.dodge;
    this.playSe(urls[Math.floor(Math.random() * urls.length)], 0.15);
  }

  playWallPass(): void {
    this.playSe(SE.wallPass, 0.12);
  }

  playSpeedUp(): void {
    this.playSe(SE.speedUp, 0.3);
  }

  playDeath(): void {
    this.playSe(SE.death, 0.4);
  }

  playNewBest(): void {
    this.playSe(SE.newBest, 0.35);
  }

  playStart(): void {
    this.playSe(SE.start, 0.25);
  }

  private playSe(url: string, volume: number): void {
    if (!this._enabled) return;
    const audio = new Audio(url);
    audio.volume = volume;
    audio.play().catch(() => {});
  }

  private loadPref(): boolean {
    const v = localStorage.getItem(STORAGE_KEY);
    return v !== "0";
  }
}
