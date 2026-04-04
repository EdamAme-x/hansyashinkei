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
  readonly spawnJitter: number;
  readonly hitZone: number;
  readonly warmup: readonly { readonly until: number; readonly speedScale: number }[];
  readonly render: {
    readonly laneWidth: number;
    readonly ballRadius: number;
    readonly ballY: number;
    readonly wallHeight: number;
    readonly wallDepth: number;
  };
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
    baseSpeed: 32.472,
    speedMultiplier: 1.15,
    speedUpInterval: 100,
    spawnZ: -80,
    despawnZ: 5,
    spawnInterval: 0.45084,
    spawnJitter: 0.4,
    hitZone: 0.55,
    warmup: [
      { until: 20, speedScale: 0.75 },
      { until: 50, speedScale: 0.85 },
      { until: 100, speedScale: 1.0 },
    ],
    render: {
      laneWidth: 2.5,
      ballRadius: 1.056,
      ballY: 1.0,
      wallHeight: 3.5,
      wallDepth: 0.5,
    },
  };
}

export function createTripleConfig(): GameConfig {
  return {
    laneCount: 6,
    balls: [
      { homeLane: 1, dodgeLane: 0 },
      { homeLane: 3, dodgeLane: 2 },
      { homeLane: 4, dodgeLane: 5 },
    ],
    wallsPerWave: 3,
    baseSpeed: 32.472,
    speedMultiplier: 1.15,
    speedUpInterval: 100,
    spawnZ: -80,
    despawnZ: 5,
    spawnInterval: 0.5,
    spawnJitter: 0.4,
    hitZone: 0.55,
    warmup: [
      { until: 20, speedScale: 0.75 },
      { until: 50, speedScale: 0.85 },
      { until: 100, speedScale: 1.0 },
    ],
    render: {
      laneWidth: 2.5,
      ballRadius: 1.056,
      ballY: 1.0,
      wallHeight: 3.5,
      wallDepth: 0.5,
    },
  };
}
