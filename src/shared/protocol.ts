// ── Shared types for VS multiplayer protocol ──

import type { GameConfig } from "../domain/entities/GameConfig";
import type { GameMode } from "../domain/entities/GameMode";

// ── Player / Orb state ──

export interface VsPlayerState {
  hp: number;
  score: number;
  speed: number;
  alive: boolean;
  invincibleUntilFrame: number;
  dodging: boolean[];
  walls: { lane: number; z: number }[];
}

export interface VsOrbState {
  id: number;
  lane: number;
  z: number;
  collected: boolean;
  targetPlayer: 0 | 1;
}

// ── Client → Server messages ──

export type ClientMessage =
  | { type: "join"; username: string; keyPart: string }
  | { type: "ready" }
  | { type: "input"; frame: number; action: "dodge" | "undodge"; ballIndex: number };

// ── Server → Client messages ──

export type ServerMessage =
  | { type: "joined"; playerIndex: 0 | 1; roomId: string; mode: GameMode }
  | { type: "opponent_joined"; username: string }
  | { type: "opponent_ready" }
  | { type: "key_exchange"; combinedKey: string }
  | { type: "countdown"; seconds: number }
  | { type: "game_start"; seed: number; config: GameConfig; fixedDt: number }
  | { type: "state"; frame: number; players: [VsPlayerState, VsPlayerState]; orbs: VsOrbState[]; hmac: string }
  | { type: "damage"; targetPlayer: 0 | 1; amount: number; source: "wall" | "orb" }
  | { type: "heal"; targetPlayer: 0 | 1; amount: number }
  | { type: "game_over"; winner: 0 | 1; players: [VsPlayerState, VsPlayerState] }
  | { type: "error"; message: string }
  | { type: "encrypted"; data: string };

// ── VS Game constants ──

export const VS_MAX_HP = 1000;
export const VS_WALL_DAMAGE = 200;
export const VS_ORB_DAMAGE = 75;
export const VS_PASS_HEAL = 25;
export const VS_INVINCIBLE_FRAMES = 120; // 2 seconds at 60fps
export const VS_ORB_CHANCE = 1 / 3;
export const VS_FIXED_DT = 1 / 60;
export const VS_BROADCAST_INTERVAL = 3; // every 3 ticks = 20Hz
export const VS_MAX_INPUTS_PER_SECOND = 20;
export const VS_FRAME_TOLERANCE = 5;
