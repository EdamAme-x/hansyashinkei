import { StateMachine, GameState, GameEvent } from "@domain/entities/StateMachine";
import type { GameConfig } from "@domain/entities/GameConfig";
import { createGameWorld, dodge, undodge, tick, type GameWorldState } from "@domain/entities/GameWorld";
import { ManageScore } from "@application/usecases/ManageScore";
import type { InputConfig } from "./InputConfig";
import { GameRenderer } from "./GameRenderer";
import { HUD } from "./HUD";

export class App {
  private readonly sm = new StateMachine();
  private readonly renderer: GameRenderer;
  private readonly hud: HUD;
  private readonly manageScore: ManageScore;
  private readonly gameConfig: GameConfig;
  private readonly inputConfig: InputConfig;

  private world: GameWorldState;
  private animationId = 0;
  private lastTime = 0;
  private bestScore = 0;

  constructor(
    container: HTMLElement,
    manageScore: ManageScore,
    gameConfig: GameConfig,
    inputConfig: InputConfig,
  ) {
    this.gameConfig = gameConfig;
    this.inputConfig = inputConfig;
    this.renderer = new GameRenderer(container, gameConfig);
    this.hud = new HUD();
    this.manageScore = manageScore;
    this.world = createGameWorld(gameConfig);

    this.sm.onStateChange((_prev, next) => this.onStateChange(next));

    this.setupInput();
    this.setupResize();
    this.hud.show(GameState.Title);
    this.startLoop();

    this.loadBestScore();
  }

  private async loadBestScore(): Promise<void> {
    const history = await this.manageScore.getHistory();
    if (history.bestScore) {
      this.bestScore = history.bestScore.value;
    }
  }

  private onStateChange(state: GameState): void {
    this.hud.show(state);

    if (state === GameState.Playing) {
      this.world = createGameWorld(this.gameConfig);
      this.renderer.clearWalls();
      this.renderer.showBalls(true);
      this.hud.updateScore(0);
    }

    if (state === GameState.GameOver) {
      this.renderer.showBalls(false);
      if (this.world.score > this.bestScore) {
        this.bestScore = this.world.score;
      }
      this.hud.showGameOver(this.world.score, this.bestScore);
      this.manageScore.record(this.world.score).catch(() => {});
    }
  }

  private setupResize(): void {
    window.addEventListener("resize", () => {
      this.renderer.resize(window.innerWidth, window.innerHeight);
    });
  }

  private setupInput(): void {
    const pressed = new Set<string>();
    const { dodge: dodgeBindings, start: startCodes } = this.inputConfig;

    window.addEventListener("keydown", (e) => {
      if (pressed.has(e.code)) return;
      pressed.add(e.code);

      if (this.sm.state === GameState.Title && startCodes.includes(e.code)) {
        this.sm.dispatch(GameEvent.Start);
        return;
      }

      if (this.sm.state === GameState.GameOver && startCodes.includes(e.code)) {
        this.sm.dispatch(GameEvent.Retry);
        return;
      }

      if (this.sm.state === GameState.Playing) {
        for (const binding of dodgeBindings) {
          if (e.code === binding.code) {
            dodge(this.world, binding.ballIndex);
          }
        }
      }
    });

    window.addEventListener("keyup", (e) => {
      pressed.delete(e.code);

      if (this.sm.state === GameState.Playing) {
        for (const binding of dodgeBindings) {
          if (e.code === binding.code) {
            undodge(this.world, binding.ballIndex);
          }
        }
      }
    });
  }

  private startLoop(): void {
    this.lastTime = performance.now();
    const loop = (now: number) => {
      this.animationId = requestAnimationFrame(loop);
      const dt = Math.min((now - this.lastTime) / 1000, 0.05);
      this.lastTime = now;

      if (this.sm.state === GameState.Playing) {
        tick(this.world, dt);
        this.hud.updateScore(this.world.score);

        if (!this.world.alive) {
          this.sm.dispatch(GameEvent.Die);
        } else {
          this.renderer.sync(this.world);
        }
      }

      this.renderer.render();
    };
    this.animationId = requestAnimationFrame(loop);
  }

  dispose(): void {
    cancelAnimationFrame(this.animationId);
    this.renderer.dispose();
  }
}
