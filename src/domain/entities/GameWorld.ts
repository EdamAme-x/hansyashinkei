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
    mult /= 4;
  }

  // Warmup: smoothly ramp from reduced speed to full speed
  // warmup entries define checkpoints: [{until:20, scale:0.8}, {until:50, scale:0.9}]
  // score 0→20: lerp 0.8→0.9, score 20→50: lerp 0.9→1.0, score 50+: 1.0
  const { warmup } = config;
  if (warmup.length > 0) {
    const lastWarmup = warmup[warmup.length - 1].until;
    if (score < lastWarmup) {
      let fromScore = 0;
      let fromScale = warmup[0].speedScale;
      let toScore = warmup[0].until;
      let toScale = warmup.length > 1 ? warmup[1].speedScale : 1;

      for (let i = 0; i < warmup.length; i++) {
        if (score < warmup[i].until) {
          fromScore = i === 0 ? 0 : warmup[i - 1].until;
          fromScale = warmup[i].speedScale;
          toScore = warmup[i].until;
          toScale = i + 1 < warmup.length ? warmup[i + 1].speedScale : 1;
          break;
        }
      }

      const t = (score - fromScore) / (toScore - fromScore);
      speed *= fromScale + (toScale - fromScale) * t;
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

  for (const wall of world.walls) {
    wall.z += world.speed * dt;
  }

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

  const baseInterval = config.spawnInterval * (config.baseSpeed / world.speed);
  world.spawnTimer += dt;
  if (world.spawnTimer >= baseInterval) {
    const jitter = (prng() - 0.5) * 2 * config.spawnJitter * baseInterval;
    world.spawnTimer = jitter;
    spawnWalls(world);
  }
}
