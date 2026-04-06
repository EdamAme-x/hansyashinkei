import { createDefaultConfig, createTripleConfig } from "@domain/entities/GameConfig";
import type { GameConfig } from "@domain/entities/GameConfig";
import type { GameMode } from "@domain/entities/GameMode";
import type { ClientMessage, ServerMessage } from "@shared/protocol";
import { VS_FIXED_DT, VS_BROADCAST_INTERVAL, VS_MAX_INPUTS_PER_SECOND, VS_FRAME_TOLERANCE } from "@shared/protocol";
import { VsSimulation } from "@server/simulation";
import { combineKeys, base64Decode, base64Encode, hmacSign, validateUsername } from "@server/auth";

type RoomState = "waiting" | "countdown" | "playing" | "finished";

interface PlayerConn {
  ws: WebSocket;
  username: string;
  keyPart: Uint8Array;
  inputCount: number;
  inputWindowStart: number;
}

export class RoomDurableObject {
  private state: DurableObjectState;
  private roomState: RoomState = "waiting";
  private players: (PlayerConn | null)[] = [null, null];
  private mode: GameMode = "classic";
  private roomId = "";
  private simulation: VsSimulation | null = null;
  private seed = 0;
  private combinedKey: Uint8Array | null = null;
  private countdownRemaining = 3;
  private config: GameConfig | null = null;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      if (this.roomState === "playing" || this.roomState === "finished") {
        return new Response("Game in progress", { status: 409 });
      }
      if (this.players[0] && this.players[1]) {
        return new Response("Room full", { status: 409 });
      }

      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];

      this.state.acceptWebSocket(server);

      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/info") {
      return Response.json({
        roomId: this.roomId,
        mode: this.mode,
        state: this.roomState,
        playerCount: this.players.filter(Boolean).length,
      });
    }

    if (url.pathname === "/init" && request.method === "POST") {
      const body = await request.json() as { mode: GameMode; roomId: string };
      this.mode = body.mode;
      this.roomId = body.roomId;
      this.config = this.mode === "triple" ? createTripleConfig() : createDefaultConfig();
      return new Response("OK");
    }

    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
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
      case "input":
        this.handleInput(ws, msg.frame, msg.action, msg.ballIndex);
        break;
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const idx = this.findPlayerIndex(ws);
    if (idx === -1) return;

    this.players[idx] = null;

    // If game is in progress and a player disconnects, opponent wins
    if (this.roomState === "playing" && this.simulation) {
      this.roomState = "finished";
      const winner = (1 - idx) as 0 | 1;
      this.simulation.finished = true;
      this.simulation.winner = winner;
      this.broadcast({ type: "game_over", winner, players: [this.simulation.getPlayerState(0), this.simulation.getPlayerState(1)] });
    }

    // If countdown/waiting, cancel and notify remaining player
    if (this.roomState === "countdown" || this.roomState === "waiting") {
      this.roomState = "waiting";
      this.countdownRemaining = 3;
      this.broadcast({ type: "error", message: "対戦相手が切断しました" });
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  async alarm(): Promise<void> {
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
      // Run simulation steps
      const allEvents: import("@server/simulation").VsGameEvent[] = [];
      for (let i = 0; i < VS_BROADCAST_INTERVAL; i++) {
        const result = this.simulation.step();
        allEvents.push(...result.events);
        if (this.simulation.finished) break;
      }

      if (this.simulation.finished) {
        this.roomState = "finished";
        this.broadcast({
          type: "game_over",
          winner: this.simulation.winner,
          players: [this.simulation.getPlayerState(0), this.simulation.getPlayerState(1)],
        });
        return;
      }

      // Broadcast state
      const statePayload = JSON.stringify({
        frame: this.simulation.frame,
        players: [this.simulation.getPlayerState(0), this.simulation.getPlayerState(1)],
        orbs: this.simulation.getOrbStates(),
      });

      const hmac = this.combinedKey ? await hmacSign(this.combinedKey, statePayload) : "";

      this.broadcast({
        type: "state",
        frame: this.simulation.frame,
        players: [this.simulation.getPlayerState(0), this.simulation.getPlayerState(1)],
        orbs: this.simulation.getOrbStates(),
        hmac,
      });

      // Broadcast damage/heal events
      for (const ev of allEvents) {
        this.broadcast({
          type: ev.type,
          targetPlayer: ev.player,
          amount: ev.amount,
          source: ev.source as "wall" | "orb",
        });
      }

      // Schedule next tick batch (50ms = 20Hz)
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

    // Reject if this WS is already joined
    if (this.findPlayerIndex(ws) !== -1) {
      this.send(ws, { type: "error", message: "Already joined" });
      return;
    }

    const idx = this.players[0] === null ? 0 : this.players[1] === null ? 1 : -1;
    if (idx === -1) {
      this.send(ws, { type: "error", message: "Room full" });
      return;
    }

    this.players[idx] = { ws, username: validName, keyPart, inputCount: 0, inputWindowStart: Date.now() };

    this.send(ws, { type: "joined", playerIndex: idx as 0 | 1, roomId: this.roomId, mode: this.mode });

    // Notify opponent
    const other = this.players[1 - idx];
    if (other) {
      this.send(other.ws, { type: "opponent_joined", username: validName });
      this.send(ws, { type: "opponent_joined", username: other.username });

      const p0 = this.players[0];
      const p1 = this.players[1];
      if (!p0 || !p1) return;

      const combined = combineKeys(p0.keyPart, p1.keyPart);
      this.combinedKey = combined;
      const keyB64 = base64Encode(combined);
      this.broadcast({ type: "key_exchange", combinedKey: keyB64 });

      // Start countdown
      this.roomState = "countdown";
      this.countdownRemaining = 3;
      this.broadcast({ type: "countdown", seconds: 3 });
      await this.state.storage.setAlarm(Date.now() + 1000);
    }
  }

  private handleInput(ws: WebSocket, frame: number, action: "dodge" | "undodge", ballIndex: number): void {
    if (this.roomState !== "playing" || !this.simulation) return;

    const idx = this.findPlayerIndex(ws);
    if (idx === -1) return;

    const player = this.players[idx];
    if (!player) return;

    // Rate limit: max inputs per second
    const now = Date.now();
    if (now - player.inputWindowStart > 1000) {
      player.inputCount = 0;
      player.inputWindowStart = now;
    }
    if (player.inputCount >= VS_MAX_INPUTS_PER_SECOND) return;
    player.inputCount++;

    // Frame validation
    if (Math.abs(frame - this.simulation.frame) > VS_FRAME_TOLERANCE) return;

    // Ball index validation
    if (!this.config || ballIndex < 0 || ballIndex >= this.config.balls.length) return;

    // Action validation
    if (action !== "dodge" && action !== "undodge") return;

    this.simulation.applyInput(idx as 0 | 1, action, ballIndex);
  }

  private findPlayerIndex(ws: WebSocket): number {
    if (this.players[0]?.ws === ws) return 0;
    if (this.players[1]?.ws === ws) return 1;
    return -1;
  }

  private async startGame(): Promise<void> {
    if (!this.config) return;
    if (!this.players[0] || !this.players[1]) {
      this.roomState = "waiting";
      return;
    }

    const seedBuf = new Uint32Array(1);
    crypto.getRandomValues(seedBuf);
    this.seed = seedBuf[0];

    this.simulation = new VsSimulation(this.seed, this.config);
    this.roomState = "playing";

    this.broadcast({
      type: "game_start",
      seed: this.seed,
      config: this.config,
      fixedDt: VS_FIXED_DT,
    });

    // Start game loop
    await this.state.storage.setAlarm(Date.now() + 50);
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // Connection may be closed
    }
  }

  private broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const p of this.players) {
      if (!p) continue;
      try {
        p.ws.send(data);
      } catch {
        // Connection may be closed
      }
    }
  }
}
