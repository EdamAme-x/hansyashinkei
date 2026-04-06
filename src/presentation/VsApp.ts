import type { GameConfig } from "@domain/entities/GameConfig";
import type { GameMode } from "@domain/entities/GameMode";
import type { ReplayEvent } from "@domain/entities/Replay";
import { createReplay } from "@domain/entities/Replay";
import { createVsScore } from "@domain/entities/Score";
import type { ServerMessage, VsPlayerState, VsOrbState } from "@shared/protocol";
import { VS_FIXED_DT } from "@shared/protocol";
import { createGameWorld, tick, dodge, undodge } from "@domain/entities/GameWorld";
import { mulberry32 } from "@domain/entities/Prng";
import { createVsWorldState, applyServerState, type VsWorldState } from "@domain/entities/VsGameWorld";
import { WsClient } from "./WsClient";
import { GameRenderer } from "./GameRenderer";
import type { ThemeConfig } from "@domain/entities/ThemeConfig";
import type { InputConfig } from "./InputConfig";
import type { ManageAchievement } from "@application/usecases/ManageAchievement";
import type { ManageScore } from "@application/usecases/ManageScore";
import type { ManageReplay } from "@application/usecases/ManageReplay";
import { AchievementToast } from "./AchievementToast";
import { AudioManager } from "./AudioManager";
import { createRoom } from "@infrastructure/api/VsApiClient";

type VsPhase = "connecting" | "waiting" | "countdown" | "playing" | "ended" | "error";

function base64Encode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export class VsApp {
  private ws: WsClient;
  private phase: VsPhase = "connecting";
  private playerIndex: 0 | 1 = 0;
  private roomId = "";
  private mode: GameMode = "classic";

  // Game state
  private selfVs: VsWorldState | null = null;
  private opponentState: VsPlayerState | null = null;
  private gameConfig: GameConfig | null = null;
  private animationId = 0;
  private localFrame = 0;
  private accumulator = 0;
  private lastTime = 0;

  // Recording for replay
  private seed = 0;
  private recordDts: number[] = [];
  private recordEvents: ReplayEvent[] = [];
  private opponentName = "";

  // Renderers
  private selfRenderer: GameRenderer | null = null;
  private opponentRenderer: GameRenderer | null = null;

  // UI elements
  private readonly selfContainer: HTMLElement;
  private readonly opponentContainer: HTMLElement | null;
  private readonly vsOverlay: HTMLElement;

  private readonly inputConfig: InputConfig;
  private readonly audio: AudioManager;
  private readonly manageAchievement: ManageAchievement;
  private readonly manageScore: ManageScore;
  private readonly manageReplay: ManageReplay;
  private readonly achievementToast: AchievementToast;
  private readonly theme: ThemeConfig;
  private readonly username: string;

  constructor(
    container: HTMLElement,
    theme: ThemeConfig,
    inputConfig: InputConfig,
    audio: AudioManager,
    manageAchievement: ManageAchievement,
    manageScore: ManageScore,
    manageReplay: ManageReplay,
    username: string,
  ) {
    this.theme = theme;
    this.inputConfig = inputConfig;
    this.audio = audio;
    this.manageAchievement = manageAchievement;
    this.manageScore = manageScore;
    this.manageReplay = manageReplay;
    this.achievementToast = new AchievementToast();
    this.username = username;
    this.ws = new WsClient();

    // Create split containers
    this.selfContainer = document.createElement("div");
    this.selfContainer.id = "vs-self";
    this.selfContainer.style.cssText = "position:absolute;left:0;top:0;width:50%;height:100%;";

    this.opponentContainer = document.createElement("div");
    this.opponentContainer.id = "vs-opponent";
    this.opponentContainer.style.cssText = "position:absolute;right:0;top:0;width:50%;height:100%;";

    // Mobile: hide opponent renderer, full-width self
    if (this.isMobile) {
      this.selfContainer.style.width = "100%";
      this.opponentContainer.style.display = "none";
    }

    container.appendChild(this.selfContainer);
    container.appendChild(this.opponentContainer);

    this.vsOverlay = document.getElementById("vs-overlay") ?? document.createElement("div");

    this.ws.onMessage((msg) => this.handleMessage(msg));
    this.ws.onClose(() => {
      if (this.phase === "playing") {
        this.phase = "ended";
        this.showResult("DISCONNECTED");
      }
    });

    this.setupInput();
  }

  private get isMobile(): boolean {
    return navigator.maxTouchPoints > 0 && matchMedia("(pointer: coarse)").matches;
  }

  /** Create a new room and connect. */
  async createAndJoin(mode: GameMode): Promise<void> {
    this.mode = mode;
    this.updateOverlay("ルーム作成中...");

    const { roomId } = await createRoom(mode);
    this.roomId = roomId;
    this.updateOverlay(`ルームID: ${roomId}\n相手を待っています...`);

    await this.ws.connect(roomId);
    this.sendJoin();
  }

  /** Join an existing room. */
  async join(roomId: string): Promise<void> {
    this.roomId = roomId;
    this.updateOverlay("接続中...");

    await this.ws.connect(roomId);
    this.sendJoin();
  }

  private sendJoin(): void {
    const keyPart = new Uint8Array(16);
    crypto.getRandomValues(keyPart);
    this.ws.send({ type: "join", username: this.username, keyPart: base64Encode(keyPart) });
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case "joined":
        this.playerIndex = msg.playerIndex;
        this.roomId = msg.roomId;
        this.mode = msg.mode;
        this.phase = "waiting";
        this.updateOverlay(`ルームID: ${this.roomId}\n相手を待っています...`);
        break;

      case "opponent_joined":
        this.opponentName = msg.username;
        this.updateOverlay(`${msg.username} が参加しました`);
        break;

      case "countdown":
        this.phase = "countdown";
        this.updateOverlay(msg.seconds > 0 ? String(msg.seconds) : "START!");
        break;

      case "game_start":
        this.startGame(msg.seed, msg.config);
        break;

      case "state":
        this.applyState(msg.frame, msg.players, msg.orbs);
        break;

      case "damage":
        this.onDamage(msg.targetPlayer, msg.amount, msg.source);
        break;

      case "heal":
        this.onHeal(msg.targetPlayer, msg.amount);
        break;

      case "game_over": {
        this.phase = "ended";
        const won = msg.winner === this.playerIndex;
        const vsResult = won ? "win" as const : "lose" as const;
        const selfFinal = msg.players[this.playerIndex];
        const oppFinal = msg.players[(1 - this.playerIndex) as 0 | 1];
        this.showResult(won ? "WIN" : "LOSE");
        this.saveVsResult(selfFinal.score, vsResult, oppFinal.score).catch(() => {});
        this.unlockVsAchievement();
        break;
      }

      case "error":
        this.phase = "error";
        this.updateOverlay(`ERROR: ${msg.message}`);
        break;
    }
  }

  private startGame(seed: number, config: GameConfig): void {
    this.gameConfig = config;
    this.seed = seed;
    this.phase = "playing";
    this.recordDts = [];
    this.recordEvents = [];

    // Hide overlay
    this.vsOverlay.classList.add("hidden");

    // Create renderers
    this.selfRenderer = new GameRenderer(this.selfContainer, config, this.theme);
    if (!this.isMobile && this.opponentContainer) {
      this.opponentRenderer = new GameRenderer(this.opponentContainer, config, this.theme);
    }

    // Create local world for prediction
    const world = createGameWorld(config, mulberry32(seed));
    this.selfVs = createVsWorldState(world);

    this.localFrame = 0;
    this.accumulator = 0;
    this.lastTime = performance.now();

    this.audio.startBgm();
    this.startLoop();
  }

  private applyState(_frame: number, players: [VsPlayerState, VsPlayerState], orbs: VsOrbState[]): void {
    if (!this.selfVs) return;

    const selfState = players[this.playerIndex];
    const opponentIdx = (1 - this.playerIndex) as 0 | 1;
    this.opponentState = players[opponentIdx];

    applyServerState(this.selfVs, selfState, orbs);

    // Update HP display
    this.updateHpDisplay();
  }

  private onDamage(target: 0 | 1, amount: number, source: "wall" | "orb"): void {
    const isSelf = target === this.playerIndex;
    if (isSelf) {
      this.showDamageFlash();
      if (source === "orb") this.audio.playDodge(); // orb hit feedback
    }
    this.showDamageNumber(isSelf ? "self" : "opponent", amount);
  }

  private onHeal(target: 0 | 1, amount: number): void {
    if (target === this.playerIndex && amount > 0) {
      this.updateHpDisplay();
    }
  }

  private startLoop(): void {
    this.lastTime = performance.now();

    const loop = (now: number) => {
      this.animationId = requestAnimationFrame(loop);
      if (this.phase !== "playing" || !this.selfVs) return;

      const elapsed = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;
      this.accumulator += elapsed;

      // Fixed timestep simulation
      while (this.accumulator >= VS_FIXED_DT) {
        // Keep world alive for VS (HP is managed by server)
        this.selfVs.world.alive = true;
        tick(this.selfVs.world, VS_FIXED_DT);
        this.recordDts.push(VS_FIXED_DT);
        this.localFrame++;
        this.accumulator -= VS_FIXED_DT;
      }

      // Render self
      if (this.selfRenderer) {
        // Invincibility blink
        const invincible = this.selfVs.invincibleUntilFrame > this.localFrame;
        if (invincible) {
          const blink = Math.floor(now / 120) % 2 === 0;
          this.selfRenderer.showBalls(blink);
        } else {
          this.selfRenderer.showBalls(true);
        }
        this.selfRenderer.sync(this.selfVs.world);
        this.selfRenderer.render();
      }

      // Render opponent (PC only)
      if (this.opponentRenderer && this.opponentState) {
        this.opponentRenderer.render();
      }
    };

    this.animationId = requestAnimationFrame(loop);
  }

  private setupInput(): void {
    const pressed = new Set<string>();

    window.addEventListener("keydown", (e) => {
      if (this.phase !== "playing" || pressed.has(e.code)) return;
      pressed.add(e.code);

      if (e.code === "Escape") {
        this.dispose();
        location.href = "/";
        return;
      }

      for (const binding of this.inputConfig.dodge) {
        if (e.code === binding.code) {
          this.doDodge(binding.ballIndex);
        }
      }
    });

    window.addEventListener("keyup", (e) => {
      pressed.delete(e.code);
      if (this.phase !== "playing") return;

      for (const binding of this.inputConfig.dodge) {
        if (e.code === binding.code) {
          this.doUndodge(binding.ballIndex);
        }
      }
    });

    // Touch
    const activeTouches = new Map<number, number>();
    const touchZone = (x: number): number => {
      const w = window.innerWidth;
      if (this.mode === "triple") {
        if (x < w / 3) return 0;
        if (x < (w * 2) / 3) return 2;
        return 1;
      }
      return x < w / 2 ? 0 : 1;
    };

    window.addEventListener("touchstart", (e) => {
      if (this.phase !== "playing") return;
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const ball = touchZone(t.clientX);
        activeTouches.set(t.identifier, ball);
        this.doDodge(ball);
      }
    }, { passive: false });

    const touchRelease = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const ball = activeTouches.get(t.identifier);
        if (ball !== undefined) {
          activeTouches.delete(t.identifier);
          if (this.phase === "playing") this.doUndodge(ball);
        }
      }
    };
    window.addEventListener("touchend", touchRelease);
    window.addEventListener("touchcancel", touchRelease);
  }

  private doDodge(ballIndex: number): void {
    if (!this.selfVs || !this.gameConfig) return;
    if (ballIndex >= this.gameConfig.balls.length) return;
    dodge(this.selfVs.world, ballIndex);
    this.ws.send({ type: "input", frame: this.localFrame, action: "dodge", ballIndex });
    this.recordEvents.push({ frame: this.localFrame, type: "dodge", ballIndex });
    this.audio.playDodge();
  }

  private doUndodge(ballIndex: number): void {
    if (!this.selfVs || !this.gameConfig) return;
    if (ballIndex >= this.gameConfig.balls.length) return;
    undodge(this.selfVs.world, ballIndex);
    this.ws.send({ type: "input", frame: this.localFrame, action: "undodge", ballIndex });
    this.recordEvents.push({ frame: this.localFrame, type: "undodge", ballIndex });
  }

  // ── UI helpers ──

  private updateOverlay(text: string): void {
    this.vsOverlay.classList.remove("hidden");
    const content = this.vsOverlay.querySelector(".vs-overlay-text");
    if (content) content.textContent = text;
  }

  private updateHpDisplay(): void {
    const selfHp = this.selfVs?.hp ?? 0;
    const oppHp = this.opponentState?.hp ?? 0;

    const selfBar = document.getElementById("vs-self-hp-fill");
    const oppBar = document.getElementById("vs-opponent-hp-fill");
    const selfLabel = document.getElementById("vs-self-hp-value");
    const oppLabel = document.getElementById("vs-opponent-hp-value");

    if (selfBar) selfBar.style.width = `${Math.max(0, selfHp / 10)}%`;
    if (oppBar) oppBar.style.width = `${Math.max(0, oppHp / 10)}%`;
    if (selfLabel) selfLabel.textContent = String(Math.max(0, selfHp));
    if (oppLabel) oppLabel.textContent = String(Math.max(0, oppHp));
  }

  private showDamageFlash(): void {
    const flash = document.getElementById("vs-damage-flash");
    if (!flash) return;
    flash.classList.remove("hidden");
    flash.classList.add("active");
    setTimeout(() => {
      flash.classList.remove("active");
      flash.classList.add("hidden");
    }, 300);
  }

  private showDamageNumber(target: "self" | "opponent", amount: number): void {
    const container = document.getElementById(target === "self" ? "vs-self-damage" : "vs-opponent-damage");
    if (!container) return;

    const el = document.createElement("div");
    el.className = "vs-damage-num";
    el.textContent = `-${amount}`;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add("float-up"));
    setTimeout(() => el.remove(), 1000);
  }

  private showResult(result: string): void {
    this.audio.stopBgm();
    const overlay = document.getElementById("vs-result");
    if (overlay) {
      overlay.classList.remove("hidden");
      const text = overlay.querySelector(".vs-result-text");
      if (text) text.textContent = result;
    }
  }

  private async saveVsResult(
    finalScore: number,
    vsResult: "win" | "lose" | "disconnect",
    opponentScore: number,
  ): Promise<void> {
    if (!this.gameConfig) return;

    const replayId = crypto.randomUUID();
    const replay = createReplay(
      replayId, "", this.seed, this.gameConfig, finalScore,
      this.recordDts, this.recordEvents,
    );
    await this.manageReplay.save(replay);

    const scoreId = crypto.randomUUID();
    const vsScore = createVsScore(
      scoreId, finalScore, this.mode, vsResult,
      this.opponentName, opponentScore, replayId,
    );
    await this.manageScore.record(
      vsScore.value, vsScore.mode, vsScore.replayId, vsScore.vsResult,
      vsScore.opponentName, vsScore.opponentScore,
    );
  }

  private async unlockVsAchievement(): Promise<void> {
    try {
      const score = { kind: "solo" as const, id: crypto.randomUUID(), value: 0, timestamp: Date.now(), replayId: null, mode: this.mode as "classic" | "triple" };
      const unlocked = await this.manageAchievement.evaluateAndUnlock(score, 0, true);
      if (unlocked.length > 0) this.achievementToast.show(unlocked);
    } catch { /* non-critical */ }
  }

  dispose(): void {
    cancelAnimationFrame(this.animationId);
    this.ws.close();
    this.selfRenderer?.dispose();
    this.opponentRenderer?.dispose();
    this.selfContainer.remove();
    this.opponentContainer?.remove();
  }
}
