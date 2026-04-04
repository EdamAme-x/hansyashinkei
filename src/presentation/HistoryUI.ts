import type { ScoreHistory } from "@domain/entities/Score";
import type { Replay } from "@domain/entities/Replay";
import type { ManageReplay } from "@application/usecases/ManageReplay";

function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing element #${id}`);
  return e;
}

export class HistoryUI {
  private readonly screen = el("history-screen");
  private readonly list = el("history-list");
  private readonly closeBtn = el("history-close");
  private readonly importBtn = el("history-import");
  private readonly fileInput = el("replay-file-input") as HTMLInputElement;

  private readonly manageReplay: ManageReplay;
  private readonly onWatch: (replay: Replay) => void;
  private readonly onClose: () => void;

  constructor(
    manageReplay: ManageReplay,
    onWatch: (replay: Replay) => void,
    onClose: () => void,
  ) {
    this.manageReplay = manageReplay;
    this.onWatch = onWatch;
    this.onClose = onClose;

    this.closeBtn.addEventListener("click", () => this.hide());
    this.importBtn.addEventListener("click", () => this.fileInput.click());
    this.fileInput.addEventListener("change", () => this.handleImport());
  }

  async show(history: ScoreHistory): Promise<void> {
    while (this.list.firstChild) this.list.removeChild(this.list.firstChild);

    const best = history.bestScore;

    for (const score of history.scores) {
      const li = document.createElement("li");
      li.className = "history-item";

      const scoreEl = document.createElement("span");
      scoreEl.className = "history-score";
      scoreEl.textContent = `${score.value}`;
      if (best && score.id === best.id) {
        scoreEl.className += " history-best";
      }
      li.appendChild(scoreEl);

      const date = new Date(score.timestamp);
      const dateEl = document.createElement("span");
      dateEl.className = "history-date";
      dateEl.textContent = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
      li.appendChild(dateEl);

      const btns = document.createElement("span");
      btns.className = "history-btns";

      const { replayId } = score;
      if (replayId) {
        const watchBtn = document.createElement("button");
        watchBtn.className = "history-btn";
        watchBtn.textContent = "\u25B6";
        watchBtn.title = "Watch replay";
        watchBtn.addEventListener("click", async () => {
          const replay = await this.manageReplay.getById(replayId);
          if (replay) this.onWatch(replay);
        });
        btns.appendChild(watchBtn);

        const dlBtn = document.createElement("button");
        dlBtn.className = "history-btn";
        dlBtn.textContent = "\u2B07";
        dlBtn.title = "Download replay";
        dlBtn.addEventListener("click", async () => {
          const replay = await this.manageReplay.getById(replayId);
          if (replay) this.downloadReplay(replay);
        });
        btns.appendChild(dlBtn);
      }

      li.appendChild(btns);
      this.list.appendChild(li);
    }

    this.screen.classList.remove("hidden");
  }

  hide(): void {
    this.screen.classList.add("hidden");
    this.onClose();
  }

  private downloadReplay(replay: Replay): void {
    const data = this.manageReplay.exportReplay(replay);
    const blob = new Blob([new Uint8Array(data)], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `replay-${replay.finalScore}-${replay.id.slice(0, 8)}.hsr`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private async handleImport(): Promise<void> {
    const file = this.fileInput.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const replay = this.manageReplay.importReplay(new Uint8Array(buffer));

    if (replay) this.onWatch(replay);
    this.fileInput.value = "";
  }
}
