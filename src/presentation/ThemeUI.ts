import type { ThemeManager } from "./ThemeManager";
import type { IImageStore } from "@domain/repositories/ImageStore";

function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing element #${id}`);
  return e;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

export class ThemeUI {
  private readonly screen = el("theme-screen");
  private readonly closeBtn = el("theme-close");
  private readonly bgFileInput = el("theme-bg-file") as HTMLInputElement;
  private readonly bgClearBtn = el("theme-bg-clear");
  private readonly bgPreview = el("theme-bg-preview");
  private readonly wallFileInput = el("theme-wall-file") as HTMLInputElement;
  private readonly wallClearBtn = el("theme-wall-clear");
  private readonly wallPreview = el("theme-wall-preview");
  private readonly bgmFileInput = el("theme-bgm-file") as HTMLInputElement;
  private readonly bgmClearBtn = el("theme-bgm-clear");
  private readonly bgmStatus = el("theme-bgm-status");
  private readonly manager: ThemeManager;
  private readonly imageStore: IImageStore;

  constructor(manager: ThemeManager, imageStore: IImageStore) {
    this.manager = manager;
    this.imageStore = imageStore;

    this.closeBtn.addEventListener("click", () => this.hide());
    this.bgFileInput.addEventListener("change", () => this.onBgFile());
    this.bgClearBtn.addEventListener("click", () => this.clearBg());
    this.wallFileInput.addEventListener("change", () => this.onWallFile());
    this.wallClearBtn.addEventListener("click", () => this.clearWall());
    this.bgmFileInput.addEventListener("change", () => this.onBgmFile());
    this.bgmClearBtn.addEventListener("click", () => this.clearBgm());
  }

  show(): void {
    this.updatePreviews();
    this.screen.classList.remove("hidden");
  }

  hide(): void {
    this.screen.classList.add("hidden");
  }

  private updatePreviews(): void {
    const overrides = this.manager.getOverrides();
    const theme = this.manager.current;

    // Background preview
    const bgUrl = theme.scene.background.type === "texture" ? theme.scene.background.url : null;
    if (bgUrl) {
      this.bgPreview.style.backgroundImage = `url(${bgUrl})`;
      this.bgPreview.classList.remove("empty");
    } else {
      this.bgPreview.style.backgroundImage = "";
      this.bgPreview.classList.add("empty");
    }

    // Wall preview
    const wallUrl = theme.scene.wallTextureUrl;
    if (wallUrl) {
      this.wallPreview.style.backgroundImage = `url(${wallUrl})`;
      this.wallPreview.classList.remove("empty");
    } else {
      this.wallPreview.style.backgroundImage = "";
      this.wallPreview.classList.add("empty");
    }

    // BGM status
    this.bgmStatus.textContent = overrides.bgmUrl ? "CUSTOM" : "DEFAULT";
  }

  private async onBgFile(): Promise<void> {
    const file = this.bgFileInput.files?.[0];
    if (!file) return;
    const dataUrl = await this.imageStore.save("bg", file);
    this.manager.updateOverrides({ backgroundUrl: dataUrl });
    this.bgFileInput.value = "";
    this.updatePreviews();
  }

  private clearBg(): void {
    this.imageStore.remove("bg").catch(() => {});
    this.manager.updateOverrides({ backgroundUrl: null });
    this.updatePreviews();
  }

  private async onWallFile(): Promise<void> {
    const file = this.wallFileInput.files?.[0];
    if (!file) return;
    const dataUrl = await this.imageStore.save("wall", file);
    this.manager.updateOverrides({ wallTextureUrl: dataUrl });
    this.wallFileInput.value = "";
    this.updatePreviews();
  }

  private clearWall(): void {
    this.imageStore.remove("wall").catch(() => {});
    this.manager.updateOverrides({ wallTextureUrl: null });
    this.updatePreviews();
  }

  private async onBgmFile(): Promise<void> {
    const file = this.bgmFileInput.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    this.manager.updateOverrides({ bgmUrl: dataUrl });
    this.bgmFileInput.value = "";
    this.updatePreviews();
  }

  private clearBgm(): void {
    this.manager.updateOverrides({ bgmUrl: null });
    this.updatePreviews();
  }
}
