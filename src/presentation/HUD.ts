import type { GameState } from "@domain/entities/StateMachine";
import { GameState as GS } from "@domain/entities/StateMachine";

function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing element #${id}`);
  return e;
}

export class HUD {
  private readonly titleScreen = el("title-screen");
  private readonly gameOverScreen = el("gameover-screen");
  private readonly scoreDisplay = el("score-display");
  private readonly finalScore = el("final-score");
  private readonly bestScore = el("best-score");

  show(state: GameState): void {
    this.titleScreen.classList.toggle("hidden", state !== GS.Title);
    this.gameOverScreen.classList.toggle("hidden", state !== GS.GameOver);
    this.scoreDisplay.classList.toggle("hidden", state !== GS.Playing);
  }

  updateScore(score: number): void {
    this.scoreDisplay.textContent = `${score}`;
  }

  showGameOver(score: number, best: number): void {
    this.finalScore.textContent = `Score: ${score}`;
    this.bestScore.textContent = `Best: ${best}`;
  }
}
