import { App } from "@presentation/App";
import { ManageScore } from "@application/usecases/ManageScore";
import { ManageReplay } from "@application/usecases/ManageReplay";
import { ManageSave } from "@application/usecases/ManageSave";
import { ManageAchievement } from "@application/usecases/ManageAchievement";
import { IndexedDbScoreRepository } from "@infrastructure/storage/IndexedDbScoreRepository";
import { IndexedDbReplayRepository } from "@infrastructure/storage/IndexedDbReplayRepository";
import { IndexedDbBestScoreRepository } from "@infrastructure/storage/IndexedDbBestScoreRepository";
import { IndexedDbAchievementRepository } from "@infrastructure/storage/IndexedDbAchievementRepository";
import { ReplayFileSerializer } from "@infrastructure/storage/ReplayFileSerializer";
import { SaveFileSerializer } from "@infrastructure/storage/SaveFileSerializer";
import { DeviceKeyStore } from "@infrastructure/crypto/DeviceKeyStore";
import { AchievementSigner } from "@infrastructure/crypto/AchievementSigner";
import { ThemeRepository } from "@infrastructure/storage/ThemeRepository";
import { ImageStore } from "@infrastructure/storage/ImageStore";
import { createDefaultConfig } from "@domain/entities/GameConfig";
import { applyDevParams } from "@infrastructure/dev/DevParams";
import { loadInputConfig, saveInputConfig } from "@presentation/InputConfig";
import { ThemeManager } from "@presentation/ThemeManager";
import { LocalStorageModeRepository } from "@infrastructure/storage/LocalStorageModeRepository";
import { EncryptedLocalStorage } from "@infrastructure/crypto/EncryptedLocalStorage";

async function main() {
  const container = document.getElementById("app");
  if (!container) throw new Error("Missing #app container");

  const deviceKey = new DeviceKeyStore();
  await deviceKey.init();

  const achievementSigner = new AchievementSigner();
  await achievementSigner.init();

  const scoreRepo = new IndexedDbScoreRepository(deviceKey);
  const replayRepo = new IndexedDbReplayRepository(deviceKey);
  const bestScoreRepo = new IndexedDbBestScoreRepository(deviceKey);
  const achievementRepo = new IndexedDbAchievementRepository(deviceKey);
  const manageScore = new ManageScore(scoreRepo);
  const replaySerializer = new ReplayFileSerializer();
  const manageReplay = new ManageReplay(replayRepo, replaySerializer, 20);
  const manageAchievement = new ManageAchievement(achievementRepo, achievementSigner, scoreRepo, replayRepo);

  const kv = new EncryptedLocalStorage();

  const themeRepo = new ThemeRepository(kv);
  const imageStore = new ImageStore();
  const themeManager = new ThemeManager(themeRepo, imageStore);
  await themeManager.init();

  const manageSave = new ManageSave(
    {
      scoreRepo,
      replayRepo,
      bestScoreRepo,
      loadThemeOverrides: () => themeRepo.loadOverrides(),
      saveThemeOverrides: (o) => themeRepo.saveOverrides(o),
      loadImages: async () => ({
        bg: await imageStore.load("bg"),
        wall: await imageStore.load("wall"),
      }),
      saveImage: async (key, url) => { await imageStore.save(key, dataUrlToFile(url)); },
      removeImage: (key) => imageStore.remove(key),
      loadKeybinds: () => loadInputConfig(kv).dodge.map((b) => ({ code: b.code, ballIndex: b.ballIndex })),
      saveKeybinds: (binds) => saveInputConfig(kv, { dodge: binds, start: ["Space", "Enter"] }),
      loadAudioEnabled: () => kv.get("hs-audio") !== "0",
      saveAudioEnabled: (v) => kv.set("hs-audio", v ? "1" : "0"),
      loadAchievements: () => manageAchievement.exportRecords(),
      importAndResignAchievements: (records) => manageAchievement.importAndResign(records),
      loadActiveSkinId: () => manageAchievement.getActiveSkinId(),
      saveActiveSkinId: (skinId) => manageAchievement.setActiveSkin(skinId),
      clearAchievements: () => achievementRepo.clear(),
      nukeAllData: async () => {
        // Delete game database (scores, replays, meta, images, achievements)
        await new Promise<void>((resolve) => {
          const req = indexedDB.deleteDatabase("hs");
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
          req.onblocked = () => resolve();
        });
        // Delete crypto keys (AES-GCM + HMAC)
        await deviceKey.deleteKey();
        await achievementSigner.deleteKey();
        // Clear localStorage
        localStorage.clear();
      },
    },
    new SaveFileSerializer(),
  );

  const gameConfig = createDefaultConfig();
  const inputConfig = loadInputConfig(kv);
  applyDevParams(gameConfig, inputConfig);

  const modeRepo = new LocalStorageModeRepository(kv);
  new App(container, manageScore, manageReplay, bestScoreRepo, gameConfig, inputConfig, themeManager, imageStore, manageSave, modeRepo, kv, manageAchievement);
}

function dataUrlToFile(dataUrl: string): File {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) return new File([], "image");
  const header = dataUrl.slice(0, commaIdx);
  const base64 = dataUrl.slice(commaIdx + 1);
  const mime = header.match(/:(.*?);/)?.[1] ?? "application/octet-stream";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], "image", { type: mime });
}

// Version display
const versionEl = document.getElementById("app-version");
if (versionEl) versionEl.textContent = `v${__APP_VERSION__}`;

main().catch((err: unknown) => {
  console.error("Failed to initialise app:", err);
});
