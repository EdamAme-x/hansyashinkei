import type { ManageAchievement } from "@application/usecases/ManageAchievement";
import type { AchievementRecord } from "@domain/entities/Achievement";
import { ACHIEVEMENT_DEFS } from "@domain/entities/AchievementDefs";
import { getSkinDef, DEFAULT_SKIN_ID } from "@domain/entities/SkinDefs";

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${h}:${min}`;
}

export class AchievementUI {
  private readonly screen: HTMLElement;
  private readonly listEl: HTMLElement;

  onSkinChanged: ((skinId: string) => void) | null = null;

  constructor(private readonly manage: ManageAchievement) {
    this.screen = document.getElementById("achievement-screen") as HTMLElement;
    this.listEl = document.getElementById("achievement-list") as HTMLElement;
    document.getElementById("achievement-close")?.addEventListener("click", () => this.hide());
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
    const records = await this.manage.getAllRecords();
    const recordMap = new Map<string, AchievementRecord>();
    for (const r of records) {
      if (r.verified) recordMap.set(r.id, r);
    }
    const activeSkinId = await this.manage.getActiveSkinId();

    this.listEl.textContent = "";

    // Default skin equip button at the top
    const defaultCard = this.buildDefaultSkinCard(activeSkinId);
    this.listEl.appendChild(defaultCard);

    for (const def of ACHIEVEMENT_DEFS) {
      const record = recordMap.get(def.id);
      const unlocked = !!record;
      const skin = getSkinDef(def.rewardSkinId);
      const isActive = activeSkinId === def.rewardSkinId;

      const card = document.createElement("div");
      card.className = `ach-card ${unlocked ? "unlocked" : "locked"}`;

      // Left: skin preview circle
      const showSkin = unlocked || !def.hidden;
      const preview = document.createElement("button");
      preview.className = `ach-preview ${unlocked ? "" : "locked"} ${isActive ? "equipped" : ""}`;
      preview.style.backgroundColor = showSkin ? hex(skin.color) : "#111";
      if (unlocked && skin.emissiveIntensity > 0) {
        preview.style.boxShadow = `0 0 10px ${hex(skin.glowColor)}`;
      }
      if (!showSkin) {
        preview.textContent = "?";
        preview.style.color = "rgba(255,255,255,0.15)";
        preview.style.fontSize = "1rem";
        preview.style.fontWeight = "900";
        preview.style.lineHeight = "2.4rem";
        preview.style.textAlign = "center";
      }
      if (unlocked && isActive) {
        preview.style.outline = `2px solid #ffd700`;
        preview.style.outlineOffset = "2px";
      }

      if (unlocked) {
        preview.addEventListener("click", async () => {
          await this.manage.setActiveSkin(def.rewardSkinId);
          await this.render();
          this.onSkinChanged?.(def.rewardSkinId);
        });
      }

      // Right: info
      const info = document.createElement("div");
      info.className = "ach-info";

      const label = document.createElement("div");
      label.className = "ach-label";
      label.textContent = unlocked || !def.hidden ? def.label : "???";

      const desc = document.createElement("div");
      desc.className = "ach-desc";
      desc.textContent = unlocked || !def.hidden ? def.description : "隠し実績";

      const meta = document.createElement("div");
      meta.className = "ach-meta";

      if (unlocked) {
        const skinName = document.createElement("span");
        skinName.className = "ach-skin-name";
        skinName.textContent = skin.label;

        const date = document.createElement("span");
        date.className = "ach-date";
        date.textContent = formatDate(record.proof.unlockedAt);

        if (isActive) {
          const badge = document.createElement("span");
          badge.className = "ach-equipped-badge";
          badge.textContent = "EQUIPPED";
          meta.appendChild(badge);
        }

        meta.appendChild(skinName);
        meta.appendChild(date);
      } else {
        const lockLabel = document.createElement("span");
        lockLabel.className = "ach-skin-name";
        lockLabel.textContent = def.hidden ? "???" : "LOCKED";
        meta.appendChild(lockLabel);
      }

      info.appendChild(label);
      info.appendChild(desc);
      info.appendChild(meta);

      card.appendChild(preview);
      card.appendChild(info);
      this.listEl.appendChild(card);
    }
  }

  private buildDefaultSkinCard(activeSkinId: string): HTMLElement {
    const skin = getSkinDef(DEFAULT_SKIN_ID);
    const isActive = activeSkinId === DEFAULT_SKIN_ID;

    const card = document.createElement("div");
    card.className = "ach-card unlocked";

    const preview = document.createElement("button");
    preview.className = `ach-preview ${isActive ? "equipped" : ""}`;
    preview.style.backgroundColor = hex(skin.color);
    if (isActive) {
      preview.style.outline = "2px solid #ffd700";
      preview.style.outlineOffset = "2px";
    }
    preview.addEventListener("click", async () => {
      await this.manage.setActiveSkin(DEFAULT_SKIN_ID);
      await this.render();
      this.onSkinChanged?.(DEFAULT_SKIN_ID);
    });

    const info = document.createElement("div");
    info.className = "ach-info";

    const label = document.createElement("div");
    label.className = "ach-label";
    label.textContent = "DEFAULT";

    const desc = document.createElement("div");
    desc.className = "ach-desc";
    desc.textContent = "標準ボール";

    const meta = document.createElement("div");
    meta.className = "ach-meta";

    if (isActive) {
      const badge = document.createElement("span");
      badge.className = "ach-equipped-badge";
      badge.textContent = "EQUIPPED";
      meta.appendChild(badge);
    }

    const skinName = document.createElement("span");
    skinName.className = "ach-skin-name";
    skinName.textContent = skin.label;
    meta.appendChild(skinName);

    info.appendChild(label);
    info.appendChild(desc);
    info.appendChild(meta);

    card.appendChild(preview);
    card.appendChild(info);
    return card;
  }
}
