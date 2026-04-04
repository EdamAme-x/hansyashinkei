export interface BallDef {
  readonly homeLane: number;
  readonly dodgeLane: number;
}

export interface GameConfig {
  readonly laneCount: number;
  readonly balls: readonly BallDef[];
  readonly wallsPerWave: number;
  readonly baseSpeed: number;
  readonly speedMultiplier: number;
  readonly speedUpInterval: number;
  readonly spawnZ: number;
  readonly despawnZ: number;
  readonly spawnInterval: number;
  readonly hitZone: number;
}

export function computeValidWallLanes(config: GameConfig): number[][] {
  const { laneCount, balls, wallsPerWave } = config;

  const allLanes = Array.from({ length: laneCount }, (_, i) => i);

  const combos = combinations(allLanes, wallsPerWave);

  return combos.filter((combo) => {
    // For each ball, at least one of {homeLane, dodgeLane} must be free
    for (const ball of balls) {
      const homeBlocked = combo.includes(ball.homeLane);
      const dodgeBlocked = combo.includes(ball.dodgeLane);
      if (homeBlocked && dodgeBlocked) return false;
    }
    return true;
  });
}

function combinations(arr: number[], k: number): number[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const with_ = combinations(rest, k - 1).map((c) => [first, ...c]);
  const without = combinations(rest, k);
  return [...with_, ...without];
}

export function createDefaultConfig(): GameConfig {
  return {
    laneCount: 4,
    balls: [
      { homeLane: 1, dodgeLane: 0 },
      { homeLane: 2, dodgeLane: 3 },
    ],
    wallsPerWave: 2,
    baseSpeed: 24,
    speedMultiplier: 1.05,
    speedUpInterval: 100,
    spawnZ: -120,
    despawnZ: 5,
    spawnInterval: 0.7,
    hitZone: 0.8,
  };
}
