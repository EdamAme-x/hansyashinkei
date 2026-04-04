import { describe, it, expect, beforeEach } from "vitest";
import {
  createGameWorld,
  dodge,
  undodge,
  tick,
  type GameWorldState,
} from "@domain/entities/GameWorld";
import { BallSide } from "@domain/entities/Lane";
import { createWall } from "@domain/entities/Wall";

describe("GameWorld", () => {
  let world: GameWorldState;

  beforeEach(() => {
    world = createGameWorld();
  });

  describe("createGameWorld", () => {
    it("should initialize with default state", () => {
      expect(world.balls[0].lane).toBe(1);
      expect(world.balls[1].lane).toBe(2);
      expect(world.walls).toHaveLength(0);
      expect(world.score).toBe(0);
      expect(world.speed).toBe(8);
      expect(world.alive).toBe(true);
    });
  });

  describe("dodge / undodge", () => {
    it("should move left ball to lane 0 on dodge", () => {
      dodge(world, BallSide.Left);
      expect(world.balls[0].lane).toBe(0);
      expect(world.balls[0].dodging).toBe(true);
    });

    it("should move right ball to lane 3 on dodge", () => {
      dodge(world, BallSide.Right);
      expect(world.balls[1].lane).toBe(3);
      expect(world.balls[1].dodging).toBe(true);
    });

    it("should return left ball to lane 1 on undodge", () => {
      dodge(world, BallSide.Left);
      undodge(world, BallSide.Left);
      expect(world.balls[0].lane).toBe(1);
      expect(world.balls[0].dodging).toBe(false);
    });

    it("should return right ball to lane 2 on undodge", () => {
      dodge(world, BallSide.Right);
      undodge(world, BallSide.Right);
      expect(world.balls[1].lane).toBe(2);
      expect(world.balls[1].dodging).toBe(false);
    });
  });

  describe("tick - wall movement", () => {
    it("should move walls forward by speed * dt", () => {
      world.walls.push(createWall(world.wallIdGen, 0, -10));
      tick(world, 0.5);
      expect(world.walls[0].z).toBeCloseTo(-6, 1);
    });
  });

  describe("tick - collision", () => {
    it("should kill player when wall hits ball on same lane", () => {
      world.walls.push(createWall(world.wallIdGen, 1, -0.5));
      tick(world, 0.1);
      expect(world.alive).toBe(false);
    });

    it("should not kill player when ball dodges to different lane", () => {
      dodge(world, BallSide.Left);
      world.walls.push(createWall(world.wallIdGen, 1, -0.5));
      tick(world, 0.1);
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
      world.speed = 8;
      world.walls.push(createWall(world.wallIdGen, 0, 0.9));
      tick(world, 0.01);
      expect(world.score).toBe(100);
      expect(world.speed).toBeCloseTo(8 * 1.05, 4);
    });

    it("should scale speed multiple tiers", () => {
      world.score = 200;
      world.walls.push(createWall(world.wallIdGen, 0, 0.9));
      tick(world, 0.01);
      expect(world.speed).toBeCloseTo(8 * 1.05 ** 2, 4);
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
      world.spawnTimer = 1.19;
      tick(world, 0.02);
      expect(world.walls.length).toBeGreaterThanOrEqual(2);
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
