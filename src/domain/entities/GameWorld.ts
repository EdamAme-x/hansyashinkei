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
}

export function createGameWorld(config: GameConfig): GameWorldState {
  const world: GameWorldState = {
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
  };
  return world;
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
  const { validWallLanes } = world;
  const lanes = validWallLanes[Math.floor(Math.random() * validWallLanes.length)];
  const waveId = world.nextWaveId++;
  for (const lane of lanes) {
    world.walls.push(createWall(world.wallIdGen, waveId, lane, world.config.spawnZ));
  }
}

function computeSpeed(config: GameConfig, score: number): number {
  const tier = Math.floor(score / config.speedUpInterval);
  return config.baseSpeed * Math.pow(config.speedMultiplier, tier);
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
