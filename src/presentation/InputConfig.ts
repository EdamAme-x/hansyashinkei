export interface InputBinding {
  readonly code: string;
  readonly ballIndex: number;
}

export interface InputConfig {
  readonly dodge: readonly InputBinding[];
  readonly start: readonly string[];
}

export function createDefaultInputConfig(): InputConfig {
  return {
    dodge: [
      { code: "KeyF", ballIndex: 0 },
      { code: "KeyJ", ballIndex: 1 },
    ],
    start: ["Space", "Enter"],
  };
}
