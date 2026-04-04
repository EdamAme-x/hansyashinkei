import type { ThemeConfig, CustomThemeOverrides } from "@domain/entities/ThemeConfig";
import { getBuiltinThemes, applyOverrides } from "@domain/entities/ThemeConfig";
import type { IThemeRepository } from "@domain/repositories/ThemeRepository";
import type { IImageStore } from "@domain/repositories/ImageStore";

type ThemeChangeListener = (theme: ThemeConfig) => void;

export class ThemeManager {
  private active: ThemeConfig;
  private overrides: CustomThemeOverrides;
  private readonly listeners: ThemeChangeListener[] = [];

  constructor(
    private readonly repo: IThemeRepository,
    private readonly imageStore: IImageStore,
  ) {
    this.overrides = repo.loadOverrides();
    this.active = repo.load();
  }

  /** Load images from IndexedDB and apply to overrides. Call after construction. */
  async init(): Promise<void> {
    if (this.overrides.hasBackground) {
      const url = await this.imageStore.load("bg");
      if (url) this.overrides.backgroundUrl = url;
      else this.overrides.hasBackground = false;
    }
    if (this.overrides.hasWallTexture) {
      const url = await this.imageStore.load("wall");
      if (url) this.overrides.wallTextureUrl = url;
      else this.overrides.hasWallTexture = false;
    }
    if (this.overrides.hasBgm) {
      const url = await this.imageStore.load("bgm");
      if (url) this.overrides.bgmUrl = url;
      else this.overrides.hasBgm = false;
    }

    this.rebuild();
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
    this.rebuild();
    this.notify();
    return true;
  }

  updateOverrides(partial: Partial<CustomThemeOverrides>): void {
    Object.assign(this.overrides, partial);

    // Only persist small flags, not data URLs
    this.repo.saveOverrides({
      hasBackground: this.overrides.hasBackground,
      hasWallTexture: this.overrides.hasWallTexture,
      hasBgm: this.overrides.hasBgm,
    });

    this.rebuild();
    this.notify();
  }

  onChange(listener: ThemeChangeListener): void {
    this.listeners.push(listener);
  }

  private rebuild(): void {
    const baseId = this.repo.loadThemeId();
    const base = getBuiltinThemes().find((t) => t.id === baseId) ?? this.active;
    this.active = applyOverrides(base, this.overrides);
  }

  private notify(): void {
    for (const fn of this.listeners) fn(this.active);
  }
}
