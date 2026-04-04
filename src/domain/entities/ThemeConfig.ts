export type BackgroundMode =
  | { type: "color"; hex: number }
  | { type: "texture"; url: string };

export interface BallSkin {
  readonly id: string;
  readonly label: string;
  readonly color: number;
  readonly metalness: number;
  readonly roughness: number;
  readonly glowColor: number;
  readonly glowIntensity: number;
}

export interface SceneTheme {
  readonly background: BackgroundMode;
  readonly fogColor: number;
  readonly fogNear: number;
  readonly fogFar: number;
  readonly groundColor: number;
  readonly groundMetalness: number;
  readonly groundRoughness: number;
  readonly laneStripColor: number;
  readonly laneDividerColor: number;
  readonly laneDividerEmissive: number;
  readonly laneDividerEmissiveIntensity: number;
  readonly hitZoneColor: number;
  readonly wallColor: number;
  readonly wallMetalness: number;
  readonly wallRoughness: number;
  readonly wallEdgeColor: number;
  readonly wallTextureUrl: string | null;
  readonly shardColor: number;
  readonly ballSkins: readonly BallSkin[];
}

export interface AudioTheme {
  readonly bgmUrl: string;
  readonly bgmVolume: number;
  readonly se: {
    readonly dodge: readonly string[];
    readonly speedUp: string;
    readonly death: string;
    readonly newBest: string;
    readonly start: string;
  };
}

export interface ThemeConfig {
  readonly id: string;
  readonly label: string;
  readonly scene: SceneTheme;
  readonly audio: AudioTheme;
}

/** Serializable user customizations (stored in localStorage). */
export interface CustomThemeOverrides {
  backgroundUrl: string | null;
  wallTextureUrl: string | null;
  bgmUrl: string | null;
}

export function createEmptyOverrides(): CustomThemeOverrides {
  return {
    backgroundUrl: null,
    wallTextureUrl: null,
    bgmUrl: null,
  };
}

export function applyOverrides(theme: ThemeConfig, overrides: CustomThemeOverrides): ThemeConfig {
  const scene = { ...theme.scene };
  const audio = { ...theme.audio };

  if (overrides.backgroundUrl) {
    (scene as { background: BackgroundMode }).background = { type: "texture", url: overrides.backgroundUrl };
  }
  if (overrides.wallTextureUrl !== null) {
    (scene as { wallTextureUrl: string | null }).wallTextureUrl = overrides.wallTextureUrl;
  }
  if (overrides.bgmUrl) {
    (audio as { bgmUrl: string }).bgmUrl = overrides.bgmUrl;
  }

  return { ...theme, scene, audio };
}

const DEFAULT_BALL_SKIN: BallSkin = {
  id: "default",
  label: "DEFAULT",
  color: 0xdddddd,
  metalness: 0.4,
  roughness: 0.15,
  glowColor: 0xffffff,
  glowIntensity: 1.0,
};

export function createDefaultTheme(): ThemeConfig {
  return {
    id: "default",
    label: "MONOCHROME",
    scene: {
      background: { type: "color", hex: 0x000000 },
      fogColor: 0x000000,
      fogNear: 20,
      fogFar: 110,
      groundColor: 0x101018,
      groundMetalness: 0.7,
      groundRoughness: 0.5,
      laneStripColor: 0x1a1a24,
      laneDividerColor: 0x555555,
      laneDividerEmissive: 0x333333,
      laneDividerEmissiveIntensity: 0.6,
      hitZoneColor: 0xffffff,
      wallColor: 0x111111,
      wallMetalness: 0.9,
      wallRoughness: 0.3,
      wallEdgeColor: 0xffffff,
      wallTextureUrl: null,
      shardColor: 0xffffff,
      ballSkins: [DEFAULT_BALL_SKIN],
    },
    audio: {
      bgmUrl: "/audio/bgm.mp3",
      bgmVolume: 0.25,
      se: {
        dodge: ["/audio/dodge1.mp3", "/audio/dodge2.mp3"],
        speedUp: "/audio/bell-accent.mp3",
        death: "/audio/death.mp3",
        newBest: "/audio/new-best.mp3",
        start: "/audio/start.mp3",
      },
    },
  };
}

export function getBuiltinThemes(): readonly ThemeConfig[] {
  return [createDefaultTheme()];
}
