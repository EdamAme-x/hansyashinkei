import { describe, it, expect } from "vitest";
import {
  computeValidWallLanes,
  createDefaultConfig,
  type GameConfig,
} from "@domain/entities/GameConfig";

describe("computeValidWallLanes", () => {
  it("should exclude impossible pairs for default 4-lane config", () => {
    const config = createDefaultConfig();
    const valid = computeValidWallLanes(config);

    for (const combo of valid) {
      const sorted = [...combo].sort();
      expect(sorted).not.toEqual([0, 1]);
      expect(sorted).not.toEqual([2, 3]);
    }

    expect(valid).toEqual(
      expect.arrayContaining([[0, 2], [0, 3], [1, 2], [1, 3]]),
    );
    expect(valid).toHaveLength(4);
  });

  it("should work with 3-lane 1-ball config", () => {
    const config: GameConfig = {
      ...createDefaultConfig(),
      laneCount: 3,
      balls: [{ homeLane: 1, dodgeLane: 0 }],
      wallsPerWave: 1,
    };
    const valid = computeValidWallLanes(config);

    // Ball can be on lane 0 or 1, so wall on lane 2 is always safe
    // Wall on lane 0 → ball dodges to 0 but can stay at 1 → survivable
    // Wall on lane 1 → ball at home, must dodge to 0 → survivable
    // All single walls are survivable with 1 ball
    expect(valid).toEqual([[0], [1], [2]]);
  });

  it("should work with 3-lane 1-ball 2-walls config", () => {
    const config: GameConfig = {
      ...createDefaultConfig(),
      laneCount: 3,
      balls: [{ homeLane: 1, dodgeLane: 0 }],
      wallsPerWave: 2,
    };
    const valid = computeValidWallLanes(config);

    // {0,1} blocks the ball → invalid
    // {0,2} → ball stays at 1 → valid
    // {1,2} → ball dodges to 0 → valid
    expect(valid).toEqual(expect.arrayContaining([[0, 2], [1, 2]]));
    expect(valid).not.toEqual(expect.arrayContaining([[0, 1]]));
  });
});
