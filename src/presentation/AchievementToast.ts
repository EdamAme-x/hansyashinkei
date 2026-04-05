import type { UnlockEvent } from "@application/usecases/ManageAchievement";

export class AchievementToast {
  private readonly container: HTMLElement;
  private queue: UnlockEvent[] = [];
  private timer = 0;

  constructor() {
    this.container = document.getElementById("achievement-toast") as HTMLElement;
  }

  show(events: UnlockEvent[]): void {
    this.queue.push(...events);
    if (this.timer === 0) this.next();
  }

  private next(): void {
    const event = this.queue.shift();
    if (!event) { this.timer = 0; return; }

    const toast = document.createElement("div");
    toast.className = "achievement-toast-item";

    const title = document.createElement("div");
    title.className = "achievement-toast-title";
    title.textContent = "ACHIEVEMENT UNLOCKED";

    const label = document.createElement("div");
    label.className = "achievement-toast-label";
    label.textContent = event.label;

    const skin = document.createElement("div");
    skin.className = "achievement-toast-skin";
    skin.textContent = "+ SKIN 解除";

    toast.appendChild(title);
    toast.appendChild(label);
    toast.appendChild(skin);
    this.container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add("visible"));

    this.timer = window.setTimeout(() => {
      toast.classList.remove("visible");
      window.setTimeout(() => {
        toast.remove();
        this.timer = 0;
        this.next();
      }, 500);
    }, 2800);
  }
}
