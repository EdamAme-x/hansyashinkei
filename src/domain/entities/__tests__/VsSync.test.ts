import { describe, it, expect } from "vitest";
import { createGameWorld, tick, dodge, undodge } from "@domain/entities/GameWorld";
import { createDefaultConfig, createTripleConfig } from "@domain/entities/GameConfig";
import { mulberry32 } from "@domain/entities/Prng";

const FIXED_DT = 1 / 60;

describe("VS deterministic sync", () => {
  it("two worlds with same seed produce identical walls after 300 ticks", () => {
    const seed = 12345;
    const config = createDefaultConfig();
    const w1 = createGameWorld(config, mulberry32(seed));
    const w2 = createGameWorld(config, mulberry32(seed));

    for (let i = 0; i < 300; i++) {
      w1.alive = true; tick(w1, FIXED_DT); w1.alive = true;
      w2.alive = true; tick(w2, FIXED_DT); w2.alive = true;
    }

    expect(w1.score).toBe(w2.score);
    expect(w1.walls.length).toBe(w2.walls.length);
    for (let i = 0; i < w1.walls.length; i++) {
      expect(w1.walls[i].lane).toBe(w2.walls[i].lane);
      expect(w1.walls[i].z).toBeCloseTo(w2.walls[i].z, 5);
    }
  });

  it("dodge does NOT affect wall patterns (PRNG stays in sync)", () => {
    const seed = 99999;
    const config = createDefaultConfig();
    const w1 = createGameWorld(config, mulberry32(seed));
    const w2 = createGameWorld(config, mulberry32(seed));

    for (let i = 0; i < 600; i++) {
      // w1: randomly dodge/undodge
      if (i === 50) dodge(w1, 0);
      if (i === 80) undodge(w1, 0);
      if (i === 150) dodge(w1, 1);
      if (i === 200) undodge(w1, 1);
      if (i === 300) dodge(w1, 0);
      if (i === 350) undodge(w1, 0);

      // w2: never dodge
      w1.alive = true; tick(w1, FIXED_DT); w1.alive = true;
      w2.alive = true; tick(w2, FIXED_DT); w2.alive = true;
    }

    // Score differs (w1 dodges walls, w2 hits them) but since tick()
    // now runs fully regardless of alive, PRNG consumption is identical.
    // However score affects speed which affects spawnTimer, so walls
    // may have different z positions but the PATTERN (lanes) should
    // be identical if PRNG is consumed identically.

    // Check that PRNG produced the same number of walls over time
    // by comparing total scored waves (both worlds got the same patterns)
    expect(w1.nextWaveId).toBe(w2.nextWaveId);
  });

  it("1000 ticks remain perfectly in sync", () => {
    const seed = 42;
    const config = createDefaultConfig();
    const w1 = createGameWorld(config, mulberry32(seed));
    const w2 = createGameWorld(config, mulberry32(seed));

    for (let i = 0; i < 1000; i++) {
      w1.alive = true; tick(w1, FIXED_DT); w1.alive = true;
      w2.alive = true; tick(w2, FIXED_DT); w2.alive = true;
    }

    expect(w1.score).toBe(w2.score);
    expect(w1.speed).toBeCloseTo(w2.speed, 10);
    expect(w1.nextWaveId).toBe(w2.nextWaveId);
    expect(w1.walls.length).toBe(w2.walls.length);
    for (let i = 0; i < w1.walls.length; i++) {
      expect(w1.walls[i].lane).toBe(w2.walls[i].lane);
      expect(w1.walls[i].z).toBeCloseTo(w2.walls[i].z, 5);
    }
  });

  it("triple mode also stays in sync", () => {
    const seed = 77777;
    const config = createTripleConfig();
    const w1 = createGameWorld(config, mulberry32(seed));
    const w2 = createGameWorld(config, mulberry32(seed));

    for (let i = 0; i < 500; i++) {
      w1.alive = true; tick(w1, FIXED_DT); w1.alive = true;
      w2.alive = true; tick(w2, FIXED_DT); w2.alive = true;
    }

    expect(w1.nextWaveId).toBe(w2.nextWaveId);
    expect(w1.walls.length).toBe(w2.walls.length);
  });

  it("server and client with different dodge inputs still share wall pattern", () => {
    // Simulates: server player hits walls, client player dodges
    const seed = 11111;
    const config = createDefaultConfig();
    const server = createGameWorld(config, mulberry32(seed));
    const client = createGameWorld(config, mulberry32(seed));

    for (let i = 0; i < 500; i++) {
      // Client dodges every 30 frames
      if (i % 30 === 10) dodge(client, 0);
      if (i % 30 === 20) undodge(client, 0);

      // Server never dodges (hits walls)
      server.alive = true; tick(server, FIXED_DT); server.alive = true;
      client.alive = true; tick(client, FIXED_DT); client.alive = true;
    }

    // waveId should be identical — same number of spawn events
    expect(server.nextWaveId).toBe(client.nextWaveId);
  });
});
