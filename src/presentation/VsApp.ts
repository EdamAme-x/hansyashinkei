import type { GameConfig } from "@domain/entities/GameConfig";
import type { GameMode } from "@domain/entities/GameMode";
import type { ReplayEvent } from "@domain/entities/Replay";
import { createReplay } from "@domain/entities/Replay";
import { createVsScore } from "@domain/entities/Score";
import type { ServerMessage } from "@shared/protocol";
import { VS_FIXED_DT, VS_MAX_HP, VS_ORB_CHANCE } from "@shared/protocol";
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
import type { GameWorldState } from "@domain/entities/GameWorld";
import { createGameWorld, tick, dodge, undodge } from "@domain/entities/GameWorld";
import { mulberry32 } from "@domain/entities/Prng";

type VsPhase = "connecting" | "waiting" | "countdown" | "playing" | "ended" | "error";

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

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

  // Server-authoritative HP/invincibility
  private selfHp = VS_MAX_HP;
  private oppHp = VS_MAX_HP;
  private selfInvincUntil = 0;
  private oppInvincUntil = 0;

  // Local deterministic worlds (same seed → same walls)
  private selfWorld: GameWorldState | null = null;
  private opponentWorld: GameWorldState | null = null;
  private gameConfig: GameConfig | null = null;

  private animationId = 0;
  private lastTime = 0;
  private accumulator = 0;
  private localFrame = 0;

  // Orbs (client-side)
  private orbs: { id: number; lane: number; z: number }[] = [];
  private oppOrbs: { id: number; lane: number; z: number }[] = [];
  private orbIdGen = 0;
  private orbPrng: (() => number) | null = null;
  private oppOrbPrng: (() => number) | null = null;
  private lastScoredWaveCount = 0;
  private oppLastScoredWaveCount = 0;

  // Recording
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
    container: HTMLElement, theme: ThemeConfig, inputConfig: InputConfig,
    audio: AudioManager, manageAchievement: ManageAchievement,
    manageScore: ManageScore, manageReplay: ManageReplay,
    vsMatch: VsMatchService, username: string,
  ) {
    this.theme = theme; this.inputConfig = inputConfig; this.audio = audio;
    this.manageAchievement = manageAchievement; this.manageScore = manageScore;
    this.manageReplay = manageReplay; this.vsMatch = vsMatch;
    this.achievementToast = new AchievementToast(); this.username = username;
    this.ws = new WsClient();

    for (const id of SOLO_UI_IDS) document.getElementById(id)?.classList.add("hidden");

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
    this.ws.onClose(() => { if (this.phase === "playing") { this.phase = "ended"; this.showResult("DISCONNECTED"); } });

    this.setupInput();
    this.setupResize();
    setupCustomCursor(() => this.phase === "playing");
    manageAchievement.getActiveSkinId().then((id) => { this.activeSkinId = id; }).catch(() => {});
  }

  private get isMobile(): boolean { return navigator.maxTouchPoints > 0 && matchMedia("(pointer: coarse)").matches; }

  async createAndJoin(mode: GameMode): Promise<void> {
    this.mode = mode; this.updateOverlay("ルーム作成中...");
    const { roomId } = await this.vsMatch.createRoom(mode);
    this.roomId = roomId; this.updateOverlay(`ルーム: ${roomId}\n相手を待っています...`);
    await this.ws.connect(this.vsMatch.getWsUrl(roomId)); this.sendJoin();
  }

  async join(roomId: string): Promise<void> {
    this.roomId = roomId; this.updateOverlay("接続中...");
    await this.ws.connect(this.vsMatch.getWsUrl(roomId)); this.sendJoin();
  }

  private sendJoin(): void {
    const k = new Uint8Array(16); crypto.getRandomValues(k);
    this.ws.send({ type: "join", username: this.username, keyPart: b64encode(k) });
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case "joined":
        this.playerIndex = msg.playerIndex; this.roomId = msg.roomId; this.mode = msg.mode;
        this.phase = "waiting"; this.updateOverlay(`ルーム: ${this.roomId}\n相手を待っています...`);
        break;
      case "opponent_joined":
        this.opponentName = msg.username;
        this.updateOverlay(`${msg.username} が参加しました\n準備ができたらREADYを押してください`);
        this.showReadyButton();
        break;
      case "opponent_ready":
        this.opponentReady = true; this.updateReadyStatus(); break;
      case "key_exchange": {
        const bin = atob(msg.combinedKey);
        this.combinedKey = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) this.combinedKey[i] = bin.charCodeAt(i);
        this.ws.setDecryptKey(this.combinedKey);
        break;
      }
      case "countdown":
        this.phase = "countdown";
        if (msg.seconds > 0) this.audio.playCountdownTick(); else this.audio.playStart();
        this.updateOverlay(msg.seconds > 0 ? String(msg.seconds) : "START!");
        break;
      case "game_start":
        this.startGame(msg.seed, msg.config); break;
      case "state":
        this.onServerState(msg); break;
      case "damage":
        this.onDamage(msg.targetPlayer, msg.amount, msg.source); break;
      case "heal":
        this.onHeal(msg.targetPlayer, msg.amount); break;
      case "game_over": {
        this.phase = "ended";
        const won = msg.winner === this.playerIndex;
        this.showResult(won ? "WIN" : "LOSE");
        const sf = msg.players[this.playerIndex];
        const of = msg.players[(1 - this.playerIndex) as 0 | 1];
        this.saveVsResult(sf.score, won ? "win" : "lose", of.score).catch(() => {});
        this.unlockVsAchievement();
        break;
      }
      case "error":
        this.phase = "error"; this.updateOverlay(`ERROR: ${msg.message}`); break;
    }
  }

  private startGame(seed: number, config: GameConfig): void {
    this.gameConfig = config; this.seed = seed; this.phase = "playing";
    this.recordDts = []; this.recordEvents = []; this.localFrame = 0;
    this.selfHp = VS_MAX_HP; this.oppHp = VS_MAX_HP;
    this.selfInvincUntil = 0; this.oppInvincUntil = 0;
    this.accumulator = 0; this.lastTime = performance.now();

    this.vsOverlay.classList.add("hidden");
    document.getElementById("vs-hp-container")?.classList.remove("hidden");

    // Local deterministic worlds — same seed = same walls
    this.selfWorld = createGameWorld(config, mulberry32(seed));
    this.opponentWorld = createGameWorld(config, mulberry32(seed));
    this.orbPrng = mulberry32((seed + 0x12345678) >>> 0);
    this.oppOrbPrng = mulberry32((seed + 0x12345678) >>> 0);
    this.orbs = [];
    this.oppOrbs = [];
    this.orbIdGen = 0;
    this.lastScoredWaveCount = 0;
    this.oppLastScoredWaveCount = 0;

    this.selfRenderer = new GameRenderer(this.selfContainer, config, this.theme);
    this.selfRenderer.applyActiveSkin(getSkinDef(this.activeSkinId));
    if (!this.isMobile) {
      this.opponentRenderer = new GameRenderer(this.opponentContainer, config, this.theme);
    }

    this.audio.startBgm();
    this.startLoop();
  }

  /** Server state at 20Hz — update HP/orbs/opponent dodge. Walls are local. */
  private onServerState(msg: Extract<ServerMessage, { type: "state" }>): void {
    const self = msg.players[this.playerIndex];
    const opp = msg.players[(1 - this.playerIndex) as 0 | 1];
    this.selfHp = self.hp;
    this.oppHp = opp.hp;
    this.selfInvincUntil = self.invincibleUntilFrame;
    this.oppInvincUntil = opp.invincibleUntilFrame;

    // Sync opponent dodge state to opponent world
    if (this.opponentWorld) {
      for (let i = 0; i < this.opponentWorld.balls.length && i < opp.dodging.length; i++) {
        if (this.opponentWorld.balls[i].dodging !== opp.dodging[i]) {
          if (opp.dodging[i]) dodge(this.opponentWorld, i);
          else undodge(this.opponentWorld, i);
        }
      }
    }

    this.updateHpDisplay();
  }

  private onDamage(target: 0 | 1, amount: number, source: "wall" | "orb"): void {
    if (target === this.playerIndex) { this.showDamageFlash(); this.audio.playHit(); }
    else if (source === "orb") this.audio.playOrbDamage();
    this.showDamageNumber(target === this.playerIndex ? "self" : "opponent", amount);
  }

  private onHeal(target: 0 | 1, amount: number): void {
    if (target === this.playerIndex && amount > 0) this.updateHpDisplay();
  }

  private startLoop(): void {
    this.lastTime = performance.now();

    const loop = (now: number) => {
      this.animationId = requestAnimationFrame(loop);
      if (this.phase !== "playing") return;

      const elapsed = Math.min((now - this.lastTime) / 1000, 0.05);
      this.lastTime = now;
      this.accumulator += elapsed;

      // Fixed timestep local tick — same as server, same seed = identical walls
      while (this.accumulator >= VS_FIXED_DT) {
        if (this.selfWorld) {
          const prevScore = this.selfWorld.score;
          this.selfWorld.alive = true;
          tick(this.selfWorld, VS_FIXED_DT);

          // Detect wall hit (tick sets alive=false)
          if (!this.selfWorld.alive) {
            this.ws.send({ type: "wall_hit" });
            this.selfWorld.alive = true;
          }

          // Detect wall pass (score increased)
          const passCount = this.selfWorld.score - prevScore;
          for (let p = 0; p < passCount; p++) {
            this.ws.send({ type: "wall_pass" });
          }

          // Orb spawning on wave pass
          const newWaveCount = this.selfWorld.scoredWaves.size;
          if (this.orbPrng && newWaveCount > this.lastScoredWaveCount && this.gameConfig) {
            for (let w = this.lastScoredWaveCount; w < newWaveCount; w++) {
              if (this.orbPrng() < VS_ORB_CHANCE) {
                const validLanes = this.gameConfig.balls.map((b) => b.homeLane);
                const wallLanes = new Set(this.selfWorld.walls.filter((wl) => wl.z < -60).map((wl) => wl.lane));
                const safeLanes = validLanes.filter((l) => !wallLanes.has(l));
                if (safeLanes.length > 0) {
                  const lane = safeLanes[Math.floor(this.orbPrng() * safeLanes.length)];
                  this.orbs.push({ id: this.orbIdGen++, lane, z: this.gameConfig.spawnZ });
                }
              }
            }
            this.lastScoredWaveCount = newWaveCount;
          }

          // Move orbs + check collection (wider range for reliable pickup)
          const orbPickupRange = 1.5;
          for (let oi = this.orbs.length - 1; oi >= 0; oi--) {
            const orb = this.orbs[oi];
            orb.z += this.selfWorld.speed * VS_FIXED_DT;
            if (orb.z >= -orbPickupRange && orb.z <= orbPickupRange) {
              for (const ball of this.selfWorld.balls) {
                if (ball.lane === orb.lane) {
                  this.ws.send({ type: "orb_collect" });
                  this.audio.playOrbDamage();
                  this.orbs.splice(oi, 1);
                  break;
                }
              }
            }
            if (oi < this.orbs.length && this.orbs[oi]?.z > (this.gameConfig?.despawnZ ?? 5)) {
              this.orbs.splice(oi, 1);
            }
          }

          this.selfRenderer?.syncOrbs(this.orbs.map((o) => ({
            id: o.id, lane: o.lane, z: o.z, collected: false, targetPlayer: this.playerIndex,
          })));
        }

        // Opponent world tick + orb spawning
        if (this.opponentWorld) {
          this.opponentWorld.alive = true;
          tick(this.opponentWorld, VS_FIXED_DT);
          this.opponentWorld.alive = true;

          // Opponent orb spawning (same logic, separate PRNG instance)
          const oppNewWaveCount = this.opponentWorld.scoredWaves.size;
          if (this.oppOrbPrng && oppNewWaveCount > this.oppLastScoredWaveCount && this.gameConfig) {
            for (let w = this.oppLastScoredWaveCount; w < oppNewWaveCount; w++) {
              if (this.oppOrbPrng() < VS_ORB_CHANCE) {
                const validLanes = this.gameConfig.balls.map((b) => b.homeLane);
                const wallLanes = new Set(this.opponentWorld.walls.filter((wl) => wl.z < -60).map((wl) => wl.lane));
                const safeLanes = validLanes.filter((l) => !wallLanes.has(l));
                if (safeLanes.length > 0) {
                  const lane = safeLanes[Math.floor(this.oppOrbPrng() * safeLanes.length)];
                  this.oppOrbs.push({ id: this.orbIdGen++, lane, z: this.gameConfig.spawnZ });
                }
              }
            }
            this.oppLastScoredWaveCount = oppNewWaveCount;
          }

          // Move opponent orbs (no collection check — opponent's client handles that)
          for (let oi = this.oppOrbs.length - 1; oi >= 0; oi--) {
            this.oppOrbs[oi].z += this.opponentWorld.speed * VS_FIXED_DT;
            if (this.oppOrbs[oi].z > (this.gameConfig?.despawnZ ?? 5)) {
              this.oppOrbs.splice(oi, 1);
            }
          }

          this.opponentRenderer?.syncOrbs(this.oppOrbs.map((o) => ({
            id: o.id, lane: o.lane, z: o.z, collected: false, targetPlayer: (1 - this.playerIndex) as 0 | 1,
          })));
        }
        this.recordDts.push(VS_FIXED_DT);
        this.localFrame++;
        this.accumulator -= VS_FIXED_DT;
      }

      // Render self
      if (this.selfRenderer && this.selfWorld) {
        const blink = this.selfInvincUntil > Date.now();
        this.selfRenderer.showBalls(blink ? Math.floor(now / 120) % 2 === 0 : true);
        this.selfRenderer.sync(this.selfWorld);
        this.selfRenderer.render();
      }

      // Render opponent
      if (this.opponentRenderer && this.opponentWorld) {
        const blink = this.oppInvincUntil > Date.now();
        this.opponentRenderer.showBalls(blink ? Math.floor(now / 120) % 2 === 0 : true);
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
      for (const b of this.inputConfig.dodge) if (e.code === b.code) this.doDodge(b.ballIndex);
    }, { signal });

    window.addEventListener("keyup", (e) => {
      pressed.delete(e.code);
      if (this.phase !== "playing") return;
      for (const b of this.inputConfig.dodge) if (e.code === b.code) this.doUndodge(b.ballIndex);
    }, { signal });

    const activeTouches = new Map<number, number>();
    const tz = (x: number) => {
      const w = window.innerWidth;
      if (this.mode === "triple") { if (x < w / 3) return 0; if (x < (w * 2) / 3) return 2; return 1; }
      return x < w / 2 ? 0 : 1;
    };
    window.addEventListener("touchstart", (e) => {
      if (this.phase !== "playing") return; e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i]; const ball = tz(t.clientX);
        activeTouches.set(t.identifier, ball); this.doDodge(ball);
      }
    }, { passive: false, signal });
    const rel = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i]; const ball = activeTouches.get(t.identifier);
        if (ball !== undefined) { activeTouches.delete(t.identifier); if (this.phase === "playing") this.doUndodge(ball); }
      }
    };
    window.addEventListener("touchend", rel, { signal });
    window.addEventListener("touchcancel", rel, { signal });
  }

  private setupResize(): void {
    let t = 0;
    window.addEventListener("resize", () => {
      clearTimeout(t);
      t = window.setTimeout(() => {
        const w = window.innerWidth, h = window.innerHeight;
        if (this.isMobile) this.selfRenderer?.resize(w, h);
        else { const half = Math.floor(w / 2); this.selfRenderer?.resize(half, h); this.opponentRenderer?.resize(half, h); }
      }, 100);
    }, { signal: this.inputAbort.signal });
  }

  private doDodge(bi: number): void {
    if (!this.gameConfig || bi >= this.gameConfig.balls.length) return;
    if (this.selfWorld) dodge(this.selfWorld, bi);
    this.ws.send({ type: "input", frame: this.localFrame, action: "dodge", ballIndex: bi });
    this.recordEvents.push({ frame: this.localFrame, type: "dodge", ballIndex: bi });
    this.audio.playDodge();
  }

  private doUndodge(bi: number): void {
    if (!this.gameConfig || bi >= this.gameConfig.balls.length) return;
    if (this.selfWorld) undodge(this.selfWorld, bi);
    this.ws.send({ type: "input", frame: this.localFrame, action: "undodge", ballIndex: bi });
    this.recordEvents.push({ frame: this.localFrame, type: "undodge", ballIndex: bi });
  }

  // ── UI ──
  private updateOverlay(text: string): void {
    this.vsOverlay.classList.remove("hidden");
    const c = this.vsOverlay.querySelector(".vs-overlay-text");
    if (c) c.textContent = text;
    const rid = document.getElementById("vs-room-id"), cb = document.getElementById("vs-copy-btn"), ru = document.getElementById("vs-rules");
    if (this.phase === "waiting" && this.roomId) {
      if (rid) { rid.textContent = this.roomId; rid.style.display = ""; }
      if (cb) { cb.style.display = ""; cb.onclick = () => { navigator.clipboard.writeText(`${location.origin}?vs=${this.roomId}`).catch(() => {}); cb.textContent = "コピーしました!"; setTimeout(() => { cb.textContent = "URLをコピー"; }, 1500); }; }
      if (ru) ru.style.display = "";
      // Show back button
      let back = document.getElementById("vs-back-btn");
      if (!back) { back = document.createElement("button"); back.id = "vs-back-btn"; back.className = "vs-copy-btn"; back.style.cssText = "margin-top:0.5rem;opacity:0.5"; back.textContent = "TITLE"; this.vsOverlay.appendChild(back); }
      back.style.display = "";
      back.onclick = () => { this.dispose(); location.href = "/"; };
    } else {
      if (rid) rid.style.display = "none"; if (cb) cb.style.display = "none";
      if (ru) ru.style.display = this.phase === "countdown" ? "" : "none";
      const back = document.getElementById("vs-back-btn"); if (back) back.style.display = "none";
    }
  }

  private showReadyButton(): void {
    let btn = document.getElementById("vs-ready-btn");
    if (!btn) { btn = document.createElement("button"); btn.id = "vs-ready-btn"; btn.className = "vs-copy-btn"; btn.style.cssText = "margin-top:1rem;font-size:1.1rem;padding:0.7em 3em"; btn.textContent = "READY"; this.vsOverlay.appendChild(btn); }
    btn.style.display = "";
    btn.onclick = () => { this.ws.send({ type: "ready" }); btn.textContent = "READY!"; btn.style.opacity = "0.5"; btn.style.pointerEvents = "none"; this.updateReadyStatus(); };
  }

  private updateReadyStatus(): void {
    if (this.opponentReady) { const c = this.vsOverlay.querySelector(".vs-overlay-text"); if (c) c.textContent = `${this.opponentName} は準備完了！`; }
  }

  private updateHpDisplay(): void {
    const sb = document.getElementById("vs-self-hp-fill"), ob = document.getElementById("vs-opponent-hp-fill");
    const sl = document.getElementById("vs-self-hp-value"), ol = document.getElementById("vs-opponent-hp-value");
    if (sb) sb.style.width = `${Math.max(0, this.selfHp / 10)}%`;
    if (ob) ob.style.width = `${Math.max(0, this.oppHp / 10)}%`;
    if (sl) sl.textContent = String(Math.max(0, this.selfHp));
    if (ol) ol.textContent = String(Math.max(0, this.oppHp));
  }

  private showDamageFlash(): void {
    const f = document.getElementById("vs-damage-flash"); if (!f) return;
    f.classList.remove("hidden"); f.classList.add("active");
    setTimeout(() => { f.classList.remove("active"); f.classList.add("hidden"); }, 300);
  }

  private showDamageNumber(target: "self" | "opponent", amount: number): void {
    const c = document.getElementById(target === "self" ? "vs-self-damage" : "vs-opponent-damage"); if (!c) return;
    const el = document.createElement("div"); el.className = "vs-damage-num"; el.textContent = `-${amount}`;
    c.appendChild(el); requestAnimationFrame(() => el.classList.add("float-up")); setTimeout(() => el.remove(), 1000);
  }

  private showResult(result: string): void {
    this.audio.stopBgm();
    if (result === "WIN") this.audio.playWin(); else if (result === "LOSE") this.audio.playLose();
    document.getElementById("vs-hp-container")?.classList.add("hidden");
    const o = document.getElementById("vs-result"); if (o) { o.classList.remove("hidden"); const t = o.querySelector(".vs-result-text"); if (t) t.textContent = result; }
  }

  private async saveVsResult(finalScore: number, vsResult: "win" | "lose" | "disconnect", opponentScore: number): Promise<void> {
    if (!this.gameConfig) return;
    const rid = crypto.randomUUID();
    await this.manageReplay.save(createReplay(rid, "", this.seed, this.gameConfig, finalScore, this.recordDts, this.recordEvents));
    const vs = createVsScore(crypto.randomUUID(), finalScore, this.mode, vsResult, this.opponentName, opponentScore, rid);
    await this.manageScore.record(vs.value, vs.mode, vs.replayId, vs.vsResult, vs.opponentName, vs.opponentScore);
  }

  private async unlockVsAchievement(): Promise<void> {
    try {
      const s = { kind: "solo" as const, id: crypto.randomUUID(), value: 0, timestamp: Date.now(), replayId: null, mode: this.mode as "classic" | "triple" };
      const u = await this.manageAchievement.evaluateAndUnlock(s, 0, true);
      if (u.length > 0) this.achievementToast.show(u);
    } catch { /* */ }
  }

  dispose(): void {
    cancelAnimationFrame(this.animationId); this.inputAbort.abort(); this.ws.close();
    this.selfRenderer?.dispose(); this.selfRenderer = null;
    this.opponentRenderer?.dispose(); this.opponentRenderer = null;
    this.selfContainer.remove(); this.opponentContainer.remove();
    document.getElementById("vs-hp-container")?.classList.add("hidden");
    document.getElementById("vs-result")?.classList.add("hidden");
  }
}
