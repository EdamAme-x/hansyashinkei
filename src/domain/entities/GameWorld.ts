import type { GameConfig } from "./GameConfig";
import { computeValidWallLanes } from "./GameConfig";
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

export function createGameWorld(config: GameConfig): GameWorldState {
  return {
    config,
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

// Weighted spawn: same pattern as last wave gets 1x weight, others get 3x
function spawnWalls(world: GameWorldState): void {
  const { validWallLanes, lastPatternIndex } = world;
  const weights = validWallLanes.map((_, i) => (i === lastPatternIndex ? 1 : 3));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let roll = Math.random() * totalWeight;
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

// Diminishing speed-up: multiplier halves each tier
// tier 0: base, tier 1: x1.15, tier 2: x1.15*1.075, tier 3: x1.15*1.075*1.0375...
function computeSpeed(config: GameConfig, score: number): number {
  const tiers = Math.floor(score / config.speedUpInterval);
  let speed = config.baseSpeed;
  let mult = config.speedMultiplier - 1; // 0.15
  for (let i = 0; i < tiers; i++) {
    speed *= 1 + mult;
    mult /= 2;
  }
  return speed;
}

export function getSpeedTier(config: GameConfig, score: number): number {
  return Math.floor(score / config.speedUpInterval);
}

export function tick(world: GameWorldState, dt: number): void {
  if (!world.alive) return;

  const { config } = world;

  for (const wall of world.walls) {
    wall.z += world.speed * dt;
  }

  // Collision
  for (const wall of world.walls) {
    if (wall.passed) continue;
    if (wall.z >= BALL_Z - config.hitZone && wall.z <= BALL_Z + config.hitZone) {
      for (const ball of world.balls) {
        if (ball.lane === wall.lane) {
          world.alive = false;
          return;
        }
      }
    }
  }

  // Score — per wave, not per wall
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

  // Spawn with jitter
  const baseInterval = config.spawnInterval * (config.baseSpeed / world.speed);
  world.spawnTimer += dt;
  if (world.spawnTimer >= baseInterval) {
    const jitter = (Math.random() - 0.5) * 2 * config.spawnJitter * baseInterval;
    world.spawnTimer = jitter;
    spawnWalls(world);
  }
}
