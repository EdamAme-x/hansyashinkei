import type { GameConfig } from "./GameConfig";
import { computeValidWallLanes } from "./GameConfig";
import type { Prng } from "./Prng";
import {
  type BallState,
  createBalls,
  dodgeBall,
  returnBall,
} from "./Lane";
import { createWall, createWallIdGen, type Wall, type WallIdGen } from "./Wall";

const BALL_Z = 0;

export interface GameWorldState {
  readonly config: GameConfig;
  readonly prng: Prng;
  balls: BallState[];
  walls: Wall[];
  score: number;
  speed: number;
  spawnTimer: number;
  alive: boolean;
  wallIdGen: WallIdGen;
  validWallLanes: number[][];
  nextWaveId: number;
  scoredWaves: Set<number>;
  lastPatternIndex: number;
}

export function createGameWorld(config: GameConfig, prng: Prng): GameWorldState {
  return {
    config,
    prng,
    balls: createBalls(config),
    walls: [],
    score: 0,
    speed: config.baseSpeed,
    spawnTimer: config.spawnInterval,
    alive: true,
    wallIdGen: createWallIdGen(),
    validWallLanes: computeValidWallLanes(config),
    nextWaveId: 0,
    scoredWaves: new Set(),
    lastPatternIndex: -1,
  };
}

export function dodge(world: GameWorldState, ballIndex: number): void {
  world.balls[ballIndex] = dodgeBall(
    world.balls[ballIndex],
    ballIndex,
    world.config,
  );
}

export function undodge(world: GameWorldState, ballIndex: number): void {
  world.balls[ballIndex] = returnBall(
    world.balls[ballIndex],
    ballIndex,
    world.config,
  );
}

function spawnWalls(world: GameWorldState): void {
  const { validWallLanes, lastPatternIndex, prng } = world;
  const weights = validWallLanes.map((_, i) => (i === lastPatternIndex ? 1 : 3));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let roll = prng() * totalWeight;
  let chosen = 0;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      chosen = i;
      break;
    }
  }

  world.lastPatternIndex = chosen;
  const lanes = validWallLanes[chosen];
  const waveId = world.nextWaveId++;
  for (const lane of lanes) {
    world.walls.push(createWall(world.wallIdGen, waveId, lane, world.config.spawnZ));
  }
}

function computeSpeed(config: GameConfig, score: number): number {
  const tiers = Math.floor(score / config.speedUpInterval);
  let speed = config.baseSpeed;
  let mult = config.speedMultiplier - 1;
  for (let i = 0; i < tiers; i++) {
    speed *= 1 + mult;
    mult /= 3;
  }

  // Warmup: smoothly ramp speed scale between checkpoints
  const { warmup } = config;
  if (warmup.length > 0 && score < warmup[warmup.length - 1].until) {
    for (let i = 0; i < warmup.length; i++) {
      if (score < warmup[i].until) {
        const fromScore = i === 0 ? 0 : warmup[i - 1].until;
        const fromScale = warmup[i].speedScale;
        const toScale = i + 1 < warmup.length ? warmup[i + 1].speedScale : 1;
        const t = (score - fromScore) / (warmup[i].until - fromScore);
        speed *= fromScale + (toScale - fromScale) * t;
        break;
      }
    }
  }

  return speed;
}

export function getSpeedTier(config: GameConfig, score: number): number {
  return Math.floor(score / config.speedUpInterval);
}

export function tick(world: GameWorldState, dt: number): void {
  if (!world.alive) return;

  const { config, prng } = world;

  const hitMin = BALL_Z - config.hitZone;
  const hitMax = BALL_Z + config.hitZone;

  let hit = false;

  for (const wall of world.walls) {
    const prevZ = wall.z;
    wall.z += world.speed * dt;

    if (wall.passed) continue;
    if (!hit && prevZ <= hitMax && wall.z >= hitMin) {
      for (const ball of world.balls) {
        if (ball.lane === wall.lane) {
          hit = true;
          break;
        }
      }
    }
  }

  for (const wall of world.walls) {
    if (!wall.passed && wall.z > BALL_Z + config.hitZone) {
      wall.passed = true;
      if (!world.scoredWaves.has(wall.waveId)) {
        world.scoredWaves.add(wall.waveId);
        world.score++;
      }
    }
  }

  world.speed = computeSpeed(config, world.score);
  world.walls = world.walls.filter((w) => w.z < config.despawnZ);

  // Spawn interval warmup: 1.15x at score 0 → 1.0x at score 100
  const spawnScale = Math.max(1, 1.15 - 0.15 * (world.score / 100));
  const baseInterval = config.spawnInterval * spawnScale * (config.baseSpeed / world.speed);
  world.spawnTimer += dt;
  if (world.spawnTimer >= baseInterval) {
    const jitter = (prng() - 0.5) * 2 * config.spawnJitter * baseInterval;
    world.spawnTimer = jitter;
    spawnWalls(world);
  }

  // Set alive=false AFTER all tick logic (PRNG consumption is deterministic)
  if (hit) {
    world.alive = false;
  }
}
