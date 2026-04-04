import type { ThemeConfig, CustomThemeOverrides } from "@domain/entities/ThemeConfig";
import { getBuiltinThemes, applyOverrides } from "@domain/entities/ThemeConfig";
import type { ThemeRepository } from "@infrastructure/storage/ThemeRepository";

type ThemeChangeListener = (theme: ThemeConfig) => void;

export class ThemeManager {
  private active: ThemeConfig;
  private overrides: CustomThemeOverrides;
  private readonly listeners: ThemeChangeListener[] = [];

  constructor(private readonly repo: ThemeRepository) {
    this.overrides = repo.loadOverrides();
    this.active = repo.load();
  }

  get current(): ThemeConfig {
    return this.active;
  }

  getOverrides(): CustomThemeOverrides {
    return { ...this.overrides };
  }

  getAvailableThemes(): readonly ThemeConfig[] {
    return getBuiltinThemes();
  }

  selectTheme(id: string): boolean {
    const base = getBuiltinThemes().find((t) => t.id === id);
    if (!base) return false;
    this.repo.saveThemeId(id);
    this.active = applyOverrides(base, this.overrides);
    this.notify();
    return true;
  }

  updateOverrides(partial: Partial<CustomThemeOverrides>): void {
    Object.assign(this.overrides, partial);
    this.repo.saveOverrides(this.overrides);

    const baseId = this.repo.loadThemeId();
    const base = getBuiltinThemes().find((t) => t.id === baseId) ?? this.active;
    this.active = applyOverrides(base, this.overrides);
    this.notify();
  }

  onChange(listener: ThemeChangeListener): void {
    this.listeners.push(listener);
  }

  private notify(): void {
    for (const fn of this.listeners) fn(this.active);
  }
}
