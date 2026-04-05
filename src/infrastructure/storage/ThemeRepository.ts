import type { ThemeConfig, CustomThemeOverrides } from "@domain/entities/ThemeConfig";
import { createDefaultTheme, getBuiltinThemes, createEmptyOverrides, applyOverrides } from "@domain/entities/ThemeConfig";
import type { IThemeRepository } from "@domain/repositories/ThemeRepository";
import type { KVStore } from "@domain/repositories/KVStore";

const THEME_KEY = "hs-theme";
const OVERRIDES_KEY = "hs-theme-overrides";

export class ThemeRepository implements IThemeRepository {
  constructor(private readonly kv: KVStore) {}

  loadThemeId(): string {
    try {
      const raw = this.kv.get(THEME_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { id?: string };
        if (typeof parsed.id === "string") return parsed.id;
      }
    } catch { /* ignore */ }
    return "default";
  }

  load(): ThemeConfig {
    const id = this.loadThemeId();
    const base = getBuiltinThemes().find((t) => t.id === id) ?? createDefaultTheme();
    const overrides = this.loadOverrides();
    return applyOverrides(base, overrides);
  }

  saveThemeId(id: string): void {
    this.kv.set(THEME_KEY, JSON.stringify({ id }));
  }

  save(theme: ThemeConfig): void {
    this.saveThemeId(theme.id);
  }

  loadOverrides(): CustomThemeOverrides {
    try {
      const raw = this.kv.get(OVERRIDES_KEY);
      if (raw) return { ...createEmptyOverrides(), ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return createEmptyOverrides();
  }

  saveOverrides(overrides: CustomThemeOverrides): void {
    this.kv.set(OVERRIDES_KEY, JSON.stringify(overrides));
  }
}
