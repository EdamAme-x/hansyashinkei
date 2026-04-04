import { describe, it, expect, beforeEach } from "vitest";
import { createWall, createWallIdGen, type WallIdGen } from "@domain/entities/Wall";

describe("Wall", () => {
  let idGen: WallIdGen;

  beforeEach(() => {
    idGen = createWallIdGen();
  });

  it("should create a wall with given waveId, lane and z", () => {
    const wall = createWall(idGen, 0, 2, -60);
    expect(wall.waveId).toBe(0);
    expect(wall.lane).toBe(2);
    expect(wall.z).toBe(-60);
    expect(wall.passed).toBe(false);
  });

  it("should assign incrementing ids", () => {
    const w1 = createWall(idGen, 0, 0, -60);
    const w2 = createWall(idGen, 0, 1, -60);
    expect(w1.id).toBe(0);
    expect(w2.id).toBe(1);
  });

  it("should reset id counter", () => {
    createWall(idGen, 0, 0, -60);
    idGen.reset();
    const w = createWall(idGen, 0, 0, -60);
    expect(w.id).toBe(0);
  });

  it("should isolate id generators", () => {
    const gen2 = createWallIdGen();
    createWall(idGen, 0, 0, -60);
    const w = createWall(gen2, 0, 0, -60);
    expect(w.id).toBe(0);
  });
});
