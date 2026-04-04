import type { GameConfig } from "./GameConfig";

export interface BallState {
  readonly lane: number;
  readonly dodging: boolean;
}

export function createBalls(config: GameConfig): BallState[] {
  return config.balls.map((b) => ({ lane: b.homeLane, dodging: false }));
}

export function dodgeBall(
  ball: BallState,
  ballIndex: number,
  config: GameConfig,
): BallState {
  if (ball.dodging) return ball;
  const def = config.balls[ballIndex];
  return { lane: def.dodgeLane, dodging: true };
}

export function returnBall(
  ball: BallState,
  ballIndex: number,
  config: GameConfig,
): BallState {
  if (!ball.dodging) return ball;
  const def = config.balls[ballIndex];
  return { lane: def.homeLane, dodging: false };
}
