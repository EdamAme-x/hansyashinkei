import { App } from "@presentation/App";
import { ManageScore } from "@application/usecases/ManageScore";
import { ManageReplay } from "@application/usecases/ManageReplay";
import { IndexedDbScoreRepository } from "@infrastructure/storage/IndexedDbScoreRepository";
import { IndexedDbReplayRepository } from "@infrastructure/storage/IndexedDbReplayRepository";
import { IndexedDbBestScoreRepository } from "@infrastructure/storage/IndexedDbBestScoreRepository";
import { ReplayFileSerializer } from "@infrastructure/storage/ReplayFileSerializer";
import { DeviceKeyStore } from "@infrastructure/crypto/DeviceKeyStore";
import { ThemeRepository } from "@infrastructure/storage/ThemeRepository";
import { createDefaultConfig } from "@domain/entities/GameConfig";
import { applyDevParams } from "@infrastructure/dev/DevParams";
import { loadInputConfig } from "@presentation/InputConfig";
import { ThemeManager } from "@presentation/ThemeManager";

async function main() {
  const container = document.getElementById("app");
  if (!container) throw new Error("Missing #app container");

  const deviceKey = new DeviceKeyStore();
  await deviceKey.init();

  const scoreRepo = new IndexedDbScoreRepository(deviceKey);
  const replayRepo = new IndexedDbReplayRepository(deviceKey);
  const bestScoreRepo = new IndexedDbBestScoreRepository(deviceKey);
  const manageScore = new ManageScore(scoreRepo);
  const replaySerializer = new ReplayFileSerializer();
  const manageReplay = new ManageReplay(replayRepo, replaySerializer, 20);

  const themeRepo = new ThemeRepository();
  const themeManager = new ThemeManager(themeRepo);

  const gameConfig = createDefaultConfig();
  const inputConfig = loadInputConfig();
  applyDevParams(gameConfig, inputConfig);

  new App(container, manageScore, manageReplay, bestScoreRepo, gameConfig, inputConfig, themeManager);
}

// Version display — runs immediately, independent of async init
const versionEl = document.getElementById("app-version");
if (versionEl) versionEl.textContent = `v${__APP_VERSION__}`;

main();
