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
import { mulberry32 } from "@domain/entities/Prng";

const config = createDefaultConfig();
const BASE = config.baseSpeed;

describe("GameWorld", () => {
  let world: GameWorldState;

  beforeEach(() => {
    world = createGameWorld(config, mulberry32(42));
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
      world.spawnTimer = 0;
      world.walls.push(createWall(world.wallIdGen, 0, 0, -10));
      tick(world, 0.1);
      // -10 + 31.68 * 0.1 = -6.832
      expect(world.walls[0].z).toBeCloseTo(-10 + BASE * 0.1, 1);
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

  describe("tick - speed scaling (diminishing)", () => {
    it("should increase speed after 100 waves dodged", () => {
      world.score = 99;
      world.speed = BASE;
      world.walls.push(createWall(world.wallIdGen, 99, 0, 0.9));
      tick(world, 0.01);
      expect(world.score).toBe(100);
      // tier 1: BASE * 1.15
      expect(world.speed).toBeCloseTo(BASE * 1.15, 2);
    });

    it("should diminish speed increase each tier", () => {
      world.score = 199;
      world.walls.push(createWall(world.wallIdGen, 199, 0, 0.9));
      tick(world, 0.01);
      // tier 2: BASE * 1.15 * 1.0375  (mult /= 4 each tier)
      expect(world.speed).toBeCloseTo(BASE * 1.15 * 1.0375, 2);
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
    it("should spawn walls on first tick (spawnTimer starts at spawnInterval)", () => {
      // spawnTimer starts at config.spawnInterval; warmup slows speed so
      // baseInterval = spawnInterval / warmupScale. Need enough dt to cross.
      tick(world, 0.2);
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

  describe("determinism", () => {
    it("should produce identical results with same seed and inputs", () => {
      const w1 = createGameWorld(config, mulberry32(999));
      const w2 = createGameWorld(config, mulberry32(999));

      for (let i = 0; i < 100; i++) {
        if (i === 20) { dodge(w1, 0); dodge(w2, 0); }
        if (i === 25) { undodge(w1, 0); undodge(w2, 0); }
        tick(w1, 0.016);
        tick(w2, 0.016);
        if (!w1.alive || !w2.alive) break;
      }

      expect(w1.score).toBe(w2.score);
      expect(w1.speed).toBe(w2.speed);
      expect(w1.alive).toBe(w2.alive);
      expect(w1.walls.length).toBe(w2.walls.length);
    });
  });
});
