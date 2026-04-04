import type { ThemeManager } from "./ThemeManager";

function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing element #${id}`);
  return e;
}

export class ThemeUI {
  private readonly screen = el("theme-screen");
  private readonly list = el("theme-list");
  private readonly closeBtn = el("theme-close");
  private readonly manager: ThemeManager;
  private readonly onSelect: () => void;

  constructor(manager: ThemeManager, onSelect: () => void) {
    this.manager = manager;
    this.onSelect = onSelect;
    this.closeBtn.addEventListener("click", () => this.hide());
  }

  show(): void {
    while (this.list.firstChild) this.list.removeChild(this.list.firstChild);

    const themes = this.manager.getAvailableThemes();
    const currentId = this.manager.current.id;

    for (const theme of themes) {
      const item = document.createElement("button");
      item.className = "theme-item";
      if (theme.id === currentId) item.classList.add("active");

      // Color preview
      const preview = document.createElement("span");
      preview.className = "theme-preview";
      const bg = theme.scene.background.type === "color" ? theme.scene.background.hex : 0x000000;
      preview.style.background = `#${bg.toString(16).padStart(6, "0")}`;
      preview.style.borderColor = `#${theme.scene.wallEdgeColor.toString(16).padStart(6, "0")}`;
      item.appendChild(preview);

      const label = document.createElement("span");
      label.className = "theme-label";
      label.textContent = theme.label;
      item.appendChild(label);

      if (theme.id === currentId) {
        const check = document.createElement("span");
        check.className = "theme-check";
        check.textContent = "✓";
        item.appendChild(check);
      }

      item.addEventListener("click", () => {
        this.manager.selectTheme(theme.id);
        this.hide();
        this.onSelect();
      });

      this.list.appendChild(item);
    }

    this.screen.classList.remove("hidden");
  }

  hide(): void {
    this.screen.classList.add("hidden");
  }
}
