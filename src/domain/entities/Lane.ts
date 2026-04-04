/**
 * 4 lanes indexed 0..3 (left to right).
 * Two balls sit at lanes 1 and 2 initially (center).
 *
 * J key: moves left ball one lane to the left  (1→0), release returns (0→1)
 * K key: moves right ball one lane to the right (2→3), release returns (3→2)
 */
export const LANE_COUNT = 4;

export const enum BallSide {
  Left = 0,
  Right = 1,
}

export interface BallState {
  readonly lane: number;
  readonly dodging: boolean;
}

export function createBalls(): [BallState, BallState] {
  return [
    { lane: 1, dodging: false },
    { lane: 2, dodging: false },
  ];
}

export function dodgeBall(ball: BallState, side: BallSide): BallState {
  if (ball.dodging) return ball;
  const lane = side === BallSide.Left ? ball.lane - 1 : ball.lane + 1;
  if (lane < 0 || lane >= LANE_COUNT) return ball;
  return { lane, dodging: true };
}

export function returnBall(ball: BallState, side: BallSide): BallState {
  if (!ball.dodging) return ball;
  const lane = side === BallSide.Left ? ball.lane + 1 : ball.lane - 1;
  return { lane, dodging: false };
}
