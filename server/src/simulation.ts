import { createGameWorld, tick, dodge, undodge, type GameWorldState } from "@domain/entities/GameWorld";
import { mulberry32 } from "@domain/entities/Prng";
import { type GameConfig } from "@domain/entities/GameConfig";
import type { VsPlayerState, VsOrbState } from "@shared/protocol";
import {
  VS_MAX_HP, VS_WALL_DAMAGE, VS_ORB_DAMAGE, VS_PASS_HEAL,
  VS_INVINCIBLE_FRAMES, VS_ORB_CHANCE, VS_FIXED_DT,
} from "@shared/protocol";

const BALL_Z = 0;

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

    // Both players get same config and seed → identical wall patterns
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

    // Separate PRNG for orb spawning (offset seed so it's not the same sequence)
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

  step(): void {
    if (this.finished) return;

    for (let p = 0; p < 2; p++) {
      const player = this.players[p as 0 | 1];
      const prevWaveCount = player.world.scoredWaves.size;

      // Override alive — in VS mode, dying from walls doesn't end the game,
      // it deals HP damage instead
      const prevAlive = player.world.alive;
      tick(player.world, VS_FIXED_DT);

      if (!player.world.alive && prevAlive) {
        // Wall collision — deal damage if not invincible
        if (this.frame >= player.invincibleUntilFrame) {
          player.hp = Math.max(0, player.hp - VS_WALL_DAMAGE);
          player.invincibleUntilFrame = this.frame + VS_INVINCIBLE_FRAMES;
        }
        // Revive — VS mode doesn't end on wall hit
        player.world.alive = true;
      }

      // HP recovery on wall pass
      const newWaveCount = player.world.scoredWaves.size;
      if (newWaveCount > prevWaveCount) {
        const wavesPassed = newWaveCount - prevWaveCount;
        player.hp = Math.min(VS_MAX_HP, player.hp + VS_PASS_HEAL * wavesPassed);
      }

      // Orb spawning: check if new waves were scored
      if (newWaveCount > player.lastScoredWaveCount) {
        for (let w = player.lastScoredWaveCount; w < newWaveCount; w++) {
          if (this.orbPrng() < VS_ORB_CHANCE) {
            this.spawnOrb(p as 0 | 1);
          }
        }
        player.lastScoredWaveCount = newWaveCount;
      }
    }

    // Move and check orbs
    this.updateOrbs();

    // Check game over
    for (let p = 0; p < 2; p++) {
      if (this.players[p].hp <= 0) {
        this.finished = true;
        this.winner = (1 - p) as 0 | 1;
        break;
      }
    }

    this.frame++;
  }

  private spawnOrb(targetPlayer: 0 | 1): void {
    // Place orb in a safe lane (one not occupied by current walls at spawn z)
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

  private updateOrbs(): void {
    for (const orb of this.orbs) {
      if (orb.collected) continue;

      // Move at same speed as walls for that player
      orb.z += this.players[orb.targetPlayer].world.speed * VS_FIXED_DT;

      // Check collection: orb passes through hit zone and player ball is in that lane
      const player = this.players[orb.targetPlayer];
      const hitMin = BALL_Z - this.config.hitZone;
      const hitMax = BALL_Z + this.config.hitZone;

      if (orb.z >= hitMin && orb.z <= hitMax) {
        for (const ball of player.world.balls) {
          if (ball.lane === orb.lane) {
            orb.collected = true;
            // Deal damage to OPPONENT
            const opponent = this.players[(1 - orb.targetPlayer) as 0 | 1];
            opponent.hp = Math.max(0, opponent.hp - VS_ORB_DAMAGE);
            break;
          }
        }
      }

      // Despawn past hit zone
      if (orb.z > this.config.despawnZ) {
        orb.collected = true;
      }
    }

    // Remove collected/despawned orbs
    this.orbs = this.orbs.filter((o) => !o.collected);
  }

  getPlayerState(index: 0 | 1): VsPlayerState {
    const p = this.players[index];
    return {
      hp: p.hp,
      score: p.world.score,
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
    }));
  }
}
