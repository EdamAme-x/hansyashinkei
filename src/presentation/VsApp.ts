import type { GameConfig } from "@domain/entities/GameConfig";
import type { GameMode } from "@domain/entities/GameMode";
import type { ReplayEvent } from "@domain/entities/Replay";
import { createReplay } from "@domain/entities/Replay";
import { createVsScore } from "@domain/entities/Score";
import type { ServerMessage, VsPlayerState, VsOrbState } from "@shared/protocol";
import { VS_FIXED_DT } from "@shared/protocol";
import { createGameWorld, tick, dodge, undodge, type GameWorldState } from "@domain/entities/GameWorld";
import { mulberry32 } from "@domain/entities/Prng";
import { createVsWorldState, applyServerState, type VsWorldState } from "@domain/entities/VsGameWorld";
import { WsClient } from "./WsClient";
import { GameRenderer } from "./GameRenderer";
import type { ThemeConfig } from "@domain/entities/ThemeConfig";
import type { InputConfig } from "./InputConfig";
import type { ManageAchievement } from "@application/usecases/ManageAchievement";
import type { ManageScore } from "@application/usecases/ManageScore";
import type { ManageReplay } from "@application/usecases/ManageReplay";
import type { VsMatchService } from "@application/usecases/VsMatchService";
import { AchievementToast } from "./AchievementToast";
import { AudioManager } from "./AudioManager";
import { setupCustomCursor } from "./CustomCursor";
import { getSkinDef } from "@domain/entities/SkinDefs";

type VsPhase = "connecting" | "waiting" | "countdown" | "playing" | "ended" | "error";

function base64Encode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

// Solo UI elements to hide in VS mode
const SOLO_UI_IDS = [
  "title-screen", "gameover-screen", "score-display", "speedup-display",
  "replay-bar", "replay-indicator", "history-screen", "settings-screen",
  "keybind-screen", "theme-screen", "achievement-screen",
];

export class VsApp {
  private ws: WsClient;
  private phase: VsPhase = "connecting";
  private playerIndex: 0 | 1 = 0;
  private roomId = "";
  private mode: GameMode = "classic";

  private selfVs: VsWorldState | null = null;
  private opponentWorld: GameWorldState | null = null;
  private opponentState: VsPlayerState | null = null;
  private gameConfig: GameConfig | null = null;
  private animationId = 0;
  private localFrame = 0;
  private accumulator = 0;
  private lastTime = 0;

  private seed = 0;
  private recordDts: number[] = [];
  private recordEvents: ReplayEvent[] = [];
  private opponentName = "";
  private combinedKey: Uint8Array | null = null;
  private readonly inputAbort = new AbortController();

  private selfRenderer: GameRenderer | null = null;
  private opponentRenderer: GameRenderer | null = null;

  private readonly selfContainer: HTMLElement;
  private readonly opponentContainer: HTMLElement;
  private readonly vsOverlay: HTMLElement;

  private readonly inputConfig: InputConfig;
  private readonly audio: AudioManager;
  private readonly manageAchievement: ManageAchievement;
  private readonly manageScore: ManageScore;
  private readonly manageReplay: ManageReplay;
  private readonly vsMatch: VsMatchService;
  private readonly achievementToast: AchievementToast;
  private readonly theme: ThemeConfig;
  private readonly username: string;
  private activeSkinId = "skin_default";
  private opponentReady = false;

  constructor(
    container: HTMLElement,
    theme: ThemeConfig,
    inputConfig: InputConfig,
    audio: AudioManager,
    manageAchievement: ManageAchievement,
    manageScore: ManageScore,
    manageReplay: ManageReplay,
    vsMatch: VsMatchService,
    username: string,
  ) {
    this.theme = theme;
    this.inputConfig = inputConfig;
    this.audio = audio;
    this.manageAchievement = manageAchievement;
    this.manageScore = manageScore;
    this.manageReplay = manageReplay;
    this.vsMatch = vsMatch;
    this.achievementToast = new AchievementToast();
    this.username = username;
    this.ws = new WsClient();

    // Hide solo UI
    for (const id of SOLO_UI_IDS) {
      const el = document.getElementById(id);
      if (el) el.classList.add("hidden");
    }

    // Split containers
    this.selfContainer = document.createElement("div");
    this.selfContainer.id = "vs-self";
    this.opponentContainer = document.createElement("div");
    this.opponentContainer.id = "vs-opponent";

    if (this.isMobile) {
      this.selfContainer.style.cssText = "position:absolute;inset:0;";
      this.opponentContainer.style.cssText = "display:none;";
    } else {
      this.selfContainer.style.cssText = "position:absolute;left:0;top:0;width:50%;height:100%;";
      this.opponentContainer.style.cssText = "position:absolute;right:0;top:0;width:50%;height:100%;border-left:1px solid rgba(255,255,255,0.1);";
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
    this.setupResize();
    setupCustomCursor(() => this.phase === "playing");

    // Load active skin
    manageAchievement.getActiveSkinId().then((id) => { this.activeSkinId = id; }).catch(() => {});
  }

  private get isMobile(): boolean {
    return navigator.maxTouchPoints > 0 && matchMedia("(pointer: coarse)").matches;
  }

  async createAndJoin(mode: GameMode): Promise<void> {
    this.mode = mode;
    this.updateOverlay("ルーム作成中...");
    const { roomId } = await this.vsMatch.createRoom(mode);
    this.roomId = roomId;
    this.updateOverlay(`ルーム: ${roomId}\n相手を待っています...`);
    await this.ws.connect(this.vsMatch.getWsUrl(roomId));
    this.sendJoin();
  }

  async join(roomId: string): Promise<void> {
    this.roomId = roomId;
    this.updateOverlay("接続中...");
    await this.ws.connect(this.vsMatch.getWsUrl(roomId));
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
        this.updateOverlay(`ルーム: ${this.roomId}\n相手を待っています...`);
        break;
      case "opponent_joined":
        this.opponentName = msg.username;
        this.updateOverlay(`${msg.username} が参加しました\n準備ができたらREADYを押してください`);
        this.showReadyButton();
        break;
      case "opponent_ready":
        this.opponentReady = true;
        this.updateReadyStatus();
        break;
      case "key_exchange": {
        const bin = atob(msg.combinedKey);
        this.combinedKey = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) this.combinedKey[i] = bin.charCodeAt(i);
        this.ws.setDecryptKey(this.combinedKey);
        break;
      }
      case "countdown":
        this.phase = "countdown";
        if (msg.seconds > 0) this.audio.playCountdownTick();
        else this.audio.playStart();
        this.updateOverlay(msg.seconds > 0 ? String(msg.seconds) : "START!");
        break;
      case "game_start":
        this.startGame(msg.seed, msg.config);
        break;
      case "state":
        this.verifyAndApplyState(msg).catch(() => {});
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

    this.vsOverlay.classList.add("hidden");

    // Show HP bars
    document.getElementById("vs-hp-container")?.classList.remove("hidden");

    // Create renderers
    this.selfRenderer = new GameRenderer(this.selfContainer, config, this.theme);
    this.selfRenderer.applyActiveSkin(getSkinDef(this.activeSkinId));
    if (!this.isMobile) {
      this.opponentRenderer = new GameRenderer(this.opponentContainer, config, this.theme);
    }

    // Create local worlds — same seed for identical wall patterns
    const selfWorld = createGameWorld(config, mulberry32(seed));
    this.selfVs = createVsWorldState(selfWorld);
    this.opponentWorld = createGameWorld(config, mulberry32(seed));

    this.localFrame = 0;
    this.accumulator = 0;
    this.lastTime = performance.now();

    this.audio.startBgm();
    this.startLoop();
  }

  private async verifyAndApplyState(msg: Extract<ServerMessage, { type: "state" }>): Promise<void> {
    if (this.combinedKey && msg.hmac) {
      const payload = JSON.stringify({ frame: msg.frame, players: msg.players, orbs: msg.orbs });
      const keyBuf = new Uint8Array(this.combinedKey.buffer, this.combinedKey.byteOffset, this.combinedKey.byteLength) as Uint8Array<ArrayBuffer>;
      const cryptoKey = await crypto.subtle.importKey("raw", keyBuf, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
      const sigBin = atob(msg.hmac);
      const sigBytes = new Uint8Array(sigBin.length);
      for (let i = 0; i < sigBin.length; i++) sigBytes[i] = sigBin.charCodeAt(i);
      const sigBuf = new Uint8Array(sigBytes.buffer, sigBytes.byteOffset, sigBytes.byteLength) as Uint8Array<ArrayBuffer>;
      const valid = await crypto.subtle.verify("HMAC", cryptoKey, sigBuf, new TextEncoder().encode(payload));
      if (!valid) console.warn("[VS] HMAC verification failed");
    }
    this.applyState(msg.players, msg.orbs);
  }

  private applyState(players: [VsPlayerState, VsPlayerState], orbs: VsOrbState[]): void {
    if (!this.selfVs) return;

    const selfState = players[this.playerIndex];
    const opponentIdx = (1 - this.playerIndex) as 0 | 1;
    this.opponentState = players[opponentIdx];

    applyServerState(this.selfVs, selfState, orbs);

    // Sync opponent ball positions from server state
    if (this.opponentWorld && this.opponentState) {
      for (let i = 0; i < this.opponentWorld.balls.length && i < this.opponentState.dodging.length; i++) {
        const serverDodging = this.opponentState.dodging[i];
        if (this.opponentWorld.balls[i].dodging !== serverDodging) {
          if (serverDodging) {
            dodge(this.opponentWorld, i);
          } else {
            undodge(this.opponentWorld, i);
          }
        }
      }
    }

    // Sync orbs — only show orbs targeting each player's view
    const selfOrbs = orbs.filter((o) => o.targetPlayer === this.playerIndex);
    const oppOrbs = orbs.filter((o) => o.targetPlayer !== this.playerIndex);
    if (this.selfRenderer) this.selfRenderer.syncOrbs(selfOrbs);
    if (this.opponentRenderer) this.opponentRenderer.syncOrbs(oppOrbs);

    this.updateHpDisplay();
  }

  private onDamage(target: 0 | 1, amount: number, source: "wall" | "orb"): void {
    const isSelf = target === this.playerIndex;
    if (isSelf) {
      this.showDamageFlash();
      this.audio.playHit();
    } else {
      // Dealt damage to opponent
      if (source === "orb") this.audio.playOrbDamage();
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

      while (this.accumulator >= VS_FIXED_DT) {
        this.selfVs.world.alive = true;
        tick(this.selfVs.world, VS_FIXED_DT);

        // Also tick opponent world for wall prediction
        if (this.opponentWorld) {
          this.opponentWorld.alive = true;
          tick(this.opponentWorld, VS_FIXED_DT);
        }

        this.recordDts.push(VS_FIXED_DT);
        this.localFrame++;
        this.accumulator -= VS_FIXED_DT;
      }

      // Render self
      if (this.selfRenderer) {
        const invincible = this.selfVs.invincibleUntilFrame > this.localFrame;
        if (invincible) {
          this.selfRenderer.showBalls(Math.floor(now / 120) % 2 === 0);
        } else {
          this.selfRenderer.showBalls(true);
        }
        this.selfRenderer.sync(this.selfVs.world);
        this.selfRenderer.render();
      }

      // Render opponent
      if (this.opponentRenderer && this.opponentWorld) {
        const oppInvinc = this.opponentState && this.opponentState.invincibleUntilFrame > this.localFrame;
        if (oppInvinc) {
          this.opponentRenderer.showBalls(Math.floor(now / 120) % 2 === 0);
        } else {
          this.opponentRenderer.showBalls(true);
        }
        this.opponentRenderer.sync(this.opponentWorld);
        this.opponentRenderer.render();
      }
    };

    this.animationId = requestAnimationFrame(loop);
  }

  private setupInput(): void {
    const pressed = new Set<string>();
    const signal = this.inputAbort.signal;

    window.addEventListener("keydown", (e) => {
      if (this.phase !== "playing" || pressed.has(e.code)) return;
      pressed.add(e.code);
      if (e.code === "Escape") { this.dispose(); location.href = "/"; return; }
      for (const b of this.inputConfig.dodge) {
        if (e.code === b.code) this.doDodge(b.ballIndex);
      }
    }, { signal });

    window.addEventListener("keyup", (e) => {
      pressed.delete(e.code);
      if (this.phase !== "playing") return;
      for (const b of this.inputConfig.dodge) {
        if (e.code === b.code) this.doUndodge(b.ballIndex);
      }
    }, { signal });

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
    }, { passive: false, signal });

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
    window.addEventListener("touchend", touchRelease, { signal });
    window.addEventListener("touchcancel", touchRelease, { signal });
  }

  private setupResize(): void {
    let timer = 0;
    window.addEventListener("resize", () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (this.isMobile) {
          this.selfRenderer?.resize(w, h);
        } else {
          const half = Math.floor(w / 2);
          this.selfRenderer?.resize(half, h);
          this.opponentRenderer?.resize(half, h);
        }
      }, 100);
    }, { signal: this.inputAbort.signal });
  }

  private doDodge(ballIndex: number): void {
    if (!this.selfVs || !this.gameConfig || ballIndex >= this.gameConfig.balls.length) return;
    dodge(this.selfVs.world, ballIndex);
    this.ws.send({ type: "input", frame: this.localFrame, action: "dodge", ballIndex });
    this.recordEvents.push({ frame: this.localFrame, type: "dodge", ballIndex });
    this.audio.playDodge();
  }

  private doUndodge(ballIndex: number): void {
    if (!this.selfVs || !this.gameConfig || ballIndex >= this.gameConfig.balls.length) return;
    undodge(this.selfVs.world, ballIndex);
    this.ws.send({ type: "input", frame: this.localFrame, action: "undodge", ballIndex });
    this.recordEvents.push({ frame: this.localFrame, type: "undodge", ballIndex });
  }

  // ── UI ──

  private updateOverlay(text: string): void {
    this.vsOverlay.classList.remove("hidden");
    const content = this.vsOverlay.querySelector(".vs-overlay-text");
    if (content) content.textContent = text;

    // Show room ID + copy button + rules when waiting
    const roomIdEl = document.getElementById("vs-room-id");
    const copyBtn = document.getElementById("vs-copy-btn");
    const rulesEl = document.getElementById("vs-rules");

    if (this.phase === "waiting" && this.roomId) {
      if (roomIdEl) { roomIdEl.textContent = this.roomId; roomIdEl.style.display = ""; }
      if (copyBtn) {
        copyBtn.style.display = "";
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(`${location.origin}?vs=${this.roomId}`).catch(() => {});
          copyBtn.textContent = "コピーしました!";
          setTimeout(() => { copyBtn.textContent = "URLをコピー"; }, 1500);
        };
      }
      if (rulesEl) rulesEl.style.display = "";
    } else {
      if (roomIdEl) roomIdEl.style.display = "none";
      if (copyBtn) copyBtn.style.display = "none";
      if (rulesEl) rulesEl.style.display = this.phase === "countdown" ? "" : "none";
    }
  }

  private showReadyButton(): void {
    let btn = document.getElementById("vs-ready-btn");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "vs-ready-btn";
      btn.className = "vs-copy-btn";
      btn.style.marginTop = "1rem";
      btn.style.fontSize = "1.1rem";
      btn.style.padding = "0.7em 3em";
      btn.textContent = "READY";
      this.vsOverlay.appendChild(btn);
    }
    btn.style.display = "";
    btn.onclick = () => {
      this.ws.send({ type: "ready" });
      btn.textContent = "READY!";
      btn.style.opacity = "0.5";
      btn.style.pointerEvents = "none";
      this.updateReadyStatus();
    };
  }

  private updateReadyStatus(): void {
    const btn = document.getElementById("vs-ready-btn");
    if (this.opponentReady && btn) {
      const content = this.vsOverlay.querySelector(".vs-overlay-text");
      if (content) content.textContent = `${this.opponentName} は準備完了！`;
    }
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
    setTimeout(() => { flash.classList.remove("active"); flash.classList.add("hidden"); }, 300);
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
    if (result === "WIN") this.audio.playWin();
    else if (result === "LOSE") this.audio.playLose();
    document.getElementById("vs-hp-container")?.classList.add("hidden");
    const overlay = document.getElementById("vs-result");
    if (overlay) {
      overlay.classList.remove("hidden");
      const text = overlay.querySelector(".vs-result-text");
      if (text) text.textContent = result;
    }
  }

  private async saveVsResult(finalScore: number, vsResult: "win" | "lose" | "disconnect", opponentScore: number): Promise<void> {
    if (!this.gameConfig) return;
    const replayId = crypto.randomUUID();
    const replay = createReplay(replayId, "", this.seed, this.gameConfig, finalScore, this.recordDts, this.recordEvents);
    await this.manageReplay.save(replay);
    const vsScore = createVsScore(crypto.randomUUID(), finalScore, this.mode, vsResult, this.opponentName, opponentScore, replayId);
    await this.manageScore.record(vsScore.value, vsScore.mode, vsScore.replayId, vsScore.vsResult, vsScore.opponentName, vsScore.opponentScore);
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
    this.inputAbort.abort();
    this.ws.close();
    this.selfRenderer?.dispose();
    this.selfRenderer = null;
    this.opponentRenderer?.dispose();
    this.opponentRenderer = null;
    this.selfContainer.remove();
    this.opponentContainer.remove();
    document.getElementById("vs-hp-container")?.classList.add("hidden");
    document.getElementById("vs-result")?.classList.add("hidden");
  }
}
