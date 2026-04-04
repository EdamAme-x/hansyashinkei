import { StateMachine, GameState, GameEvent } from "@domain/entities/StateMachine";
import { BallSide } from "@domain/entities/Lane";
import { createGameWorld, dodge, undodge, tick, type GameWorldState } from "@domain/entities/GameWorld";
import { ManageScore } from "@application/usecases/ManageScore";
import { GameRenderer } from "./GameRenderer";
import { HUD } from "./HUD";

export class App {
  private readonly sm = new StateMachine();
  private readonly renderer: GameRenderer;
  private readonly hud: HUD;
  private readonly manageScore: ManageScore;

  private world: GameWorldState = createGameWorld();
  private animationId = 0;
  private lastTime = 0;
  private bestScore = 0;

  constructor(container: HTMLElement, manageScore: ManageScore) {
    this.renderer = new GameRenderer(container);
    this.hud = new HUD();
    this.manageScore = manageScore;

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
      this.world = createGameWorld();
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

    window.addEventListener("keydown", (e) => {
      if (pressed.has(e.code)) return;
      pressed.add(e.code);

      if (this.sm.state === GameState.Title && (e.code === "Space" || e.code === "Enter")) {
        this.sm.dispatch(GameEvent.Start);
        return;
      }

      if (this.sm.state === GameState.GameOver && (e.code === "Space" || e.code === "Enter")) {
        this.sm.dispatch(GameEvent.Retry);
        return;
      }

      if (this.sm.state === GameState.Playing) {
        if (e.code === "KeyJ") dodge(this.world, BallSide.Left);
        if (e.code === "KeyK") dodge(this.world, BallSide.Right);
      }
    });

    window.addEventListener("keyup", (e) => {
      pressed.delete(e.code);

      if (this.sm.state === GameState.Playing) {
        if (e.code === "KeyJ") undodge(this.world, BallSide.Left);
        if (e.code === "KeyK") undodge(this.world, BallSide.Right);
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
