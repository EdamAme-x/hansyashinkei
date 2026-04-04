import type { GameConfig } from "./GameConfig";

export const REPLAY_VERSION = 1;

export interface ReplayEvent {
  readonly frame: number;
  readonly type: "dodge" | "undodge";
  readonly ballIndex: number;
}

export interface Replay {
  readonly version: number;
  readonly id: string;
  readonly scoreId: string;
  readonly seed: number;
  readonly config: GameConfig;
  readonly finalScore: number;
  readonly timestamp: number;
  readonly dts: number[];
  readonly events: ReplayEvent[];
}

export function createReplay(
  id: string,
  scoreId: string,
  seed: number,
  config: GameConfig,
  finalScore: number,
  dts: number[],
  events: ReplayEvent[],
): Replay {
  return {
    version: REPLAY_VERSION,
    id,
    scoreId,
    seed,
    config,
    finalScore,
    timestamp: Date.now(),
    dts,
    events,
  };
}
