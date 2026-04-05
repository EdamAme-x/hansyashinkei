import { StateMachine, GameState, GameEvent } from "@domain/entities/StateMachine";
import type { GameConfig } from "@domain/entities/GameConfig";
import { createTripleConfig } from "@domain/entities/GameConfig";
import type { GameMode } from "@domain/entities/GameMode";
import type { Replay, ReplayEvent } from "@domain/entities/Replay";
import { createReplay } from "@domain/entities/Replay";
import { createGameWorld, dodge, undodge, tick, getSpeedTier, type GameWorldState } from "@domain/entities/GameWorld";
import { mulberry32, generateSeed } from "@domain/entities/Prng";
import { ManageScore } from "@application/usecases/ManageScore";
import { ManageReplay } from "@application/usecases/ManageReplay";
import type { BestScoreRepository } from "@domain/repositories/BestScoreRepository";
import type { InputConfig } from "./InputConfig";
import { codeToLabel } from "./InputConfig";
import { GameRenderer } from "./GameRenderer";
import { HUD } from "./HUD";
import { ReplayController } from "./ReplayController";
import { HistoryUI } from "./HistoryUI";
import { KeybindUI } from "./KeybindUI";
import { AudioManager } from "./AudioManager";
import type { ThemeManager } from "./ThemeManager";
import { ThemeUI } from "./ThemeUI";
import type { IImageStore } from "@domain/repositories/ImageStore";
import type { ModeRepository } from "@domain/repositories/ModeRepository";
import type { KVStore } from "@domain/repositories/KVStore";
import type { ManageSave } from "@application/usecases/ManageSave";
import type { ManageAchievement } from "@application/usecases/ManageAchievement";
import { AchievementUI } from "./AchievementUI";
import { AchievementToast } from "./AchievementToast";
import { getSkinDef } from "@domain/entities/SkinDefs";
import { downloadBlob } from "./dom";

interface RecordingSession {
  seed: number;
  dts: number[];
  events: ReplayEvent[];
  frameCount: number;
}

export class App {
  private readonly sm = new StateMachine();
  private renderer: GameRenderer;
  private readonly hud: HUD;
  private readonly historyUI: HistoryUI;
  private readonly keybindUI: KeybindUI;
  private readonly themeUI: ThemeUI;
  private readonly audio: AudioManager;
  private readonly manageSave: ManageSave;
  private readonly manageScore: ManageScore;
  private readonly manageReplay: ManageReplay;
  private readonly manageAchievement: ManageAchievement;
  private readonly bestScoreRepo: BestScoreRepository;
  private readonly modeRepo: ModeRepository;
  private readonly achievementUI: AchievementUI;
  private readonly achievementToast: AchievementToast;
  private readonly _classicConfig: GameConfig;
  private activeMode: GameMode = "classic";
  private inputConfig: InputConfig;

  private get gameConfig(): GameConfig {
    return this.activeMode === "triple" ? createTripleConfig() : this._classicConfig;
  }

  private world: GameWorldState;
  private animationId = 0;
  private lastTime = 0;
  private bestScore = 0;
  private bestReplayId: string | null = null;
  private lastTier = 0;
  private recording: RecordingSession | null = null;
  private replayController: ReplayController | null = null;
  private renderDirty = true;

  constructor(
    container: HTMLElement,
    manageScore: ManageScore,
    manageReplay: ManageReplay,
    bestScoreRepo: BestScoreRepository,
    gameConfig: GameConfig,
    inputConfig: InputConfig,
    themeManager: ThemeManager,
    imageStore: IImageStore,
    manageSave: ManageSave,
    modeRepo: ModeRepository,
    kv: KVStore,
    manageAchievement: ManageAchievement,
  ) {
    const theme = themeManager.current;
    this._classicConfig = gameConfig;
    this.modeRepo = modeRepo;
    this.activeMode = modeRepo.load();
    this.inputConfig = inputConfig;
    this.renderer = new GameRenderer(container, this.gameConfig, theme);
    this.audio = new AudioManager(theme.audio, kv);
    this.hud = new HUD();
    this.manageSave = manageSave;
    this.manageScore = manageScore;
    this.manageReplay = manageReplay;
    this.bestScoreRepo = bestScoreRepo;
    this.world = createGameWorld(this.gameConfig, mulberry32(generateSeed()));

    this.historyUI = new HistoryUI(
      manageReplay,
      (replay) => this.watchReplay(replay),
      () => {},
    );

    this.keybindUI = new KeybindUI(
      inputConfig,
      kv,
      (updated) => {
        this.inputConfig = updated;
        this.updateKeyHints();
      },
      () => {},
    );

    this.themeUI = new ThemeUI(themeManager, imageStore);
    this.manageAchievement = manageAchievement;
    this.achievementToast = new AchievementToast();
    this.achievementUI = new AchievementUI(manageAchievement);
    this.achievementUI.onSkinChanged = (skinId) => {
      this.renderer.applyActiveSkin(getSkinDef(skinId));
      this.renderDirty = true;
    };

    // Load active skin on startup
    manageAchievement.getActiveSkinId().then((skinId) => {
      this.renderer.applyActiveSkin(getSkinDef(skinId));
      this.renderDirty = true;
    }).catch(() => {});

    // Verify achievements on startup (async, non-blocking)
    manageAchievement.verifyAllOnLoad().catch(() => {});

    // Real-time theme update
    themeManager.onChange((newTheme) => {
      this.renderer.applyTheme(newTheme);
      this.renderDirty = true;
    });

    this.sm.onStateChange((_prev, next) => this.onStateChange(next));

    this.setupInput();
    this.setupResize();
    this.setupTitleButtons();
    this.hud.show(GameState.Title);
    this.updateKeyHints();
    document.getElementById("mode-classic")?.classList.toggle("active", this.activeMode === "classic");
    document.getElementById("mode-triple")?.classList.toggle("active", this.activeMode === "triple");
    this.startLoop();
    this.loadBestScore(this.activeMode).catch(() => {});
  }

  private async loadBestScore(mode: GameMode): Promise<void> {
    // Load the given mode's best score
    const stored = await this.bestScoreRepo.load(mode);
    if (stored) {
      this.bestScore = stored.score;
      this.bestReplayId = stored.replayId;
    } else {
      this.bestScore = 0;
      this.bestReplayId = null;
    }

    // Also check current history in case meta store was cleared
    const history = await this.manageScore.getHistory(mode);
    if (history.bestScore && history.bestScore.value > this.bestScore) {
      this.bestScore = history.bestScore.value;
      this.bestReplayId = history.bestScore.replayId;
      this.persistBestScore();
    }

    // Show highest best score across both modes with its mode label
    const classicRecord = await this.bestScoreRepo.load("classic");
    const tripleRecord = await this.bestScoreRepo.load("triple");

    const classicBest = classicRecord?.score ?? 0;
    const tripleBest = tripleRecord?.score ?? 0;

    const best = Math.max(classicBest, tripleBest);
    this.hud.updateTitleBest(best);
  }

  private persistBestScore(): void {
    this.bestScoreRepo.save(this.activeMode, {
      score: this.bestScore,
      replayId: this.bestReplayId,
    }).catch(() => {});
  }

  private onStateChange(state: GameState): void {
    this.hud.show(state);
    this.renderDirty = true;

    if (state === GameState.Playing) this.onEnterPlaying();
    else if (state === GameState.GameOver) this.onEnterGameOver();
    else if (state === GameState.Title) this.onEnterTitle();
    else if (state === GameState.Watching) this.onEnterWatching();
  }

  private onEnterPlaying(): void {
    const seed = generateSeed();
    this.world = createGameWorld(this.gameConfig, mulberry32(seed));
    this.lastTier = 0;

    this.recording = {
      seed,
      dts: [],
      events: [],
      frameCount: 0,
    };
    this.renderer.clearWalls();
    this.renderer.clearShards();
    this.renderer.showBalls(true);
    this.hud.updateScore(0);
    this.audio.playStart();
    this.audio.startBgm();
  }

  private onEnterGameOver(): void {
    // Explode the ball(s) that collided
    for (let i = 0; i < this.world.balls.length; i++) {
      for (const wall of this.world.walls) {
        if (this.world.balls[i].lane === wall.lane) {
          this.renderer.explodeBall(i);
          break;
        }
      }
    }
    this.audio.stopBgm();
    this.audio.playDeath();
    const isNewBest = this.world.score > this.bestScore;
    if (isNewBest) {
      this.bestScore = this.world.score;
      this.audio.playNewBest();
    }
    this.hud.showGameOver(this.world.score, this.bestScore, isNewBest, this.gameConfig.balls.length);
    this.saveRecording(isNewBest).catch(() => {});
    // Achievement evaluation happens after saveRecording stores the score
  }

  private onEnterTitle(): void {
    this.audio.stopBgm();
    this.renderer.clearWalls();
    this.renderer.clearShards();
    this.renderer.showBalls(true);
    this.recording = null;
    this.loadBestScore(this.activeMode).catch(() => {});
  }

  private onEnterWatching(): void {
    this.renderer.clearWalls();
  }

  private async saveRecording(isNewBest: boolean): Promise<void> {
    if (!this.recording) return;

    // Snapshot mutable state immediately before any await so that a rapid
    // restart cannot overwrite this.recording / this.world mid-flight.
    const snapshot = this.recording;
    const finalScore = this.world.score;
    this.recording = null;

    const replayId = crypto.randomUUID();
    const scoreId = await this.manageScore.record(
      finalScore,
      this.activeMode,
      replayId,
    );

    const replay = createReplay(
      replayId,
      scoreId,
      snapshot.seed,
      this.gameConfig,
      finalScore,
      snapshot.dts,
      snapshot.events,
    );

    await this.manageReplay.save(replay);

    if (isNewBest) {
      this.bestReplayId = replayId;
      this.persistBestScore();
    }

    await this.manageReplay.prune(this.bestReplayId);

    // Evaluate achievements after score + replay are stored
    try {
      const score = { id: scoreId, value: finalScore, timestamp: Date.now(), replayId, mode: this.activeMode };
      const unlocked = await this.manageAchievement.evaluateAndUnlock(score);
      if (unlocked.length > 0) {
        this.achievementToast.show(unlocked);
      }
    } catch {
      // non-critical
    }
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

  setMode(mode: GameMode): void {
    if (this.activeMode === mode) return;
    if (this.sm.state !== GameState.Title) return;
    this.activeMode = mode;
    this.modeRepo.save(mode);

    // Reconfigure renderer in-place (no canvas replacement)
    this.renderer.reconfigure(this.gameConfig);

    // Reset world for new config
    this.world = createGameWorld(this.gameConfig, mulberry32(generateSeed()));

    // Update mode button active states
    document.getElementById("mode-classic")?.classList.toggle("active", mode === "classic");
    document.getElementById("mode-triple")?.classList.toggle("active", mode === "triple");

    this.loadBestScore(mode).catch(() => {});
    this.updateKeyHints();
    this.renderDirty = true;
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
    document.getElementById("back-to-title-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.sm.dispatch(GameEvent.BackToTitle);
    });

    // Mode selector buttons
    document.getElementById("mode-classic")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.setMode("classic");
    });
    document.getElementById("mode-triple")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.setMode("triple");
    });

    // Settings screen
    const settingsScreen = document.getElementById("settings-screen");
    document.getElementById("btn-settings")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.updateSoundLabel();
      settingsScreen?.classList.remove("hidden");
    });
    document.getElementById("settings-close")?.addEventListener("click", () => {
      settingsScreen?.classList.add("hidden");
    });

    // Settings items
    document.getElementById("settings-keys")?.addEventListener("click", () => {
      settingsScreen?.classList.add("hidden");
      this.keybindUI.show();
    });

    document.getElementById("settings-sound")?.addEventListener("click", () => {
      this.audio.toggle();
      this.updateSoundLabel();
    });

    document.getElementById("settings-theme")?.addEventListener("click", () => {
      settingsScreen?.classList.add("hidden");
      this.themeUI.show();
    });

    document.getElementById("settings-achievements")?.addEventListener("click", () => {
      settingsScreen?.classList.add("hidden");
      this.achievementUI.show();
    });

    // Settings-only export (no data destruction)
    document.getElementById("settings-export-settings")?.addEventListener("click", async () => {
      const data = await this.manageSave.exportSettings();
      downloadBlob(new Uint8Array(data), `hs-settings-${Date.now()}.hss`);
    });

    // Full migration export (destroys all browser data after download)
    document.getElementById("settings-export-migrate")?.addEventListener("click", async () => {
      const ok = window.confirm(
        "MIGRATE: Export all data and DELETE everything on this device.\n\n" +
        "After export, this device's data will be permanently erased.\n" +
        "Continue?",
      );
      if (!ok) return;
      const data = await this.manageSave.exportSave();
      downloadBlob(new Uint8Array(data), `hs-migrate-${Date.now()}.hss`);
      await this.manageSave.nukeAfterExport();
      location.reload();
    });

    const importInput = document.getElementById("save-import-file") as HTMLInputElement | null;
    document.getElementById("settings-import")?.addEventListener("click", () => {
      importInput?.click();
    });
    importInput?.addEventListener("change", async () => {
      const file = importInput.files?.[0];
      if (!file) return;
      const buf = await file.arrayBuffer();
      const result = await this.manageSave.importSave(new Uint8Array(buf));
      if (result.success) {
        location.reload();
      }
      importInput.value = "";
    });
  }

  private updateSoundLabel(): void {
    const label = document.getElementById("settings-sound-label");
    if (label) label.textContent = this.audio.enabled ? "SOUND ON" : "SOUND OFF";
  }

  private setupResize(): void {
    let timer = 0;
    window.addEventListener("resize", () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        this.renderer.resize(window.innerWidth, window.innerHeight);
      }, 100);
    });
  }

  private updateKeyHints(): void {
    const keysEl = document.getElementById("title-keys");

    if (this.isTouchOnly) {
      if (keysEl) keysEl.textContent = this.activeMode === "triple"
        ? "TAP LEFT / MID / RIGHT"
        : "TAP LEFT / RIGHT";
    } else if (this.activeMode === "triple") {
      const leftCodes = this.inputConfig.dodge
        .filter((b) => b.ballIndex === 0)
        .map((b) => codeToLabel(b.code));
      const midCodes = this.inputConfig.dodge
        .filter((b) => b.ballIndex === 2)
        .map((b) => codeToLabel(b.code));
      const rightCodes = this.inputConfig.dodge
        .filter((b) => b.ballIndex === 1)
        .map((b) => codeToLabel(b.code));
      // triple: ball0=left, ball1=right(J/→), ball2=middle(B/↓)
      const left = leftCodes.join("/") || "?";
      const mid = midCodes.join("/") || "?";
      const right = rightCodes.join("/") || "?";
      if (keysEl) keysEl.textContent = `${left}  ${mid}  ${right}`;
    } else {
      const leftCodes = this.inputConfig.dodge
        .filter((b) => b.ballIndex === 0)
        .map((b) => codeToLabel(b.code));
      const rightCodes = this.inputConfig.dodge
        .filter((b) => b.ballIndex === 1)
        .map((b) => codeToLabel(b.code));
      const left = leftCodes.join("/") || "?";
      const right = rightCodes.join("/") || "?";
      if (keysEl) keysEl.textContent = `${left}  ${right}`;
    }
  }

  private get isTouchOnly(): boolean {
    return navigator.maxTouchPoints > 0 && matchMedia("(pointer: coarse)").matches;
  }

  private setupInput(): void {
    const pressed = new Set<string>();

    // Keyboard
    const settingsEl = document.getElementById("settings-screen");

    window.addEventListener("keydown", (e) => {
      if (pressed.has(e.code)) return;
      pressed.add(e.code);

      // Close overlay screens with Esc/Backspace (innermost first)
      if (e.code === "Escape" || e.code === "Backspace") {
        if (this.achievementUI.isOpen()) { this.achievementUI.hide(); return; }
        if (this.themeUI.isOpen()) { this.themeUI.hide(); return; }
        if (this.keybindUI.isOpen()) { this.keybindUI.hide(); return; }
        if (this.historyUI.isOpen()) { this.historyUI.hide(); return; }
        if (settingsEl && !settingsEl.classList.contains("hidden")) {
          settingsEl.classList.add("hidden"); return;
        }
      }

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
        if (e.code === "Escape" || e.code === "Backspace") {
          this.sm.dispatch(GameEvent.BackToTitle);
          return;
        }
      }

      if (this.sm.state === GameState.Playing || this.sm.state === GameState.Watching) {
        if (e.code === "Escape" || e.code === "Backspace") {
          this.replayController?.stop();
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

    // Touch zones: classic = 2 zones (left/right), triple = 3 zones (left/mid/right)
    const activeTouches = new Map<number, number>(); // touchId → ballIndex
    const zoneLeft = document.getElementById("touch-zone-left");
    const zoneRight = document.getElementById("touch-zone-right");

    const touchZone = (x: number): number => {
      const w = window.innerWidth;
      if (this.activeMode === "triple") {
        if (x < w / 3) return 0;       // left
        if (x < (w * 2) / 3) return 2; // middle (ballIndex 2)
        return 1;                       // right (ballIndex 1)
      }
      return x < w / 2 ? 0 : 1;
    };

    const updateZones = (): void => {
      const sides = new Set(activeTouches.values());
      zoneLeft?.classList.toggle("active", sides.has(0));
      zoneRight?.classList.toggle("active", sides.has(1));
    };

    window.addEventListener("touchstart", (e) => {
      if (this.sm.state !== GameState.Playing) return;
      e.preventDefault();

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const ballIndex = touchZone(touch.clientX);
        activeTouches.set(touch.identifier, ballIndex);
        this.recordDodge(ballIndex);
      }
      updateZones();
    }, { passive: false });

    const handleTouchRelease = (e: TouchEvent): void => {
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
    };

    window.addEventListener("touchend", handleTouchRelease);
    window.addEventListener("touchcancel", handleTouchRelease);
  }

  private recordDodge(ballIndex: number): void {
    dodge(this.world, ballIndex);
    this.audio.playDodge();
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
    const history = await this.manageScore.getHistory(this.activeMode);
    await this.historyUI.show(history, this.manageScore);
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
          this.audio.playSpeedUp();
        }

        if (!this.world.alive) {
          this.sm.dispatch(GameEvent.Die);
        } else {
          this.renderer.sync(this.world);
        }
      }

      if (this.sm.state === GameState.Playing || this.renderDirty) {
        this.renderer.updateSkinPulse(now / 1000);
        this.renderer.render();
        this.renderDirty = false;
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
