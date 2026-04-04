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
      expect(world.speed).toBe(24);
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
      world.walls.push(createWall(world.wallIdGen, 0, -10));
      tick(world, 0.5);
      // speed=24, dt=0.5 → z += 12
      expect(world.walls[0].z).toBeCloseTo(2, 1);
    });
  });

  describe("tick - collision", () => {
    it("should kill player when wall hits ball on same lane", () => {
      world.walls.push(createWall(world.wallIdGen, 1, -0.5));
      tick(world, 0.01);
      expect(world.alive).toBe(false);
    });

    it("should not kill player when ball dodges to different lane", () => {
      dodge(world, 0);
      world.walls.push(createWall(world.wallIdGen, 1, -0.5));
      tick(world, 0.01);
      expect(world.alive).toBe(true);
    });
  });

  describe("tick - scoring", () => {
    it("should score walls that pass the ball", () => {
      world.walls.push(createWall(world.wallIdGen, 0, 0.9));
      tick(world, 0.01);
      expect(world.score).toBe(1);
    });

    it("should not double-score passed walls", () => {
      world.walls.push(createWall(world.wallIdGen, 0, 0.9));
      tick(world, 0.01);
      tick(world, 0.01);
      expect(world.score).toBe(1);
    });
  });

  describe("tick - speed scaling", () => {
    it("should increase speed after 100 walls dodged", () => {
      world.score = 99;
      world.speed = 24;
      world.walls.push(createWall(world.wallIdGen, 0, 0.9));
      tick(world, 0.01);
      expect(world.score).toBe(100);
      expect(world.speed).toBeCloseTo(24 * 1.05, 4);
    });

    it("should scale speed multiple tiers", () => {
      world.score = 200;
      world.walls.push(createWall(world.wallIdGen, 0, 0.9));
      tick(world, 0.01);
      expect(world.speed).toBeCloseTo(24 * 1.05 ** 2, 4);
    });
  });

  describe("tick - wall despawn", () => {
    it("should remove walls past despawn threshold", () => {
      world.walls.push(createWall(world.wallIdGen, 0, 4.9));
      tick(world, 0.02);
      expect(world.walls).toHaveLength(0);
    });
  });

  describe("tick - wall spawning", () => {
    it("should spawn walls when timer exceeds interval", () => {
      world.spawnTimer = 0.69;
      tick(world, 0.02);
      expect(world.walls.length).toBeGreaterThanOrEqual(2);
    });

    it("should never spawn impossible wall combos", () => {
      for (let i = 0; i < 200; i++) {
        world.spawnTimer = 10;
        tick(world, 0.001);
      }
      const groups = new Map<number, number[]>();
      for (const wall of world.walls) {
        const key = Math.round(wall.z * 100);
        const arr = groups.get(key) ?? [];
        arr.push(wall.lane);
        groups.set(key, arr);
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
      world.walls.push(createWall(world.wallIdGen, 0, -10));
      tick(world, 1);
      expect(world.walls[0].z).toBe(-10);
    });
  });
});
