import type { GameConfig } from "@domain/entities/GameConfig";

export function applyDevParams(config: GameConfig): void {
  const params = new URLSearchParams(location.search);

  const speed = params.get("__dev__speed");
  if (speed) {
    const mult = Math.max(1, Math.min(20, parseFloat(speed) || 1));
    const mutable = config as { baseSpeed: number; spawnInterval: number };
    mutable.baseSpeed *= mult;
    mutable.spawnInterval /= mult;
  }
}
