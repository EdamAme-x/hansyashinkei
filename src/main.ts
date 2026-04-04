import { App } from "@presentation/App";
import { ManageScore } from "@application/usecases/ManageScore";
import { ManageReplay } from "@application/usecases/ManageReplay";
import { IndexedDbScoreRepository } from "@infrastructure/storage/IndexedDbScoreRepository";
import { IndexedDbReplayRepository } from "@infrastructure/storage/IndexedDbReplayRepository";
import { DeviceKeyStore } from "@infrastructure/crypto/DeviceKeyStore";
import { createDefaultConfig } from "@domain/entities/GameConfig";
import { createDefaultInputConfig } from "@presentation/InputConfig";

async function main() {
  const container = document.getElementById("app");
  if (!container) throw new Error("Missing #app container");

  const deviceKey = new DeviceKeyStore();
  await deviceKey.init();

  const scoreRepo = new IndexedDbScoreRepository(deviceKey);
  const replayRepo = new IndexedDbReplayRepository(deviceKey);
  const manageScore = new ManageScore(scoreRepo);
  const manageReplay = new ManageReplay(replayRepo, 20);

  const gameConfig = createDefaultConfig();
  const inputConfig = createDefaultInputConfig();

  new App(container, manageScore, manageReplay, gameConfig, inputConfig);
}

main();
