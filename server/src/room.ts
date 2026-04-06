import { createDefaultConfig, createTripleConfig } from "@domain/entities/GameConfig";
import type { GameConfig } from "@domain/entities/GameConfig";
import type { GameMode } from "@domain/entities/GameMode";
import type { ClientMessage, ServerMessage } from "@shared/protocol";
import { VS_FIXED_DT } from "@shared/protocol";
import { VsSimulation } from "@server/simulation";
import type { VsGameEvent } from "@server/simulation";
import { combineKeys, base64Decode, base64Encode, hmacSign, validateUsername, xorEncrypt } from "@server/auth";

type RoomState = "waiting" | "countdown" | "playing" | "finished";

interface PlayerMeta {
  username: string;
  keyPart: Uint8Array;
  inputCount: number;
  inputWindowStart: number;
}

export class RoomDurableObject {
  private state: DurableObjectState;
  private roomState: RoomState = "waiting";
  private playerMeta: (PlayerMeta | null)[] = [null, null];
  private mode: GameMode = "classic";
  private roomId = "";
  private simulation: VsSimulation | null = null;
  private seed = 0;
  private combinedKey: Uint8Array | null = null;
  private countdownRemaining = 3;
  private config: GameConfig | null = null;
  private readyFlags: [boolean, boolean] = [false, false];

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.roomId) return;
    const meta = await this.state.storage.get<{ mode: GameMode; roomId: string; roomState: RoomState }>("roomMeta");
    if (meta) {
      this.mode = meta.mode;
      this.roomId = meta.roomId;
      this.roomState = meta.roomState;
      this.config = this.mode === "triple" ? createTripleConfig() : createDefaultConfig();
    }
    // Restore playerMeta from storage
    const pm = await this.state.storage.get<{ usernames: (string | null)[]; ready: [boolean, boolean] }>("playerMeta");
    if (pm) {
      if (pm.ready) this.readyFlags = pm.ready;
      for (let i = 0; i < 2; i++) {
        if (pm.usernames[i] && !this.playerMeta[i]) {
          // Player was joined before hibernation — restore minimal meta
          this.playerMeta[i] = {
            username: pm.usernames[i] as string,
            keyPart: new Uint8Array(16), // key lost after hibernation, re-exchange needed
            inputCount: 0,
            inputWindowStart: Date.now(),
          };
        }
      }
    }
  }

  private async saveMeta(): Promise<void> {
    await this.state.storage.put("roomMeta", {
      mode: this.mode,
      roomId: this.roomId,
      roomState: this.roomState,
    });
  }

  private async savePlayerMeta(): Promise<void> {
    await this.state.storage.put("playerMeta", {
      usernames: [this.playerMeta[0]?.username ?? null, this.playerMeta[1]?.username ?? null],
      ready: this.readyFlags,
    });
  }

  /** Get WebSocket for a player tag ("p0" or "p1"). */
  private getPlayerWs(index: number): WebSocket | null {
    const tag = `p${index}`;
    const sockets = this.state.getWebSockets(tag);
    return sockets.length > 0 ? sockets[0] : null;
  }

  /** Count connected players. */
  private connectedCount(): number {
    let count = 0;
    if (this.getPlayerWs(0)) count++;
    if (this.getPlayerWs(1)) count++;
    return count;
  }

  async fetch(request: Request): Promise<Response> {
    await this.ensureLoaded();
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      if (this.roomState === "playing" || this.roomState === "finished") {
        return new Response("Game in progress", { status: 409 });
      }

      // Check available slots
      const p0 = this.getPlayerWs(0);
      const p1 = this.getPlayerWs(1);
      if (p0 && p1) {
        return new Response("Room full", { status: 409 });
      }

      // Assign to first free slot
      const slot = !p0 ? 0 : 1;
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];

      // Tag the WebSocket with player index for hibernation recovery
      this.state.acceptWebSocket(server, [`p${slot}`]);

      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/info") {
      return Response.json({
        roomId: this.roomId,
        mode: this.mode,
        state: this.roomState,
        playerCount: this.connectedCount(),
      });
    }

    if (url.pathname === "/init" && request.method === "POST") {
      const body = await request.json() as { mode: GameMode; roomId: string };
      this.mode = body.mode;
      this.roomId = body.roomId;
      this.roomState = "waiting";
      this.config = this.mode === "triple" ? createTripleConfig() : createDefaultConfig();
      await this.saveMeta();
      return new Response("OK");
    }

    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    await this.ensureLoaded();
    if (typeof data !== "string") return;

    let msg: ClientMessage;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    switch (msg.type) {
      case "join":
        await this.handleJoin(ws, msg.username, msg.keyPart);
        break;
      case "ready":
        await this.handleReady(ws);
        break;
      case "input":
        this.handleInput(ws, msg.action, msg.ballIndex);
        break;
      case "wall_hit":
        this.handleReport(ws, "wall_hit");
        break;
      case "orb_collect":
        this.handleReport(ws, "orb_collect");
        break;
      case "wall_pass":
        this.handleReport(ws, "wall_pass");
        break;
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.ensureLoaded();
    const idx = this.findPlayerIndex(ws);
    if (idx === -1) return;

    this.playerMeta[idx] = null;

    if (this.roomState === "playing" && this.simulation) {
      this.roomState = "finished";
      const winner = (1 - idx) as 0 | 1;
      this.simulation.finished = true;
      this.simulation.winner = winner;
      this.broadcastEncrypted({ type: "game_over", winner, players: [this.simulation.getPlayerState(0), this.simulation.getPlayerState(1)] });
      await this.saveMeta();
    }

    if (this.roomState === "countdown" || this.roomState === "waiting") {
      this.roomState = "waiting";
      this.countdownRemaining = 3;
      this.broadcast({ type: "error", message: "対戦相手が切断しました" });
      await this.saveMeta();
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  async alarm(): Promise<void> {
    await this.ensureLoaded();

    if (this.roomState === "countdown") {
      this.countdownRemaining--;
      this.broadcast({ type: "countdown", seconds: this.countdownRemaining });

      if (this.countdownRemaining <= 0) {
        await this.startGame();
      } else {
        await this.state.storage.setAlarm(Date.now() + 1000);
      }
      return;
    }

    if (this.roomState === "playing" && this.simulation && !this.simulation.finished) {
      this.simulation.step();

      const statePayload = JSON.stringify({
        frame: this.simulation.frame,
        players: [this.simulation.getPlayerState(0), this.simulation.getPlayerState(1)],
        orbs: this.simulation.getOrbStates(),
      });

      const hmac = this.combinedKey ? await hmacSign(this.combinedKey, statePayload) : "";

      this.broadcastEncrypted({
        type: "state",
        frame: this.simulation.frame,
        players: [this.simulation.getPlayerState(0), this.simulation.getPlayerState(1)],
        orbs: this.simulation.getOrbStates(),
        hmac,
      });

      await this.state.storage.setAlarm(Date.now() + 50);
      return;
    }
  }

  private async handleJoin(ws: WebSocket, username: string, keyPartB64: string): Promise<void> {
    const validName = validateUsername(username);
    if (!validName) {
      this.send(ws, { type: "error", message: "Invalid username (1-10 chars)" });
      return;
    }

    let keyPart: Uint8Array;
    try {
      keyPart = base64Decode(keyPartB64);
      if (keyPart.length !== 16) throw new Error("bad key length");
    } catch {
      this.send(ws, { type: "error", message: "Invalid key" });
      return;
    }

    // Reject if already joined (has meta = already sent join message)
    const slot = this.findPlayerIndex(ws);
    if (slot === -1) {
      this.send(ws, { type: "error", message: "Room full" });
      return;
    }
    if (this.playerMeta[slot]) {
      this.send(ws, { type: "error", message: "Already joined" });
      return;
    }

    this.playerMeta[slot] = { username: validName, keyPart, inputCount: 0, inputWindowStart: Date.now() };
    await this.savePlayerMeta();

    this.send(ws, { type: "joined", playerIndex: slot as 0 | 1, roomId: this.roomId, mode: this.mode });

    // Check if both players have joined
    if (this.playerMeta[0] && this.playerMeta[1]) {
      const other = this.playerMeta[1 - slot];
      if (other) {
        const otherWs = this.getPlayerWs(1 - slot);
        if (otherWs) this.send(otherWs, { type: "opponent_joined", username: validName });
        this.send(ws, { type: "opponent_joined", username: other.username });
      }

      const combined = combineKeys(this.playerMeta[0].keyPart, this.playerMeta[1].keyPart);
      this.combinedKey = combined;
      const keyB64 = base64Encode(combined);
      this.broadcast({ type: "key_exchange", combinedKey: keyB64 });
      // Wait for both players to send "ready" before starting countdown
    }
  }

  private async handleReady(ws: WebSocket): Promise<void> {
    const idx = this.findPlayerIndex(ws);
    if (idx === -1 || this.roomState !== "waiting") return;

    this.readyFlags[idx as 0 | 1] = true;
    await this.savePlayerMeta();

    // Notify opponent
    const otherWs = this.getPlayerWs(1 - idx);
    if (otherWs) this.send(otherWs, { type: "opponent_ready" });

    // Both ready → start countdown
    if (this.readyFlags[0] && this.readyFlags[1]) {
      this.roomState = "countdown";
      this.countdownRemaining = 3;
      this.broadcast({ type: "countdown", seconds: 3 });
      await this.state.storage.setAlarm(Date.now() + 1000);
      await this.saveMeta();
    }
  }

  private handleInput(ws: WebSocket, action: "dodge" | "undodge", ballIndex: number): void {
    if (this.roomState !== "playing" || !this.simulation) return;
    const idx = this.findPlayerIndex(ws);
    if (idx === -1) return;
    if (!this.config || ballIndex < 0 || ballIndex >= this.config.balls.length) return;
    this.simulation.applyDodge(idx as 0 | 1, ballIndex, action === "dodge");
  }

  private handleReport(ws: WebSocket, reportType: "wall_hit" | "orb_collect" | "wall_pass"): void {
    if (this.roomState !== "playing" || !this.simulation) return;
    const idx = this.findPlayerIndex(ws);
    if (idx === -1) return;

    let event: import("@server/simulation").VsGameEvent | null = null;
    switch (reportType) {
      case "wall_hit":
        event = this.simulation.reportWallHit(idx as 0 | 1);
        break;
      case "orb_collect":
        event = this.simulation.reportOrbCollect(idx as 0 | 1);
        break;
      case "wall_pass":
        event = this.simulation.reportWallPass(idx as 0 | 1);
        break;
    }

    if (event) {
      if (event.type === "damage") {
        this.broadcastEncrypted({ type: "damage", targetPlayer: event.player, amount: event.amount, source: event.source as "wall" | "orb" });
      } else {
        this.broadcastEncrypted({ type: "heal", targetPlayer: event.player, amount: event.amount });
      }
    }

    if (this.simulation.finished) {
      this.roomState = "finished";
      this.broadcastEncrypted({
        type: "game_over",
        winner: this.simulation.winner,
        players: [this.simulation.getPlayerState(0), this.simulation.getPlayerState(1)],
      });
      this.saveMeta().catch(() => {});
    }
  }

  /** Find which player slot a WebSocket belongs to, using tags. */
  private findPlayerIndex(ws: WebSocket): number {
    const tags = this.state.getTags(ws);
    if (tags.includes("p0")) return 0;
    if (tags.includes("p1")) return 1;
    return -1;
  }

  private async startGame(): Promise<void> {
    if (!this.config) return;
    if (!this.getPlayerWs(0) || !this.getPlayerWs(1)) {
      this.roomState = "waiting";
      await this.saveMeta();
      return;
    }

    const seedBuf = new Uint32Array(1);
    crypto.getRandomValues(seedBuf);
    this.seed = seedBuf[0];

    this.simulation = new VsSimulation(this.config.balls.length);
    this.roomState = "playing";
    await this.saveMeta();

    this.broadcast({
      type: "game_start",
      seed: this.seed,
      config: this.config,
      fixedDt: VS_FIXED_DT,
    });

    await this.state.storage.setAlarm(Date.now() + 50);
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // closed
    }
  }

  private broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (let i = 0; i < 2; i++) {
      const ws = this.getPlayerWs(i);
      if (ws) {
        try { ws.send(data); } catch { /* closed */ }
      }
    }
  }

  private broadcastEncrypted(msg: ServerMessage): void {
    if (!this.combinedKey) {
      this.broadcast(msg);
      return;
    }
    const plaintext = JSON.stringify(msg);
    const encrypted = xorEncrypt(this.combinedKey, plaintext);
    const envelope = JSON.stringify({ type: "encrypted", data: encrypted });
    for (let i = 0; i < 2; i++) {
      const ws = this.getPlayerWs(i);
      if (ws) {
        try { ws.send(envelope); } catch { /* closed */ }
      }
    }
  }
}
