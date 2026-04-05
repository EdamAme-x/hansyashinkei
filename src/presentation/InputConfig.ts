export type { InputBinding, InputConfig } from "@domain/entities/InputConfig";
import type { InputBinding, InputConfig } from "@domain/entities/InputConfig";
import type { KVStore } from "@domain/repositories/KVStore";

const STORAGE_KEY = "hs-keybinds";

const DEFAULT_DODGE: InputBinding[] = [
  { code: "KeyF", ballIndex: 0 },
  { code: "KeyJ", ballIndex: 1 },
  { code: "ArrowLeft", ballIndex: 0 },
  { code: "ArrowRight", ballIndex: 1 },
  { code: "KeyB", ballIndex: 2 },
  { code: "ArrowDown", ballIndex: 2 },
];

const DEFAULT_START = ["Space", "Enter"];

export function loadInputConfig(kv: KVStore): InputConfig {
  try {
    const raw = kv.get(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as { dodge?: InputBinding[] };
      if (Array.isArray(saved.dodge) && saved.dodge.length > 0) {
        const codes = new Set(saved.dodge.map((b) => b.code));
        const merged = [...saved.dodge];
        for (const def of DEFAULT_DODGE) {
          if (!codes.has(def.code)) {
            merged.push({ ...def });
          }
        }
        return { dodge: merged, start: DEFAULT_START };
      }
    }
  } catch {
    // ignore
  }
  return createDefaultInputConfig();
}

export function saveInputConfig(kv: KVStore, config: InputConfig): void {
  kv.set(STORAGE_KEY, JSON.stringify({ dodge: config.dodge }));
}

export function createDefaultInputConfig(): InputConfig {
  return {
    dodge: DEFAULT_DODGE.map((b) => ({ ...b })),
    start: [...DEFAULT_START],
  };
}

export function codeToLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const map: Record<string, string> = {
    Space: "SPACE", Enter: "ENTER", ShiftLeft: "L-SHIFT", ShiftRight: "R-SHIFT",
    ControlLeft: "L-CTRL", ControlRight: "R-CTRL", AltLeft: "L-ALT", AltRight: "R-ALT",
    ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓",
    Backspace: "⌫", Tab: "TAB", CapsLock: "CAPS",
  };
  return map[code] ?? code;
}
