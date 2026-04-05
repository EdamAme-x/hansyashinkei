import type { ManageAchievement } from "@application/usecases/ManageAchievement";
import { ACHIEVEMENT_DEFS } from "@domain/entities/AchievementDefs";
import { SKIN_DEFS, getSkinDef, DEFAULT_SKIN_ID } from "@domain/entities/SkinDefs";

export class AchievementUI {
  private readonly screen: HTMLElement;
  private readonly galleryEl: HTMLElement;
  private readonly skinsEl: HTMLElement;
  private readonly tabGallery: HTMLElement;
  private readonly tabSkins: HTMLElement;

  onSkinChanged: ((skinId: string) => void) | null = null;

  constructor(private readonly manage: ManageAchievement) {
    this.screen = document.getElementById("achievement-screen") as HTMLElement;
    this.galleryEl = document.getElementById("achievement-gallery") as HTMLElement;
    this.skinsEl = document.getElementById("achievement-skins") as HTMLElement;
    this.tabGallery = document.getElementById("achievement-tab-gallery") as HTMLElement;
    this.tabSkins = document.getElementById("achievement-tab-skins") as HTMLElement;

    document.getElementById("achievement-close")?.addEventListener("click", () => this.hide());

    this.tabGallery.addEventListener("click", () => {
      this.tabGallery.classList.add("active");
      this.tabSkins.classList.remove("active");
      this.galleryEl.classList.remove("hidden");
      this.skinsEl.classList.add("hidden");
    });

    this.tabSkins.addEventListener("click", () => {
      this.tabSkins.classList.add("active");
      this.tabGallery.classList.remove("active");
      this.skinsEl.classList.remove("hidden");
      this.galleryEl.classList.add("hidden");
    });
  }

  async show(): Promise<void> {
    await this.render();
    this.screen.classList.remove("hidden");
  }

  isOpen(): boolean {
    return !this.screen.classList.contains("hidden");
  }

  hide(): void {
    this.screen.classList.add("hidden");
  }

  private async render(): Promise<void> {
    const unlockedIds = await this.manage.getUnlockedIds();
    const activeSkinId = await this.manage.getActiveSkinId();

    this.renderGallery(unlockedIds);
    this.renderSkins(unlockedIds, activeSkinId);
  }

  private renderGallery(unlockedIds: Set<string>): void {
    this.galleryEl.textContent = "";
    for (const def of ACHIEVEMENT_DEFS) {
      const unlocked = unlockedIds.has(def.id);
      const card = document.createElement("div");
      card.className = `achievement-card ${unlocked ? "unlocked" : "locked"}`;

      const label = document.createElement("div");
      label.className = "achievement-card-label";
      label.textContent = unlocked || !def.hidden ? def.label : "???";

      const desc = document.createElement("div");
      desc.className = "achievement-card-desc";
      desc.textContent = unlocked || !def.hidden ? def.description : "Hidden achievement";

      const reward = document.createElement("div");
      reward.className = "achievement-card-reward";
      if (unlocked) {
        const skin = getSkinDef(def.rewardSkinId);
        reward.textContent = `SKIN: ${skin.label}`;
      }

      card.appendChild(label);
      card.appendChild(desc);
      card.appendChild(reward);
      this.galleryEl.appendChild(card);
    }
  }

  private renderSkins(unlockedIds: Set<string>, activeSkinId: string): void {
    this.skinsEl.textContent = "";

    const availableSkinIds = new Set<string>([DEFAULT_SKIN_ID]);
    for (const def of ACHIEVEMENT_DEFS) {
      if (unlockedIds.has(def.id)) availableSkinIds.add(def.rewardSkinId);
    }

    for (const skin of SKIN_DEFS) {
      const available = availableSkinIds.has(skin.id);
      const isActive = skin.id === activeSkinId;

      const btn = document.createElement("button");
      btn.className = `skin-option ${available ? "available" : "locked"} ${isActive ? "active" : ""}`;

      const preview = document.createElement("div");
      preview.className = "skin-preview";
      preview.style.backgroundColor = `#${skin.color.toString(16).padStart(6, "0")}`;
      if (skin.emissiveIntensity > 0) {
        preview.style.boxShadow = `0 0 8px #${skin.glowColor.toString(16).padStart(6, "0")}`;
      }

      const name = document.createElement("div");
      name.className = "skin-option-name";
      name.textContent = available ? skin.label : "LOCKED";

      btn.appendChild(preview);
      btn.appendChild(name);

      if (available) {
        btn.addEventListener("click", async () => {
          await this.manage.setActiveSkin(skin.id);
          await this.render();
          this.onSkinChanged?.(skin.id);
        });
      }

      this.skinsEl.appendChild(btn);
    }
  }
}
