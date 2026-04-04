import type { GameState } from "@domain/entities/StateMachine";
import { GameState as GS } from "@domain/entities/StateMachine";

function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing element #${id}`);
  return e;
}

const GAME_URL = "https://hs.evex.land";

export class HUD {
  private readonly titleScreen = el("title-screen");
  private readonly gameOverScreen = el("gameover-screen");
  private readonly scoreDisplay = el("score-display");
  private readonly finalScore = el("final-score");
  private readonly bestScore = el("best-score");
  private readonly newBestLabel = el("new-best");
  private readonly speedUpDisplay = el("speedup-display");
  private readonly titleBest = el("title-best");
  private readonly replayIndicator = el("replay-indicator");
  private readonly shareBtn = el("share-btn");
  private speedUpTimer = 0;
  private lastScore = 0;

  constructor() {
    this.shareBtn.addEventListener("click", () => this.share());
  }

  show(state: GameState): void {
    this.titleScreen.classList.toggle("hidden", state !== GS.Title);
    this.gameOverScreen.classList.toggle("hidden", state !== GS.GameOver);

    const showScore = state === GS.Playing || state === GS.Watching;
    this.scoreDisplay.classList.toggle("hidden", !showScore);
    this.replayIndicator.classList.toggle("hidden", state !== GS.Watching);

    if (state !== GS.Playing && state !== GS.Watching) {
      this.speedUpDisplay.classList.add("hidden");
    }
  }

  updateScore(score: number): void {
    this.scoreDisplay.textContent = `${score}`;
  }

  updateTitleBest(best: number, modeLabel?: string): void {
    if (best > 0) {
      this.titleBest.textContent = modeLabel ? `BEST ${best} (${modeLabel})` : `BEST ${best}`;
    } else {
      this.titleBest.textContent = "";
    }
  }

  showSpeedUp(): void {
    this.speedUpDisplay.classList.remove("hidden");
    this.speedUpDisplay.style.animation = "none";
    void this.speedUpDisplay.offsetWidth;
    this.speedUpDisplay.style.animation = "speedup-fade 1.5s ease-out forwards";
    this.speedUpTimer = window.setTimeout(() => {
      this.speedUpDisplay.classList.add("hidden");
    }, 1500);
  }

  showGameOver(score: number, best: number, isNewBest: boolean): void {
    this.lastScore = score;
    this.finalScore.textContent = `${score}`;
    this.bestScore.textContent = `BEST ${best}`;
    this.newBestLabel.classList.toggle("hidden", !isNewBest);
    clearTimeout(this.speedUpTimer);
    this.speedUpDisplay.classList.add("hidden");
  }

  private share(): void {
    const text = `反射神経 スコア${this.lastScore}!\nここからプレイ\n${GAME_URL}`;
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener");
  }
}
