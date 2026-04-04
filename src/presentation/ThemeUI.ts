import type { ThemeManager } from "./ThemeManager";
import type { ImageStore } from "@infrastructure/storage/ImageStore";

function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing element #${id}`);
  return e;
}

function hexToInput(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

function inputToHex(value: string): number {
  return parseInt(value.replace("#", ""), 16);
}

export class ThemeUI {
  private readonly screen = el("theme-screen");
  private readonly list = el("theme-list");
  private readonly closeBtn = el("theme-close");
  private readonly bgFileInput = el("theme-bg-file") as HTMLInputElement;
  private readonly bgClearBtn = el("theme-bg-clear");
  private readonly wallFileInput = el("theme-wall-file") as HTMLInputElement;
  private readonly wallClearBtn = el("theme-wall-clear");
  private readonly wallEdgeColorInput = el("theme-wall-edge-color") as HTMLInputElement;
  private readonly wallColorInput = el("theme-wall-color") as HTMLInputElement;
  private readonly manager: ThemeManager;
  private readonly imageStore: ImageStore;

  constructor(manager: ThemeManager, imageStore: ImageStore) {
    this.manager = manager;
    this.imageStore = imageStore;

    this.closeBtn.addEventListener("click", () => this.hide());
    this.bgFileInput.addEventListener("change", () => this.onBgFile());
    this.bgClearBtn.addEventListener("click", () => this.clearBg());
    this.wallFileInput.addEventListener("change", () => this.onWallFile());
    this.wallClearBtn.addEventListener("click", () => this.clearWall());
    this.wallEdgeColorInput.addEventListener("input", () => this.onEdgeColor());
    this.wallColorInput.addEventListener("input", () => this.onWallColor());
  }

  show(): void {
    this.renderPresets();
    this.syncInputs();
    this.screen.classList.remove("hidden");
  }

  hide(): void {
    this.screen.classList.add("hidden");
  }

  private renderPresets(): void {
    while (this.list.firstChild) this.list.removeChild(this.list.firstChild);

    const themes = this.manager.getAvailableThemes();
    const currentId = this.manager.current.id;

    for (const theme of themes) {
      const item = document.createElement("button");
      item.className = "theme-item";
      if (theme.id === currentId) item.classList.add("active");

      const preview = document.createElement("span");
      preview.className = "theme-preview";
      const bg = theme.scene.background.type === "color" ? theme.scene.background.hex : 0x000000;
      preview.style.background = hexToInput(bg);
      preview.style.borderColor = hexToInput(theme.scene.wallEdgeColor);
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
        this.renderPresets();
      });

      this.list.appendChild(item);
    }
  }

  private syncInputs(): void {
    const overrides = this.manager.getOverrides();
    const scene = this.manager.current.scene;
    this.wallEdgeColorInput.value = hexToInput(overrides.wallEdgeColor ?? scene.wallEdgeColor);
    this.wallColorInput.value = hexToInput(overrides.wallColor ?? scene.wallColor);
  }

  private async onBgFile(): Promise<void> {
    const file = this.bgFileInput.files?.[0];
    if (!file) return;
    const dataUrl = await this.imageStore.save("bg", file);
    this.manager.updateOverrides({ backgroundUrl: dataUrl });
    this.bgFileInput.value = "";
  }

  private clearBg(): void {
    this.imageStore.remove("bg").catch(() => {});
    this.manager.updateOverrides({ backgroundUrl: null });
  }

  private async onWallFile(): Promise<void> {
    const file = this.wallFileInput.files?.[0];
    if (!file) return;
    const dataUrl = await this.imageStore.save("wall", file);
    this.manager.updateOverrides({ wallTextureUrl: dataUrl });
    this.wallFileInput.value = "";
  }

  private clearWall(): void {
    this.imageStore.remove("wall").catch(() => {});
    this.manager.updateOverrides({ wallTextureUrl: null });
  }

  private onEdgeColor(): void {
    this.manager.updateOverrides({ wallEdgeColor: inputToHex(this.wallEdgeColorInput.value) });
  }

  private onWallColor(): void {
    this.manager.updateOverrides({ wallColor: inputToHex(this.wallColorInput.value) });
  }
}
