import type { InputConfig } from "./InputConfig";
import { saveInputConfig, codeToLabel, createDefaultInputConfig } from "./InputConfig";

function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing element #${id}`);
  return e;
}

export class KeybindUI {
  private readonly screen = el("keybind-screen");
  private readonly leftKey = el("keybind-left-key");
  private readonly rightKey = el("keybind-right-key");
  private readonly leftBtn = el("keybind-left-btn");
  private readonly rightBtn = el("keybind-right-btn");
  private readonly resetBtn = el("keybind-reset");
  private readonly closeBtn = el("keybind-close");

  private config: InputConfig;
  private readonly onUpdate: (config: InputConfig) => void;
  private readonly onClose: () => void;
  private listening: number | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    config: InputConfig,
    onUpdate: (config: InputConfig) => void,
    onClose: () => void,
  ) {
    this.config = config;
    this.onUpdate = onUpdate;
    this.onClose = onClose;

    this.leftBtn.addEventListener("click", () => this.startListening(0));
    this.rightBtn.addEventListener("click", () => this.startListening(1));
    this.resetBtn.addEventListener("click", () => this.resetToDefault());
    this.closeBtn.addEventListener("click", () => this.hide());

    this.render();
  }

  show(): void {
    this.render();
    this.screen.classList.remove("hidden");
  }

  hide(): void {
    this.stopListening();
    this.screen.classList.add("hidden");
    this.onClose();
  }

  private render(): void {
    const left = this.config.dodge.find((b) => b.ballIndex === 0);
    const right = this.config.dodge.find((b) => b.ballIndex === 1);
    this.leftKey.textContent = left ? codeToLabel(left.code) : "?";
    this.rightKey.textContent = right ? codeToLabel(right.code) : "?";

    this.leftBtn.classList.toggle("listening", this.listening === 0);
    this.rightBtn.classList.toggle("listening", this.listening === 1);
  }

  private startListening(ballIndex: number): void {
    this.stopListening();
    this.listening = ballIndex;
    this.render();

    this.keyHandler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.code === "Escape") {
        this.stopListening();
        return;
      }

      // Don't allow reserved keys
      const reserved = ["Space", "Enter", "Backspace", "Escape", "KeyH", "KeyK"];
      if (reserved.includes(e.code)) return;

      // Don't allow same key for both bindings
      const other = this.config.dodge.find((b) => b.ballIndex !== ballIndex);
      if (other && other.code === e.code) return;

      const binding = this.config.dodge.find((b) => b.ballIndex === ballIndex);
      if (binding) {
        binding.code = e.code;
      }

      saveInputConfig(this.config);
      this.onUpdate(this.config);
      this.stopListening();
    };

    window.addEventListener("keydown", this.keyHandler, { capture: true });
  }

  private stopListening(): void {
    if (this.keyHandler) {
      window.removeEventListener("keydown", this.keyHandler, { capture: true });
      this.keyHandler = null;
    }
    this.listening = null;
    this.render();
  }

  private resetToDefault(): void {
    this.config = createDefaultInputConfig();
    saveInputConfig(this.config);
    this.onUpdate(this.config);
    this.render();
  }
}
