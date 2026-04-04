import { describe, it, expect, beforeEach } from "vitest";
import {
  createGameWorld,
  dodge,
  undodge,
  tick,
  type GameWorldState,
} from "@domain/entities/GameWorld";
import { createDefaultConfig } from "@domain/entities/GameConfig";
import { createWall } from "@domain/entities/Wall";

const config = createDefaultConfig();
const BASE = config.baseSpeed; // 26.4

describe("GameWorld", () => {
  let world: GameWorldState;

  beforeEach(() => {
    world = createGameWorld(config);
  });

  describe("createGameWorld", () => {
    it("should initialize with default state", () => {
      expect(world.balls[0].lane).toBe(1);
      expect(world.balls[1].lane).toBe(2);
      expect(world.walls).toHaveLength(0);
      expect(world.score).toBe(0);
      expect(world.speed).toBe(BASE);
      expect(world.alive).toBe(true);
    });
  });

  describe("dodge / undodge", () => {
    it("should move left ball to dodge lane", () => {
      dodge(world, 0);
      expect(world.balls[0].lane).toBe(0);
      expect(world.balls[0].dodging).toBe(true);
    });

    it("should move right ball to dodge lane", () => {
      dodge(world, 1);
      expect(world.balls[1].lane).toBe(3);
      expect(world.balls[1].dodging).toBe(true);
    });

    it("should return left ball to home lane", () => {
      dodge(world, 0);
      undodge(world, 0);
      expect(world.balls[0].lane).toBe(1);
      expect(world.balls[0].dodging).toBe(false);
    });

    it("should return right ball to home lane", () => {
      dodge(world, 1);
      undodge(world, 1);
      expect(world.balls[1].lane).toBe(2);
      expect(world.balls[1].dodging).toBe(false);
    });
  });

  describe("tick - wall movement", () => {
    it("should move walls forward by speed * dt", () => {
      world.walls.push(createWall(world.wallIdGen, 0, 0, -10));
      tick(world, 0.5);
      expect(world.walls[0].z).toBeCloseTo(-10 + BASE * 0.5, 1);
    });
  });

  describe("tick - collision", () => {
    it("should kill player when wall hits ball on same lane", () => {
      world.walls.push(createWall(world.wallIdGen, 0, 1, -0.5));
      tick(world, 0.01);
      expect(world.alive).toBe(false);
    });

    it("should not kill player when ball dodges to different lane", () => {
      dodge(world, 0);
      world.walls.push(createWall(world.wallIdGen, 0, 1, -0.5));
      tick(world, 0.01);
      expect(world.alive).toBe(true);
    });
  });

  describe("tick - scoring per wave", () => {
    it("should score once per wave, not per wall", () => {
      // Two walls same wave
      world.walls.push(createWall(world.wallIdGen, 0, 0, 0.9));
      world.walls.push(createWall(world.wallIdGen, 0, 3, 0.9));
      tick(world, 0.01);
      expect(world.score).toBe(1);
    });

    it("should score separate waves separately", () => {
      world.walls.push(createWall(world.wallIdGen, 0, 0, 0.9));
      world.walls.push(createWall(world.wallIdGen, 1, 3, 0.9));
      tick(world, 0.01);
      expect(world.score).toBe(2);
    });

    it("should not double-score same wave", () => {
      world.walls.push(createWall(world.wallIdGen, 0, 0, 0.9));
      world.walls.push(createWall(world.wallIdGen, 0, 3, 0.85));
      tick(world, 0.01);
      tick(world, 0.01);
      expect(world.score).toBe(1);
    });
  });

  describe("tick - speed scaling", () => {
    it("should increase speed after 100 waves dodged", () => {
      world.score = 99;
      world.speed = BASE;
      world.walls.push(createWall(world.wallIdGen, 99, 0, 0.9));
      tick(world, 0.01);
      expect(world.score).toBe(100);
      expect(world.speed).toBeCloseTo(BASE * 1.05, 4);
    });
  });

  describe("tick - wall despawn", () => {
    it("should remove walls past despawn threshold", () => {
      world.spawnTimer = 0; // prevent new spawns interfering
      world.walls.push(createWall(world.wallIdGen, 0, 0, 4.8));
      tick(world, 0.02);
      // 4.8 + 26.4*0.02 = 5.328 > despawnZ(5) → removed
      expect(world.walls).toHaveLength(0);
    });
  });

  describe("tick - wall spawning", () => {
    it("should spawn walls immediately (spawnTimer starts at spawnInterval)", () => {
      // spawnTimer starts at config.spawnInterval, so first tick should spawn
      tick(world, 0.01);
      expect(world.walls.length).toBeGreaterThanOrEqual(2);
    });

    it("should never spawn impossible wall combos", () => {
      for (let i = 0; i < 200; i++) {
        world.spawnTimer = 10;
        tick(world, 0.001);
      }
      const groups = new Map<number, number[]>();
      for (const wall of world.walls) {
        const arr = groups.get(wall.waveId) ?? [];
        arr.push(wall.lane);
        groups.set(wall.waveId, arr);
      }
      for (const lanes of groups.values()) {
        if (lanes.length === 2) {
          const sorted = [...lanes].sort();
          expect(sorted).not.toEqual([0, 1]);
          expect(sorted).not.toEqual([2, 3]);
        }
      }
    });
  });

  describe("tick - dead world", () => {
    it("should not tick when alive is false", () => {
      world.alive = false;
      world.walls.push(createWall(world.wallIdGen, 0, 0, -10));
      tick(world, 1);
      expect(world.walls[0].z).toBe(-10);
    });
  });
});
