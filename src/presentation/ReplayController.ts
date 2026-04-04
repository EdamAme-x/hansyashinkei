import type { Replay, ReplayEvent } from "@domain/entities/Replay";
import { createGameWorld, dodge, undodge, tick, getSpeedTier, type GameWorldState } from "@domain/entities/GameWorld";
import { mulberry32 } from "@domain/entities/Prng";
import type { GameRenderer } from "./GameRenderer";
import type { HUD } from "./HUD";

function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing element #${id}`);
  return e;
}

const SPEED_OPTIONS = [0.5, 1, 2];

export class ReplayController {
  private world: GameWorldState;
  private readonly replay: Replay;
  private readonly renderer: GameRenderer;
  private readonly hud: HUD;
  private readonly onDone: () => void;

  private readonly eventsByFrame: Map<number, ReplayEvent[]>;
  private readonly cumulativeDts: Float64Array;
  private readonly totalTime: number;
  private readonly abortCtrl = new AbortController();
  private frameIndex = 0;
  private animationId = 0;
  private lastTier = 0;
  private paused = false;
  private playbackSpeed = 1;
  private frameBudget = 0;

  // UI elements
  private readonly bar = el("replay-bar");
  private readonly progress = el("replay-progress");
  private readonly progressFill = el("replay-progress-fill");
  private readonly playBtn = el("replay-play-btn");
  private readonly speedBtn = el("replay-speed-btn");
  private readonly timeDisplay = el("replay-time");

  constructor(
    replay: Replay,
    renderer: GameRenderer,
    hud: HUD,
    onDone: () => void,
  ) {
    this.replay = replay;
    this.renderer = renderer;
    this.hud = hud;
    this.onDone = onDone;

    this.world = createGameWorld(replay.config, mulberry32(replay.seed));

    this.eventsByFrame = new Map();
    for (const ev of replay.events) {
      const arr = this.eventsByFrame.get(ev.frame) ?? [];
      arr.push(ev);
      this.eventsByFrame.set(ev.frame, arr);
    }

    // Precompute cumulative dt sums for O(1) time lookups
    const dts = replay.dts;
    const cum = new Float64Array(dts.length + 1);
    for (let i = 0; i < dts.length; i++) cum[i + 1] = cum[i] + dts[i];
    this.cumulativeDts = cum;
    this.totalTime = cum[dts.length];

    const sig = { signal: this.abortCtrl.signal };
    el("replay-back-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      this.stop();
      this.onDone();
    }, sig);
    el("replay-rw-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      this.skip(-5);
    }, sig);
    this.playBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.togglePause();
    }, sig);
    el("replay-ff-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      this.skip(5);
    }, sig);
    this.speedBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.cycleSpeed();
    }, sig);
    this.progress.addEventListener("click", (e) => {
      e.stopPropagation();
      this.seek(e);
    }, sig);
  }

  start(): void {
    this.renderer.clearWalls();
    this.renderer.showBalls(true);
    this.hud.updateScore(0);
    this.frameIndex = 0;
    this.lastTier = 0;
    this.paused = false;
    this.playbackSpeed = 1;
    this.frameBudget = 0;

    this.bar.classList.remove("hidden");
    this.playBtn.textContent = "⏸";
    this.speedBtn.textContent = "1x";
    this.updateBar();

    const loop = () => {
      this.animationId = requestAnimationFrame(loop);

      if (this.paused) return;
      if (this.frameIndex >= this.replay.dts.length || !this.world.alive) {
        // Pause at end — user can seek back or close via ✕
        this.paused = true;
        this.playBtn.textContent = "▶";
        this.updateBar();
        return;
      }

      // Handle playback speed by accumulating frame budget
      this.frameBudget += this.playbackSpeed;
      while (this.frameBudget >= 1 && this.frameIndex < this.replay.dts.length && this.world.alive) {
        this.frameBudget -= 1;
        this.stepFrame();
      }

      if (this.world.alive) {
        this.renderer.sync(this.world);
      }
      this.renderer.render();
      this.updateBar();
    };

    this.animationId = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.animationId);
    this.abortCtrl.abort();
    this.renderer.clearWalls();
    this.bar.classList.add("hidden");
  }

  private stepFrame(): void {
    const events = this.eventsByFrame.get(this.frameIndex);
    if (events) {
      for (const ev of events) {
        if (ev.type === "dodge") dodge(this.world, ev.ballIndex);
        else undodge(this.world, ev.ballIndex);
      }
    }

    const dt = this.replay.dts[this.frameIndex];
    tick(this.world, dt);

    const tier = getSpeedTier(this.world.config, this.world.score);
    if (tier > this.lastTier) {
      this.lastTier = tier;
      this.hud.showSpeedUp();
    }

    this.hud.updateScore(this.world.score);
    this.frameIndex++;
  }

  private togglePause(): void {
    this.paused = !this.paused;
    this.playBtn.textContent = this.paused ? "▶" : "⏸";
  }

  private cycleSpeed(): void {
    const idx = SPEED_OPTIONS.indexOf(this.playbackSpeed);
    this.playbackSpeed = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    this.speedBtn.textContent = `${this.playbackSpeed}x`;
  }

  private seekToFrame(targetFrame: number): void {
    targetFrame = Math.max(0, Math.min(targetFrame, this.replay.dts.length));

    this.world = createGameWorld(this.replay.config, mulberry32(this.replay.seed));
    this.lastTier = 0;

    for (let i = 0; i < targetFrame && this.world.alive; i++) {
      const events = this.eventsByFrame.get(i);
      if (events) {
        for (const ev of events) {
          if (ev.type === "dodge") dodge(this.world, ev.ballIndex);
          else undodge(this.world, ev.ballIndex);
        }
      }
      tick(this.world, this.replay.dts[i]);
    }

    this.frameIndex = targetFrame;
    this.lastTier = getSpeedTier(this.world.config, this.world.score);
    this.hud.updateScore(this.world.score);

    if (this.world.alive) {
      this.renderer.clearWalls();
      this.renderer.showBalls(true);
      this.renderer.sync(this.world);
    }
    this.renderer.render();
    this.updateBar();
  }

  private seek(e: MouseEvent): void {
    const rect = this.progress.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    this.seekToFrame(Math.floor(ratio * this.replay.dts.length));
  }

  private skip(seconds: number): void {
    const dts = this.replay.dts;
    let elapsed = 0;
    let target = this.frameIndex;

    if (seconds > 0) {
      while (target < dts.length && elapsed < seconds) {
        elapsed += dts[target];
        target++;
      }
    } else {
      target--;
      while (target >= 0 && elapsed < -seconds) {
        elapsed += dts[target];
        target--;
      }
      target = Math.max(0, target);
    }

    this.seekToFrame(target);
  }

  private updateBar(): void {
    const total = this.replay.dts.length;
    const pct = total > 0 ? Math.round((this.frameIndex / total) * 100) : 0;
    this.progressFill.style.width = `${pct}%`;
    this.progress.setAttribute("aria-valuenow", String(pct));

    const elapsed = this.cumulativeDts[this.frameIndex];
    this.timeDisplay.textContent = `${fmtTime(elapsed)} / ${fmtTime(this.totalTime)}`;
  }
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
