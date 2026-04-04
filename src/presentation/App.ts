import { StateMachine, GameState, GameEvent } from "@domain/entities/StateMachine";
import type { GameConfig } from "@domain/entities/GameConfig";
import type { Replay, ReplayEvent } from "@domain/entities/Replay";
import { createReplay } from "@domain/entities/Replay";
import { createGameWorld, dodge, undodge, tick, getSpeedTier, type GameWorldState } from "@domain/entities/GameWorld";
import { mulberry32, generateSeed } from "@domain/entities/Prng";
import { ManageScore } from "@application/usecases/ManageScore";
import { ManageReplay } from "@application/usecases/ManageReplay";
import type { InputConfig } from "./InputConfig";
import { codeToLabel } from "./InputConfig";
import { GameRenderer } from "./GameRenderer";
import { HUD } from "./HUD";
import { ReplayController } from "./ReplayController";
import { HistoryUI } from "./HistoryUI";
import { KeybindUI } from "./KeybindUI";

interface RecordingSession {
  seed: number;
  pendingInputs: ReplayEvent[];
  dts: number[];
  events: ReplayEvent[];
  frameCount: number;
}

export class App {
  private readonly sm = new StateMachine();
  private readonly renderer: GameRenderer;
  private readonly hud: HUD;
  private readonly historyUI: HistoryUI;
  private readonly keybindUI: KeybindUI;
  private readonly manageScore: ManageScore;
  private readonly manageReplay: ManageReplay;
  private readonly gameConfig: GameConfig;
  private inputConfig: InputConfig;

  private world: GameWorldState;
  private animationId = 0;
  private lastTime = 0;
  private bestScore = 0;
  private bestReplayId: string | null = null;
  private lastTier = 0;
  private recording: RecordingSession | null = null;
  private replayController: ReplayController | null = null;

  constructor(
    container: HTMLElement,
    manageScore: ManageScore,
    manageReplay: ManageReplay,
    gameConfig: GameConfig,
    inputConfig: InputConfig,
  ) {
    this.gameConfig = gameConfig;
    this.inputConfig = inputConfig;
    this.renderer = new GameRenderer(container, gameConfig);
    this.hud = new HUD();
    this.manageScore = manageScore;
    this.manageReplay = manageReplay;
    this.world = createGameWorld(gameConfig, mulberry32(generateSeed()));

    this.historyUI = new HistoryUI(
      manageReplay,
      (replay) => this.watchReplay(replay),
      () => {},
    );

    this.keybindUI = new KeybindUI(
      inputConfig,
      (updated) => {
        this.inputConfig = updated;
        this.updateKeyHints();
      },
      () => {},
    );

    this.sm.onStateChange((_prev, next) => this.onStateChange(next));

    this.setupInput();
    this.setupResize();
    this.setupTitleButtons();
    this.hud.show(GameState.Title);
    this.updateKeyHints();
    this.startLoop();
    this.loadBestScore();
  }

  private async loadBestScore(): Promise<void> {
    const history = await this.manageScore.getHistory();
    if (history.bestScore) {
      this.bestScore = history.bestScore.value;
      this.bestReplayId = history.bestScore.replayId;
    }
    this.hud.updateTitleBest(this.bestScore);
  }

  private onStateChange(state: GameState): void {
    this.hud.show(state);

    if (state === GameState.Playing) {
      const seed = generateSeed();
      this.world = createGameWorld(this.gameConfig, mulberry32(seed));
      this.lastTier = 0;
      this.recording = {
        seed,
        pendingInputs: [],
        dts: [],
        events: [],
        frameCount: 0,
      };
      this.renderer.clearWalls();
      this.renderer.showBalls(true);
      this.hud.updateScore(0);
    }

    if (state === GameState.GameOver) {
      this.renderer.showBalls(false);
      const isNewBest = this.world.score > this.bestScore;
      if (isNewBest) {
        this.bestScore = this.world.score;
      }
      this.hud.showGameOver(this.world.score, this.bestScore, isNewBest);
      this.saveRecording(isNewBest);
    }

    if (state === GameState.Title) {
      this.hud.updateTitleBest(this.bestScore);
    }

    if (state === GameState.Watching) {
      this.renderer.clearWalls();
    }
  }

  private async saveRecording(isNewBest: boolean): Promise<void> {
    if (!this.recording) return;

    const replayId = crypto.randomUUID();
    const scoreId = await this.manageScore.record(
      this.world.score,
      replayId,
    );

    const replay = createReplay(
      replayId,
      scoreId,
      this.recording.seed,
      this.gameConfig,
      this.world.score,
      this.recording.dts,
      this.recording.events,
    );

    await this.manageReplay.save(replay);

    if (isNewBest) {
      this.bestReplayId = replayId;
    }

    await this.manageReplay.prune(this.bestReplayId);
    this.recording = null;
  }

  private watchReplay(replay: Replay): void {
    this.historyUI.hide();
    this.sm.dispatch(GameEvent.WatchReplay);
    this.replayController?.stop();

    this.replayController = new ReplayController(
      replay,
      this.renderer,
      this.hud,
      () => {
        this.replayController = null;
        this.sm.dispatch(GameEvent.ReplayDone);
      },
    );
    this.replayController.start();
  }

  private setupTitleButtons(): void {
    document.getElementById("btn-start")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.sm.dispatch(GameEvent.Start);
    });
    document.getElementById("btn-history")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showHistory();
    });
    document.getElementById("btn-keybinds")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.keybindUI.show();
    });
    document.getElementById("back-to-title-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.sm.dispatch(GameEvent.BackToTitle);
    });
  }

  private setupResize(): void {
    window.addEventListener("resize", () => {
      this.renderer.resize(window.innerWidth, window.innerHeight);
    });
  }

  private updateKeyHints(): void {
    const keysEl = document.getElementById("title-keys");
    const hintEl = document.getElementById("title-hint-line");

    if (this.isTouchOnly) {
      if (keysEl) keysEl.textContent = "TAP LEFT / RIGHT";
      if (hintEl) hintEl.textContent = "tap to start";
    } else {
      const left = this.inputConfig.dodge.find((b) => b.ballIndex === 0);
      const right = this.inputConfig.dodge.find((b) => b.ballIndex === 1);
      const leftLabel = left ? codeToLabel(left.code) : "?";
      const rightLabel = right ? codeToLabel(right.code) : "?";
      if (keysEl) keysEl.textContent = `${leftLabel}  ${rightLabel}`;
    }
  }

  private get isTouchOnly(): boolean {
    return navigator.maxTouchPoints > 0 && matchMedia("(pointer: coarse)").matches;
  }

  private setupInput(): void {
    const pressed = new Set<string>();

    // Keyboard
    window.addEventListener("keydown", (e) => {
      if (pressed.has(e.code)) return;
      pressed.add(e.code);

      const { dodge: dodgeBindings, start: startCodes } = this.inputConfig;

      if (this.sm.state === GameState.Title) {
        if (startCodes.includes(e.code)) {
          this.sm.dispatch(GameEvent.Start);
          return;
        }
        if (e.code === "KeyH") {
          this.showHistory();
          return;
        }
        if (e.code === "KeyK") {
          this.keybindUI.show();
          return;
        }
      }

      if (this.sm.state === GameState.GameOver) {
        if (startCodes.includes(e.code)) {
          this.sm.dispatch(GameEvent.Restart);
          return;
        }
        if (e.code === "Backspace") {
          this.sm.dispatch(GameEvent.BackToTitle);
          return;
        }
      }

      if (this.sm.state === GameState.Watching) {
        if (e.code === "Escape" || e.code === "Backspace") {
          this.replayController?.stop();
          this.replayController = null;
          this.sm.dispatch(GameEvent.BackToTitle);
          return;
        }
      }

      if (this.sm.state === GameState.Playing) {
        for (const binding of dodgeBindings) {
          if (e.code === binding.code) {
            this.recordDodge(binding.ballIndex);
          }
        }
      }
    });

    window.addEventListener("keyup", (e) => {
      pressed.delete(e.code);
      const { dodge: dodgeBindings } = this.inputConfig;

      if (this.sm.state === GameState.Playing) {
        for (const binding of dodgeBindings) {
          if (e.code === binding.code) {
            this.recordUndodge(binding.ballIndex);
          }
        }
      }
    });

    // Touch — left half = ballIndex 0, right half = ballIndex 1
    const activeTouches = new Map<number, number>(); // touchId → ballIndex
    const zoneLeft = document.getElementById("touch-zone-left");
    const zoneRight = document.getElementById("touch-zone-right");

    const touchSide = (x: number): number => (x < window.innerWidth / 2) ? 0 : 1;

    const updateZones = (): void => {
      const sides = new Set(activeTouches.values());
      zoneLeft?.classList.toggle("active", sides.has(0));
      zoneRight?.classList.toggle("active", sides.has(1));
    };

    window.addEventListener("touchstart", (e) => {
      if (this.sm.state !== GameState.Playing) return;
      e.preventDefault();

      if (this.sm.state === GameState.Playing) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          const ballIndex = touchSide(touch.clientX);
          activeTouches.set(touch.identifier, ballIndex);
          this.recordDodge(ballIndex);
        }
        updateZones();
      }
    }, { passive: false });

    window.addEventListener("touchend", (e) => {
      if (this.sm.state === GameState.Playing) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          const ballIndex = activeTouches.get(touch.identifier);
          if (ballIndex !== undefined) {
            activeTouches.delete(touch.identifier);
            this.recordUndodge(ballIndex);
          }
        }
        updateZones();
      }
    });

    window.addEventListener("touchcancel", (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const ballIndex = activeTouches.get(touch.identifier);
        if (ballIndex !== undefined) {
          activeTouches.delete(touch.identifier);
          if (this.sm.state === GameState.Playing) {
            this.recordUndodge(ballIndex);
          }
        }
      }
      updateZones();
    });

  }

  private recordDodge(ballIndex: number): void {
    dodge(this.world, ballIndex);
    if (this.recording) {
      this.recording.events.push({
        frame: this.recording.frameCount,
        type: "dodge",
        ballIndex,
      });
    }
  }

  private recordUndodge(ballIndex: number): void {
    undodge(this.world, ballIndex);
    if (this.recording) {
      this.recording.events.push({
        frame: this.recording.frameCount,
        type: "undodge",
        ballIndex,
      });
    }
  }

  private async showHistory(): Promise<void> {
    const history = await this.manageScore.getHistory();
    this.historyUI.show(history);
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

        if (this.recording) {
          this.recording.dts.push(dt);
          this.recording.frameCount++;
        }

        const tier = getSpeedTier(this.gameConfig, this.world.score);
        if (tier > this.lastTier) {
          this.lastTier = tier;
          this.hud.showSpeedUp();
        }

        if (!this.world.alive) {
          this.sm.dispatch(GameEvent.Die);
        } else {
          this.renderer.sync(this.world);
        }
      }

      if (this.sm.state !== GameState.Watching) {
        this.renderer.render();
      }
    };
    this.animationId = requestAnimationFrame(loop);
  }

  dispose(): void {
    cancelAnimationFrame(this.animationId);
    this.replayController?.stop();
    this.renderer.dispose();
  }
}
