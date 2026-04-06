import { App } from "@presentation/App";
import { VsApp } from "@presentation/VsApp";
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
import { AchievementSignerImpl } from "@infrastructure/crypto/AchievementSigner";
import { ThemeRepository } from "@infrastructure/storage/ThemeRepository";
import { ImageStore } from "@infrastructure/storage/ImageStore";
import { createDefaultConfig, createTripleConfig } from "@domain/entities/GameConfig";
import { applyDevParams } from "@infrastructure/dev/DevParams";
import { loadInputConfig, saveInputConfig } from "@presentation/InputConfig";
import { ThemeManager } from "@presentation/ThemeManager";
import { LocalStorageModeRepository } from "@infrastructure/storage/LocalStorageModeRepository";
import { EncryptedLocalStorage } from "@infrastructure/crypto/EncryptedLocalStorage";
import { AudioManager } from "@presentation/AudioManager";
import { loadUsername, saveUsername } from "@infrastructure/storage/UsernameStore";
import { VsMatchService } from "@application/usecases/VsMatchService";
import { setupCustomCursor } from "@presentation/CustomCursor";

async function main() {
  const container = document.getElementById("app");
  if (!container) throw new Error("Missing #app container");

  const deviceKey = new DeviceKeyStore();
  await deviceKey.init();

  const achievementSigner = new AchievementSignerImpl();
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

  const inputConfig = loadInputConfig(kv);

  // ── VS mode routing ──
  const url = new URL(location.href);
  const vsParam = url.searchParams.get("vs");

  if (vsParam !== null) {
    // VS mode — hide solo UI and setup cursor early
    for (const id of ["title-screen", "gameover-screen", "score-display", "speedup-display",
      "replay-bar", "replay-indicator", "history-screen", "settings-screen",
      "keybind-screen", "theme-screen", "achievement-screen"]) {
      document.getElementById(id)?.classList.add("hidden");
    }
    setupCustomCursor();

    // Need username
    let username = loadUsername(kv);
    if (!username) {
      username = await promptUsername();
      if (!username) {
        location.href = "/";
        return;
      }
      saveUsername(kv, username);
    }

    const theme = themeManager.current;
    const audio = new AudioManager(theme.audio, kv);
    const vsMatchService = new VsMatchService();
    const vsApp = new VsApp(container, theme, inputConfig, audio, manageAchievement, manageScore, manageReplay, vsMatchService, username);

    if (vsParam === "") {
      // Create new room: hs.evex.land?vs
      const modeRepo = new LocalStorageModeRepository(kv);
      const mode = modeRepo.load();
      await vsApp.createAndJoin(mode);
    } else {
      // Join room: hs.evex.land?vs=XXXXX
      await vsApp.join(vsParam.toUpperCase());
    }
    return;
  }

  // ── Normal solo mode ──
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
      saveImage: async (key, dataUrl) => { await imageStore.save(key, dataUrlToFile(dataUrl)); },
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
        await new Promise<void>((resolve) => {
          const req = indexedDB.deleteDatabase("hs");
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
          req.onblocked = () => resolve();
        });
        await deviceKey.deleteKey();
        await achievementSigner.deleteKey();
        localStorage.clear();
      },
    },
    new SaveFileSerializer(),
  );

  const gameConfig = createDefaultConfig();
  const tripleConfig = createTripleConfig();
  applyDevParams(gameConfig, inputConfig);
  applyDevParams(tripleConfig, inputConfig);

  const modeRepo = new LocalStorageModeRepository(kv);
  new App(container, manageScore, manageReplay, bestScoreRepo, gameConfig, tripleConfig, inputConfig, themeManager, imageStore, manageSave, modeRepo, kv, manageAchievement);
}

function promptUsername(): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.getElementById("username-modal");
    const input = document.getElementById("username-input") as HTMLInputElement | null;
    const okBtn = document.getElementById("username-ok");

    if (!overlay || !input || !okBtn) {
      const name = window.prompt("ユーザー名を入力 (1-10文字)");
      resolve(name?.trim() || null);
      return;
    }

    overlay.classList.remove("hidden");
    input.value = "";
    input.focus();

    // Prevent global key handlers from intercepting input
    input.addEventListener("keydown", (e) => e.stopPropagation());

    const done = () => {
      const val = input.value.trim();
      if (val.length < 1 || val.length > 10) return;
      overlay.classList.add("hidden");
      okBtn.removeEventListener("click", done);
      resolve(val);
    };

    okBtn.addEventListener("click", done);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") done();
    });
  });
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
