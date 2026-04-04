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
  private readonly wallFileInput = el("theme-wall-file") as HTMLInputElement;
  private readonly wallClearBtn = el("theme-wall-clear");
  private readonly bgmFileInput = el("theme-bgm-file") as HTMLInputElement;
  private readonly bgmClearBtn = el("theme-bgm-clear");
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
    this.screen.classList.remove("hidden");
  }

  hide(): void {
    this.screen.classList.add("hidden");
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

  private async onBgmFile(): Promise<void> {
    const file = this.bgmFileInput.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    this.manager.updateOverrides({ bgmUrl: dataUrl });
    this.bgmFileInput.value = "";
  }

  private clearBgm(): void {
    this.manager.updateOverrides({ bgmUrl: null });
  }
}
