import type { ThemeConfig } from "@domain/entities/ThemeConfig";
import { createDefaultTheme, getBuiltinThemes } from "@domain/entities/ThemeConfig";

const STORAGE_KEY = "hansyashinkei-theme";

export class ThemeRepository {
  load(): ThemeConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { id?: string };
        if (typeof parsed.id === "string") {
          const found = getBuiltinThemes().find((t) => t.id === parsed.id);
          if (found) return found;
        }
      }
    } catch {
      // ignore
    }
    return createDefaultTheme();
  }

  save(theme: ThemeConfig): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: theme.id }));
  }
}
