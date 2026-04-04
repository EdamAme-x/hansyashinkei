import {
  LANE_COUNT,
  BallSide,
  type BallState,
  createBalls,
  dodgeBall,
  returnBall,
} from "./Lane";
import { createWall, createWallIdGen, type Wall, type WallIdGen } from "./Wall";

const BASE_SPEED = 24;
const SPEED_MULTIPLIER = 1.05;
const SPEED_UP_INTERVAL = 100;
const WALL_SPAWN_Z = -120;
const BALL_Z = 0;
const WALL_DESPAWN_Z = 5;
const SPAWN_INTERVAL_BASE = 0.7;

export interface GameWorldState {
  balls: [BallState, BallState];
  walls: Wall[];
  score: number;
  speed: number;
  spawnTimer: number;
  alive: boolean;
  wallIdGen: WallIdGen;
}

export function createGameWorld(): GameWorldState {
  return {
    balls: createBalls(),
    walls: [],
    score: 0,
    speed: BASE_SPEED,
    spawnTimer: 0,
    alive: true,
    wallIdGen: createWallIdGen(),
  };
}

export function dodge(world: GameWorldState, side: BallSide): void {
  const idx = side === BallSide.Left ? 0 : 1;
  world.balls[idx] = dodgeBall(world.balls[idx], side);
}

export function undodge(world: GameWorldState, side: BallSide): void {
  const idx = side === BallSide.Left ? 0 : 1;
  world.balls[idx] = returnBall(world.balls[idx], side);
}

function spawnWallPair(world: GameWorldState): void {
  const lanes: number[] = [];
  while (lanes.length < 2) {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    if (!lanes.includes(lane)) lanes.push(lane);
  }

  for (const lane of lanes) {
    world.walls.push(createWall(world.wallIdGen, lane, WALL_SPAWN_Z));
  }
}

function computeSpeed(score: number): number {
  const tier = Math.floor(score / SPEED_UP_INTERVAL);
  return BASE_SPEED * Math.pow(SPEED_MULTIPLIER, tier);
}

export function tick(world: GameWorldState, dt: number): void {
  if (!world.alive) return;

  // Move walls toward camera
  for (const wall of world.walls) {
    wall.z += world.speed * dt;
  }

  // Collision detection at ball z
  const hitZone = 0.8;
  for (const wall of world.walls) {
    if (wall.passed) continue;
    if (wall.z >= BALL_Z - hitZone && wall.z <= BALL_Z + hitZone) {
      for (const ball of world.balls) {
        if (ball.lane === wall.lane) {
          world.alive = false;
          return;
        }
      }
    }
  }

  // Score passed walls
  for (const wall of world.walls) {
    if (!wall.passed && wall.z > BALL_Z + hitZone) {
      wall.passed = true;
      world.score++;
    }
  }

  // Speed update
  world.speed = computeSpeed(world.score);

  // Despawn walls
  world.walls = world.walls.filter((w) => w.z < WALL_DESPAWN_Z);

  // Spawn timer
  const spawnInterval = SPAWN_INTERVAL_BASE * (BASE_SPEED / world.speed);
  world.spawnTimer += dt;
  if (world.spawnTimer >= spawnInterval) {
    world.spawnTimer -= spawnInterval;
    spawnWallPair(world);
  }
}
