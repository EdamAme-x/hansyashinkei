import type { ThemeManager } from "./ThemeManager";
import type { IImageStore } from "@domain/repositories/ImageStore";
import { el } from "./dom";

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

  isOpen(): boolean {
    return !this.screen.classList.contains("hidden");
  }

  hide(): void {
    this.screen.classList.add("hidden");
  }

  private updatePreviews(): void {
    const overrides = this.manager.getOverrides();

    if (overrides.backgroundUrl) {
      this.bgPreview.style.backgroundImage = `url(${overrides.backgroundUrl})`;
      this.bgPreview.classList.remove("empty");
    } else {
      this.bgPreview.style.backgroundImage = "";
      this.bgPreview.classList.add("empty");
    }

    if (overrides.wallTextureUrl) {
      this.wallPreview.style.backgroundImage = `url(${overrides.wallTextureUrl})`;
      this.wallPreview.classList.remove("empty");
    } else {
      this.wallPreview.style.backgroundImage = "";
      this.wallPreview.classList.add("empty");
    }

    this.bgmStatus.textContent = overrides.hasBgm ? "CUSTOM" : "DEFAULT";
  }

  private async onBgFile(): Promise<void> {
    const file = this.bgFileInput.files?.[0];
    if (!file) return;
    const dataUrl = await this.imageStore.save("bg", file);
    this.manager.updateOverrides({ hasBackground: true, backgroundUrl: dataUrl });
    this.bgFileInput.value = "";
    this.updatePreviews();
  }

  private clearBg(): void {
    this.imageStore.remove("bg").catch(() => {});
    this.manager.updateOverrides({ hasBackground: false, backgroundUrl: null });
    this.updatePreviews();
  }

  private async onWallFile(): Promise<void> {
    const file = this.wallFileInput.files?.[0];
    if (!file) return;
    const dataUrl = await this.imageStore.save("wall", file);
    this.manager.updateOverrides({ hasWallTexture: true, wallTextureUrl: dataUrl });
    this.wallFileInput.value = "";
    this.updatePreviews();
  }

  private clearWall(): void {
    this.imageStore.remove("wall").catch(() => {});
    this.manager.updateOverrides({ hasWallTexture: false, wallTextureUrl: null });
    this.updatePreviews();
  }

  private async onBgmFile(): Promise<void> {
    const file = this.bgmFileInput.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    await this.imageStore.save("bgm", this.dataUrlToFile(dataUrl));
    this.manager.updateOverrides({ hasBgm: true, bgmUrl: dataUrl });
    this.bgmFileInput.value = "";
    this.updatePreviews();
  }

  private clearBgm(): void {
    this.imageStore.remove("bgm").catch(() => {});
    this.manager.updateOverrides({ hasBgm: false, bgmUrl: null });
    this.updatePreviews();
  }

  private dataUrlToFile(dataUrl: string): File {
    const commaIdx = dataUrl.indexOf(",");
    if (commaIdx === -1) return new File([], "audio");
    const header = dataUrl.slice(0, commaIdx);
    const base64 = dataUrl.slice(commaIdx + 1);
    const mime = header.match(/:(.*?);/)?.[1] ?? "application/octet-stream";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], "audio", { type: mime });
  }
}
