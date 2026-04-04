import type { ThemeConfig } from "@domain/entities/ThemeConfig";
import { getBuiltinThemes } from "@domain/entities/ThemeConfig";
import type { ThemeRepository } from "@infrastructure/storage/ThemeRepository";

export class ThemeManager {
  private active: ThemeConfig;

  constructor(private readonly repo: ThemeRepository) {
    this.active = repo.load();
  }

  get current(): ThemeConfig {
    return this.active;
  }

  getAvailableThemes(): readonly ThemeConfig[] {
    return getBuiltinThemes();
  }

  selectTheme(id: string): boolean {
    const theme = getBuiltinThemes().find((t) => t.id === id);
    if (!theme) return false;
    this.active = theme;
    this.repo.save(theme);
    return true;
  }
}
