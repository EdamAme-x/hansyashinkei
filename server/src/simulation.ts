import { createGameWorld, tick, dodge, undodge, type GameWorldState } from "@domain/entities/GameWorld";
import { mulberry32 } from "@domain/entities/Prng";
import { type GameConfig } from "@domain/entities/GameConfig";
import type { VsPlayerState, VsOrbState } from "@shared/protocol";
import {
  VS_MAX_HP, VS_WALL_DAMAGE, VS_ORB_DAMAGE, VS_PASS_HEAL,
  VS_INVINCIBLE_FRAMES, VS_ORB_CHANCE, VS_FIXED_DT,
} from "@shared/protocol";

const BALL_Z = 0;

export interface VsGameEvent {
  type: "damage" | "heal";
  player: 0 | 1;
  amount: number;
  source: "wall" | "orb" | "pass";
}

export interface VsStepResult {
  events: VsGameEvent[];
}

export interface VsPlayerSim {
  world: GameWorldState;
  hp: number;
  invincibleUntilFrame: number;
  lastScoredWaveCount: number;
}

export interface OrbSim {
  id: number;
  lane: number;
  z: number;
  collected: boolean;
  targetPlayer: 0 | 1;
}

export class VsSimulation {
  players: [VsPlayerSim, VsPlayerSim];
  orbs: OrbSim[] = [];
  frame = 0;
  finished = false;
  winner: 0 | 1 = 0;
  private orbIdGen = 0;
  private orbPrng: () => number;
  private config: GameConfig;

  constructor(seed: number, config: GameConfig) {
    this.config = config;

    this.players = [
      {
        world: createGameWorld(config, mulberry32(seed)),
        hp: VS_MAX_HP,
        invincibleUntilFrame: 0,
        lastScoredWaveCount: 0,
      },
      {
        world: createGameWorld(config, mulberry32(seed)),
        hp: VS_MAX_HP,
        invincibleUntilFrame: 0,
        lastScoredWaveCount: 0,
      },
    ];

    this.orbPrng = mulberry32((seed + 0x12345678) >>> 0);
  }

  applyInput(playerIndex: 0 | 1, action: "dodge" | "undodge", ballIndex: number): void {
    const world = this.players[playerIndex].world;
    if (action === "dodge") {
      dodge(world, ballIndex);
    } else {
      undodge(world, ballIndex);
    }
  }

  step(): VsStepResult {
    const events: VsGameEvent[] = [];
    if (this.finished) return { events };

    for (let p = 0; p < 2; p++) {
      const player = this.players[p as 0 | 1];
      const prevWaveCount = player.world.scoredWaves.size;
      const prevHp = player.hp;

      // Pre-tick: force alive so tick doesn't abort on wall collision
      player.world.alive = true;
      tick(player.world, VS_FIXED_DT);

      // Wall collision: tick sets alive=false when ball hits wall
      if (!player.world.alive) {
        if (this.frame >= player.invincibleUntilFrame) {
          player.hp = Math.max(0, player.hp - VS_WALL_DAMAGE);
          player.invincibleUntilFrame = this.frame + VS_INVINCIBLE_FRAMES;
          events.push({ type: "damage", player: p as 0 | 1, amount: VS_WALL_DAMAGE, source: "wall" });
        }
        // Revive
        player.world.alive = true;
      }

      // HP recovery on wall pass
      const newWaveCount = player.world.scoredWaves.size;
      if (newWaveCount > prevWaveCount) {
        const wavesPassed = newWaveCount - prevWaveCount;
        const heal = VS_PASS_HEAL * wavesPassed;
        const oldHp = player.hp;
        player.hp = Math.min(VS_MAX_HP, player.hp + heal);
        const actualHeal = player.hp - oldHp;
        if (actualHeal > 0) {
          events.push({ type: "heal", player: p as 0 | 1, amount: actualHeal, source: "pass" });
        }
      }

      // Orb spawning
      if (newWaveCount > player.lastScoredWaveCount) {
        for (let w = player.lastScoredWaveCount; w < newWaveCount; w++) {
          if (this.orbPrng() < VS_ORB_CHANCE) {
            this.spawnOrb(p as 0 | 1);
          }
        }
        player.lastScoredWaveCount = newWaveCount;
      }

      // Detect HP changes not captured above (shouldn't happen, but safety)
      if (player.hp !== prevHp && events.length === 0) {
        // Already emitted
      }
    }

    // Move and check orbs — collect orb events
    const orbEvents = this.updateOrbs();
    events.push(...orbEvents);

    // Check game over
    for (let p = 0; p < 2; p++) {
      if (this.players[p].hp <= 0) {
        this.finished = true;
        this.winner = (1 - p) as 0 | 1;
        break;
      }
    }

    this.frame++;
    return { events };
  }

  private spawnOrb(targetPlayer: 0 | 1): void {
    const world = this.players[targetPlayer].world;
    const validLanes = this.config.balls.map((b) => b.homeLane);
    const wallLanes = new Set(world.walls.filter((w) => w.z < -60).map((w) => w.lane));
    const safeLanes = validLanes.filter((l) => !wallLanes.has(l));

    if (safeLanes.length === 0) return;

    const lane = safeLanes[Math.floor(this.orbPrng() * safeLanes.length)];
    this.orbs.push({
      id: this.orbIdGen++,
      lane,
      z: this.config.spawnZ,
      collected: false,
      targetPlayer,
    });
  }

  private updateOrbs(): VsGameEvent[] {
    const events: VsGameEvent[] = [];

    for (const orb of this.orbs) {
      if (orb.collected) continue;

      orb.z += this.players[orb.targetPlayer].world.speed * VS_FIXED_DT;

      const player = this.players[orb.targetPlayer];
      const hitMin = BALL_Z - this.config.hitZone;
      const hitMax = BALL_Z + this.config.hitZone;

      if (orb.z >= hitMin && orb.z <= hitMax) {
        for (const ball of player.world.balls) {
          if (ball.lane === orb.lane) {
            orb.collected = true;
            const opponent = (1 - orb.targetPlayer) as 0 | 1;
            this.players[opponent].hp = Math.max(0, this.players[opponent].hp - VS_ORB_DAMAGE);
            events.push({ type: "damage", player: opponent, amount: VS_ORB_DAMAGE, source: "orb" });
            break;
          }
        }
      }

      if (orb.z > this.config.despawnZ) {
        orb.collected = true;
      }
    }

    this.orbs = this.orbs.filter((o) => !o.collected);
    return events;
  }

  getPlayerState(index: 0 | 1): VsPlayerState {
    const p = this.players[index];
    return {
      hp: p.hp,
      score: p.world.score,
      speed: p.world.speed,
      alive: p.world.alive,
      invincibleUntilFrame: p.invincibleUntilFrame,
      dodging: p.world.balls.map((b) => b.dodging),
    };
  }

  getOrbStates(): VsOrbState[] {
    return this.orbs.filter((o) => !o.collected).map((o) => ({
      id: o.id,
      lane: o.lane,
      z: o.z,
      collected: o.collected,
      targetPlayer: o.targetPlayer,
    }));
  }
}
