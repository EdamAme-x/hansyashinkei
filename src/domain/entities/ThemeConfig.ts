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

function createNeonTheme(): ThemeConfig {
  return {
    id: "neon",
    label: "NEON",
    scene: {
      background: { type: "color", hex: 0x050510 },
      fogColor: 0x050510,
      fogNear: 20,
      fogFar: 110,
      groundColor: 0x08081a,
      groundMetalness: 0.8,
      groundRoughness: 0.4,
      laneStripColor: 0x0a0a22,
      laneDividerColor: 0x00ccff,
      laneDividerEmissive: 0x00ccff,
      laneDividerEmissiveIntensity: 0.8,
      hitZoneColor: 0x00ffcc,
      wallColor: 0x1a0030,
      wallMetalness: 0.7,
      wallRoughness: 0.3,
      wallEdgeColor: 0xff00ff,
      shardColor: 0x00ffff,
      ballSkins: [
        {
          id: "neon-cyan",
          label: "CYAN",
          color: 0x00ccff,
          metalness: 0.3,
          roughness: 0.2,
          glowColor: 0x00ccff,
          glowIntensity: 1.5,
        },
      ],
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

function createSunsetTheme(): ThemeConfig {
  return {
    id: "sunset",
    label: "SUNSET",
    scene: {
      background: { type: "color", hex: 0x1a0a0a },
      fogColor: 0x1a0a0a,
      fogNear: 20,
      fogFar: 110,
      groundColor: 0x1a0e0e,
      groundMetalness: 0.6,
      groundRoughness: 0.5,
      laneStripColor: 0x221414,
      laneDividerColor: 0xff6633,
      laneDividerEmissive: 0xff4400,
      laneDividerEmissiveIntensity: 0.5,
      hitZoneColor: 0xffaa44,
      wallColor: 0x220808,
      wallMetalness: 0.8,
      wallRoughness: 0.3,
      wallEdgeColor: 0xff6633,
      shardColor: 0xff8844,
      ballSkins: [
        {
          id: "sunset-gold",
          label: "GOLD",
          color: 0xffcc66,
          metalness: 0.5,
          roughness: 0.2,
          glowColor: 0xff8833,
          glowIntensity: 1.2,
        },
      ],
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
  return [createDefaultTheme(), createNeonTheme(), createSunsetTheme()];
}
