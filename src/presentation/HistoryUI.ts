import type { ScoreHistory } from "@domain/entities/Score";
import type { Replay } from "@domain/entities/Replay";
import type { ManageReplay } from "@application/usecases/ManageReplay";
import { deflate, inflate } from "pako";
import { encode, decode } from "cbor-x";

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

    for (const score of history.scores) {
      const li = document.createElement("li");
      li.className = "history-item";

      const date = new Date(score.timestamp);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;

      const info = document.createElement("span");
      info.className = "history-info";
      info.textContent = `${score.value}  ${dateStr}`;
      li.appendChild(info);

      const { replayId } = score;
      if (replayId) {
        const watchBtn = document.createElement("button");
        watchBtn.className = "history-btn";
        watchBtn.textContent = "WATCH";
        watchBtn.addEventListener("click", async () => {
          const replay = await this.manageReplay.getById(replayId);
          if (replay) this.onWatch(replay);
        });
        li.appendChild(watchBtn);

        const dlBtn = document.createElement("button");
        dlBtn.className = "history-btn";
        dlBtn.textContent = "DL";
        dlBtn.addEventListener("click", async () => {
          const replay = await this.manageReplay.getById(replayId);
          if (replay) this.downloadReplay(replay);
        });
        li.appendChild(dlBtn);
      }

      this.list.appendChild(li);
    }

    this.screen.classList.remove("hidden");
  }

  hide(): void {
    this.screen.classList.add("hidden");
    this.onClose();
  }

  private downloadReplay(replay: Replay): void {
    const cbor = encode(replay);
    const compressed = deflate(
      new Uint8Array(cbor.buffer, cbor.byteOffset, cbor.byteLength),
    );
    const blob = new Blob([compressed], { type: "application/octet-stream" });
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
    const decompressed = inflate(new Uint8Array(buffer));
    const replay = decode(decompressed) as Replay;

    if (!replay.version || !replay.seed || !replay.dts) return;

    this.onWatch(replay);
    this.fileInput.value = "";
  }
}
