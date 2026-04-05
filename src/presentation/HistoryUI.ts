import type { ScoreHistory } from "@domain/entities/Score";
import type { GameMode } from "@domain/entities/GameMode";
import type { Replay } from "@domain/entities/Replay";
import type { ManageReplay } from "@application/usecases/ManageReplay";
import type { ManageScore } from "@application/usecases/ManageScore";
import { el, downloadBlob } from "./dom";

type HistoryTab = GameMode | "all";

export class HistoryUI {
  private readonly screen = el("history-screen");
  private readonly list = el("history-list");
  private readonly closeBtn = el("history-close");
  private readonly importBtn = el("history-import");
  private readonly fileInput = el("replay-file-input") as HTMLInputElement;

  private readonly manageReplay: ManageReplay;
  private readonly onWatch: (replay: Replay) => void;
  private readonly onClose: () => void;

  private manageScore: ManageScore | null = null;
  private currentTab: HistoryTab = "classic";

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

  async show(_history: ScoreHistory, manageScore?: ManageScore): Promise<void> {
    if (manageScore) this.manageScore = manageScore;

    // Inject tabs + stats container above history-list if not yet present
    this.ensureTabsAndStats();

    await this.renderTab(this.currentTab);

    this.screen.classList.remove("hidden");
  }

  private ensureTabsAndStats(): void {
    if (document.getElementById("history-tabs")) return;

    const tabsEl = document.createElement("div");
    tabsEl.id = "history-tabs";
    tabsEl.className = "history-tabs";

    const tabs: { id: HistoryTab; label: string }[] = [
      { id: "classic", label: "2 BALLS" },
      { id: "triple", label: "3 BALLS" },
      { id: "all", label: "ALL" },
    ];

    for (const tab of tabs) {
      const btn = document.createElement("button");
      btn.className = "history-tab-btn" + (tab.id === this.currentTab ? " active" : "");
      btn.textContent = tab.label;
      btn.dataset["tab"] = tab.id;
      btn.addEventListener("click", () => {
        this.currentTab = tab.id;
        document.querySelectorAll(".history-tab-btn").forEach((b) => {
          (b as HTMLElement).classList.toggle("active", (b as HTMLElement).dataset["tab"] === tab.id);
        });
        this.renderTab(tab.id).catch(() => {});
      });
      tabsEl.appendChild(btn);
    }

    const statsEl = document.createElement("div");
    statsEl.id = "history-stats";
    statsEl.className = "history-stats";

    this.list.insertAdjacentElement("beforebegin", tabsEl);
    tabsEl.insertAdjacentElement("afterend", statsEl);
  }

  private async renderTab(tab: HistoryTab): Promise<void> {
    const mode: GameMode | undefined = tab === "all" ? undefined : tab;

    // Render stats
    const statsEl = document.getElementById("history-stats");
    if (statsEl && this.manageScore) {
      const stats = await this.manageScore.getStats(mode);
      statsEl.innerHTML = "";

      const items = [
        { label: "PLAYS", value: `${stats.totalPlays}` },
        { label: "BEST", value: `${stats.bestScore}` },
        { label: "AVG", value: `${stats.avgScore}` },
        { label: "TOTAL", value: `${stats.totalScore}` },
      ];

      for (const item of items) {
        const stat = document.createElement("div");
        stat.className = "history-stat-item";
        stat.innerHTML = `<span class="history-stat-label">${item.label}</span><span class="history-stat-value">${item.value}</span>`;
        statsEl.appendChild(stat);
      }
    }

    // Render list
    const history = this.manageScore
      ? await this.manageScore.getHistory(mode)
      : { scores: [], bestScore: null };

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

      // Mode badge in "all" tab
      if (tab === "all" && score.mode) {
        const modeEl = document.createElement("span");
        modeEl.className = "history-mode-badge";
        modeEl.textContent = score.mode === "triple" ? "3B" : "2B";
        li.appendChild(modeEl);
      }

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
  }

  isOpen(): boolean {
    return !this.screen.classList.contains("hidden");
  }

  hide(): void {
    this.screen.classList.add("hidden");
    this.onClose();
  }

  private downloadReplay(replay: Replay): void {
    const data = this.manageReplay.exportReplay(replay);
    downloadBlob(new Uint8Array(data), `replay-${replay.finalScore}-${replay.id.slice(0, 8)}.hsr`);
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
