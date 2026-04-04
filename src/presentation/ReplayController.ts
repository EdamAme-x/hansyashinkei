import type { Replay, ReplayEvent } from "@domain/entities/Replay";
import { createGameWorld, dodge, undodge, tick, getSpeedTier, type GameWorldState } from "@domain/entities/GameWorld";
import { mulberry32 } from "@domain/entities/Prng";
import type { GameRenderer } from "./GameRenderer";
import type { HUD } from "./HUD";

export class ReplayController {
  private readonly world: GameWorldState;
  private readonly replay: Replay;
  private readonly renderer: GameRenderer;
  private readonly hud: HUD;
  private readonly onDone: () => void;

  private readonly eventsByFrame: Map<number, ReplayEvent[]>;
  private frameIndex = 0;
  private animationId = 0;
  private lastTier = 0;

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
  }

  start(): void {
    this.renderer.clearWalls();
    this.renderer.showBalls(true);
    this.hud.updateScore(0);
    this.frameIndex = 0;
    this.lastTier = 0;

    const loop = () => {
      if (this.frameIndex >= this.replay.dts.length) {
        this.renderer.showBalls(false);
        this.onDone();
        return;
      }

      this.animationId = requestAnimationFrame(loop);

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

      if (this.world.alive) {
        this.renderer.sync(this.world);
      }

      this.renderer.render();
      this.frameIndex++;

      if (!this.world.alive) {
        this.renderer.showBalls(false);
        this.onDone();
        cancelAnimationFrame(this.animationId);
      }
    };

    this.animationId = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.animationId);
    this.renderer.clearWalls();
  }
}
