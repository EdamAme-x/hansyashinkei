export type GameMode = "classic" | "triple";

export function modeName(mode: GameMode): string {
  return mode === "classic" ? "CLASSIC" : "TRIPLE";
}
