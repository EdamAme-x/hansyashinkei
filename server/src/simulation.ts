import type { VsPlayerState, VsOrbState } from "@shared/protocol";
import { VS_MAX_HP, VS_WALL_DAMAGE, VS_ORB_DAMAGE, VS_PASS_HEAL } from "@shared/protocol";

const INVINCIBLE_MS = 2000; // 2 seconds

export interface VsGameEvent {
  type: "damage" | "heal";
  player: 0 | 1;
  amount: number;
  source: "wall" | "orb" | "pass";
}

export interface VsStepResult {
  events: VsGameEvent[];
}

interface PlayerState {
  hp: number;
  score: number;
  invincibleUntil: number; // timestamp ms
  dodging: boolean[];
}

export class VsSimulation {
  players: [PlayerState, PlayerState];
  frame = 0;
  finished = false;
  winner: 0 | 1 = 0;

  constructor(ballCount: number) {
    this.players = [
      { hp: VS_MAX_HP, score: 0, invincibleUntil: 0, dodging: Array(ballCount).fill(false) as boolean[] },
      { hp: VS_MAX_HP, score: 0, invincibleUntil: 0, dodging: Array(ballCount).fill(false) as boolean[] },
    ];
  }

  applyDodge(playerIndex: 0 | 1, ballIndex: number, dodging: boolean): void {
    this.players[playerIndex].dodging[ballIndex] = dodging;
  }

  reportWallHit(playerIndex: 0 | 1): VsGameEvent | null {
    const p = this.players[playerIndex];
    const now = Date.now();
    if (now < p.invincibleUntil) return null;
    p.hp = Math.max(0, p.hp - VS_WALL_DAMAGE);
    p.invincibleUntil = now + INVINCIBLE_MS;
    this.checkGameOver();
    return { type: "damage", player: playerIndex, amount: VS_WALL_DAMAGE, source: "wall" };
  }

  reportOrbCollect(playerIndex: 0 | 1): VsGameEvent | null {
    const opponent = (1 - playerIndex) as 0 | 1;
    this.players[opponent].hp = Math.max(0, this.players[opponent].hp - VS_ORB_DAMAGE);
    this.checkGameOver();
    return { type: "damage", player: opponent, amount: VS_ORB_DAMAGE, source: "orb" };
  }

  reportWallPass(playerIndex: 0 | 1): VsGameEvent | null {
    const p = this.players[playerIndex];
    const oldHp = p.hp;
    p.hp = Math.min(VS_MAX_HP, p.hp + VS_PASS_HEAL);
    p.score++;
    const heal = p.hp - oldHp;
    if (heal > 0) return { type: "heal", player: playerIndex, amount: heal, source: "pass" };
    return null;
  }

  step(): VsStepResult {
    this.frame++;
    return { events: [] };
  }

  private checkGameOver(): void {
    for (let i = 0; i < 2; i++) {
      if (this.players[i].hp <= 0) {
        this.finished = true;
        this.winner = (1 - i) as 0 | 1;
      }
    }
  }

  getPlayerState(index: 0 | 1): VsPlayerState {
    const p = this.players[index];
    return {
      hp: p.hp,
      score: p.score,
      speed: 0,
      alive: true,
      invincibleUntilFrame: p.invincibleUntil, // repurposed as timestamp
      dodging: [...p.dodging],
    };
  }

  getOrbStates(): VsOrbState[] {
    return [];
  }
}
