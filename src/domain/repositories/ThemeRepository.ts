import type { ThemeConfig, CustomThemeOverrides } from "@domain/entities/ThemeConfig";

export interface IThemeRepository {
  load(): ThemeConfig;
  loadThemeId(): string;
  save(theme: ThemeConfig): void;
  saveThemeId(id: string): void;
  loadOverrides(): CustomThemeOverrides;
  saveOverrides(overrides: CustomThemeOverrides): void;
}
