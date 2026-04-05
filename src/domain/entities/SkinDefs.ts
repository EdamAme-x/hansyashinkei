import type { AchievementSkin } from "./Achievement";

export const DEFAULT_SKIN_ID = "skin_default";

const S = (s: AchievementSkin) => s;

export const SKIN_DEFS: readonly AchievementSkin[] = [
  S({
    id: "skin_default",
    label: "DEFAULT",
    description: "標準ボール",
    shape: "sphere",
    color: 0xe0e0e0, metalness: 0.35, roughness: 0.18,
    emissiveColor: 0x000000, emissiveIntensity: 0,
    glowColor: 0xffffff, glowIntensity: 1.0,
    pulseSpeed: 0,
  }),

  // Classic score rewards
  S({
    id: "skin_crimson",
    label: "CRIMSON",
    description: "深紅の球体",
    shape: "sphere",
    color: 0xa01020, metalness: 0.7, roughness: 0.08,
    emissiveColor: 0x200008, emissiveIntensity: 0.15,
    glowColor: 0xff2040, glowIntensity: 1.3,
    pulseSpeed: 0,
  }),
  S({
    id: "skin_gold",
    label: "GOLD",
    description: "輝く黄金",
    shape: "sphere",
    color: 0xd4a520, metalness: 0.95, roughness: 0.03,
    emissiveColor: 0x1a1000, emissiveIntensity: 0.1,
    glowColor: 0xffe066, glowIntensity: 1.4,
    pulseSpeed: 0,
  }),
  S({
    id: "skin_plasma",
    label: "PLASMA",
    description: "脈動するプラズマエネルギー",
    shape: "sphere",
    color: 0x6a1b9a, metalness: 0.6, roughness: 0.12,
    emissiveColor: 0x2a0050, emissiveIntensity: 0.6,
    glowColor: 0xb040ff, glowIntensity: 2.0,
    pulseSpeed: 2.0,
  }),
  S({
    id: "skin_obsidian",
    label: "OBSIDIAN",
    description: "伝説の証",
    shape: "spiky",
    color: 0x08080e, metalness: 0.98, roughness: 0.01,
    emissiveColor: 0x0c0018, emissiveIntensity: 0.5,
    glowColor: 0x7030a0, glowIntensity: 1.8,
    pulseSpeed: 0.8,
  }),

  // Triple score rewards
  S({
    id: "skin_cobalt",
    label: "COBALT",
    description: "コバルトブルー",
    shape: "sphere",
    color: 0x1040a0, metalness: 0.75, roughness: 0.06,
    emissiveColor: 0x000820, emissiveIntensity: 0.12,
    glowColor: 0x4488ff, glowIntensity: 1.3,
    pulseSpeed: 0,
  }),
  S({
    id: "skin_aurora",
    label: "AURORA",
    description: "オーロラの輝き",
    shape: "sphere",
    color: 0x10c8a0, metalness: 0.65, roughness: 0.1,
    emissiveColor: 0x002818, emissiveIntensity: 0.3,
    glowColor: 0x40ffc8, glowIntensity: 1.6,
    pulseSpeed: 1.2,
  }),

  // Any mode
  S({
    id: "skin_neon",
    label: "NEON",
    description: "暗闇で光るネオン",
    shape: "sphere",
    color: 0x080808, metalness: 0.1, roughness: 0.8,
    emissiveColor: 0x00e050, emissiveIntensity: 1.2,
    glowColor: 0x00ff70, glowIntensity: 3.0,
    pulseSpeed: 3.5,
  }),

  // Play count rewards
  S({
    id: "skin_jade",
    label: "JADE",
    description: "翡翠の原石",
    shape: "sphere",
    color: 0x1a8050, metalness: 0.55, roughness: 0.15,
    emissiveColor: 0x001808, emissiveIntensity: 0.1,
    glowColor: 0x30d080, glowIntensity: 1.0,
    pulseSpeed: 0,
  }),
  S({
    id: "skin_chrome",
    label: "CHROME",
    description: "鏡面クローム",
    shape: "sphere",
    color: 0xd8d8d8, metalness: 1.0, roughness: 0.0,
    emissiveColor: 0x000000, emissiveIntensity: 0,
    glowColor: 0xffffff, glowIntensity: 0.7,
    pulseSpeed: 0,
  }),

  // Streak reward
  S({
    id: "skin_fire",
    label: "FIRE",
    description: "燃え盛る炎球",
    shape: "sphere",
    color: 0xc83000, metalness: 0.4, roughness: 0.2,
    emissiveColor: 0x401000, emissiveIntensity: 0.9,
    glowColor: 0xff6020, glowIntensity: 2.4,
    pulseSpeed: 2.5,
  }),

  // Cumulative reward
  S({
    id: "skin_cube",
    label: "CUBE",
    description: "球ではなく、キューブ",
    shape: "cube",
    color: 0x8090a0, metalness: 0.8, roughness: 0.06,
    emissiveColor: 0x101820, emissiveIntensity: 0.15,
    glowColor: 0xa0b0c0, glowIntensity: 1.1,
    pulseSpeed: 0,
  }),

  // Exact score hidden rewards
  S({
    id: "skin_galaxy",
    label: "GALAXY",
    description: "宇宙の答え",
    shape: "sphere",
    color: 0x180830, metalness: 0.7, roughness: 0.1,
    emissiveColor: 0x1a0040, emissiveIntensity: 0.8,
    glowColor: 0x6030c0, glowIntensity: 2.0,
    pulseSpeed: 1.0,
  }),
  S({
    id: "skin_rose",
    label: "ROSE",
    description: "意味深な薔薇色",
    shape: "sphere",
    color: 0xc03068, metalness: 0.6, roughness: 0.1,
    emissiveColor: 0x200010, emissiveIntensity: 0.2,
    glowColor: 0xff5090, glowIntensity: 1.5,
    pulseSpeed: 0,
  }),
  S({
    id: "skin_pi",
    label: "PI",
    description: "円周率の欠片",
    shape: "sphere",
    color: 0x2050b0, metalness: 0.7, roughness: 0.08,
    emissiveColor: 0x000830, emissiveIntensity: 0.2,
    glowColor: 0x3870e0, glowIntensity: 1.3,
    pulseSpeed: 3.14,
  }),
  S({
    id: "skin_jackpot",
    label: "JACKPOT",
    description: "大当たり",
    shape: "spiky",
    color: 0xc8a000, metalness: 0.9, roughness: 0.02,
    emissiveColor: 0x302000, emissiveIntensity: 0.7,
    glowColor: 0xffe030, glowIntensity: 2.8,
    pulseSpeed: 4.0,
  }),

  // Hidden stub
  S({
    id: "skin_invisible",
    label: "INVISIBLE",
    description: "見えない",
    shape: "sphere",
    color: 0x000000, metalness: 0, roughness: 1,
    emissiveColor: 0x000000, emissiveIntensity: 0,
    glowColor: 0x000000, glowIntensity: 0,
    pulseSpeed: 0,
  }),
];

export function getSkinDef(id: string): AchievementSkin {
  return SKIN_DEFS.find((s) => s.id === id) ?? SKIN_DEFS[0];
}
