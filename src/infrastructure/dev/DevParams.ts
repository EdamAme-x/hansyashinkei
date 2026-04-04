import type { GameConfig, BallDef } from "@domain/entities/GameConfig";
import type { InputConfig } from "@presentation/InputConfig";

export function applyDevParams(config: GameConfig, inputConfig: InputConfig): void {
  const params = new URLSearchParams(location.search);

  const speed = params.get("__dev__speed");
  if (speed) {
    const mult = Math.max(1, Math.min(20, parseFloat(speed) || 1));
    const mutable = config as { baseSpeed: number; spawnInterval: number };
    mutable.baseSpeed *= mult;
    mutable.spawnInterval /= mult;
  }

  const ball = params.get("__dev__ball");
  if (ball === "1") {
    const mutable = config as unknown as {
      laneCount: number;
      balls: BallDef[];
      wallsPerWave: number;
    };
    mutable.laneCount = 2;
    mutable.balls = [{ homeLane: 1, dodgeLane: 0 }];
    mutable.wallsPerWave = 1;

    // Map all dodge keys to ballIndex 0
    for (const binding of inputConfig.dodge) {
      binding.ballIndex = 0;
    }
  }
}
