import type { GameConfig } from "@domain/entities/GameConfig";
import type { InputConfig } from "@presentation/InputConfig";

/** Parse dev params from query string. Supports both `&` and missing `&` between __dev__ keys. */
function parseDevParams(search: string): Map<string, string> {
  const result = new Map<string, string>();

  // First try normal URLSearchParams
  const normal = new URLSearchParams(search);
  for (const [key, value] of normal) {
    if (key.startsWith("__dev__")) {
      result.set(key, value);
    }
  }

  // Also handle concatenated format: ?__dev__ball=1__dev__speed=2
  // Split on __dev__ boundaries and re-parse
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const parts = raw.split(/(?=__dev__)/);
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq > 0) {
      const key = part.slice(0, eq);
      const value = part.slice(eq + 1);
      if (key.startsWith("__dev__")) {
        result.set(key, value);
      }
    }
  }

  return result;
}

export function applyDevParams(config: GameConfig, inputConfig: InputConfig): void {
  const params = parseDevParams(location.search);

  const speed = params.get("__dev__speed");
  if (speed) {
    const mult = Math.max(1, Math.min(20, parseFloat(speed) || 1));
    const mutable = config as { baseSpeed: number; spawnInterval: number };
    mutable.baseSpeed *= mult;
    mutable.spawnInterval /= mult;
  }

  const ball = params.get("__dev__ball");
  if (ball === "1") {
    Object.assign(config, {
      laneCount: 2,
      balls: [{ homeLane: 1, dodgeLane: 0 }],
      wallsPerWave: 1,
    });

    for (const binding of inputConfig.dodge) {
      binding.ballIndex = 0;
    }
  }
}
