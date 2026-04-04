import { App } from "@presentation/App";
import { ManageScore } from "@application/usecases/ManageScore";
import { IndexedDbScoreRepository } from "@infrastructure/storage/IndexedDbScoreRepository";
import { DeviceKeyStore } from "@infrastructure/crypto/DeviceKeyStore";
import { createDefaultConfig } from "@domain/entities/GameConfig";
import { createDefaultInputConfig } from "@presentation/InputConfig";

async function main() {
  const container = document.getElementById("app");
  if (!container) throw new Error("Missing #app container");

  const deviceKey = new DeviceKeyStore();
  await deviceKey.init();

  const scoreRepo = new IndexedDbScoreRepository(deviceKey);
  const manageScore = new ManageScore(scoreRepo);

  const gameConfig = createDefaultConfig();
  const inputConfig = createDefaultInputConfig();

  new App(container, manageScore, gameConfig, inputConfig);
}

main();
