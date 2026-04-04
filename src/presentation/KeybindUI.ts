import type { InputConfig } from "./InputConfig";
import { saveInputConfig, codeToLabel, createDefaultInputConfig } from "./InputConfig";

function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing element #${id}`);
  return e;
}

// slot: "left-1", "left-2", "right-1", "right-2"
type Slot = { ballIndex: number; idx: number };

const SLOTS: { id: string; slot: Slot }[] = [
  { id: "left-1", slot: { ballIndex: 0, idx: 0 } },
  { id: "left-2", slot: { ballIndex: 0, idx: 1 } },
  { id: "right-1", slot: { ballIndex: 1, idx: 0 } },
  { id: "right-2", slot: { ballIndex: 1, idx: 1 } },
];

export class KeybindUI {
  private readonly screen = el("keybind-screen");
  private readonly resetBtn = el("keybind-reset");
  private readonly closeBtn = el("keybind-close");

  private config: InputConfig;
  private readonly onUpdate: (config: InputConfig) => void;
  private readonly onClose: () => void;
  private listeningSlot: Slot | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  private readonly keyEls: Map<string, HTMLElement> = new Map();
  private readonly btnEls: Map<string, HTMLElement> = new Map();

  constructor(
    config: InputConfig,
    onUpdate: (config: InputConfig) => void,
    onClose: () => void,
  ) {
    this.config = config;
    this.onUpdate = onUpdate;
    this.onClose = onClose;

    for (const { id, slot } of SLOTS) {
      this.keyEls.set(id, el(`keybind-${id}-key`));
      const btn = el(`keybind-${id}-btn`);
      this.btnEls.set(id, btn);
      btn.addEventListener("click", () => this.startListening(id, slot));
    }

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

  private getBindingsFor(ballIndex: number): string[] {
    return this.config.dodge
      .filter((b) => b.ballIndex === ballIndex)
      .map((b) => b.code);
  }

  private render(): void {
    for (const { id, slot } of SLOTS) {
      const codes = this.getBindingsFor(slot.ballIndex);
      const code = codes[slot.idx];
      const keyEl = this.keyEls.get(id);
      if (keyEl) keyEl.textContent = code ? codeToLabel(code) : "—";
    }

    for (const { id, slot } of SLOTS) {
      const btn = this.btnEls.get(id);
      const isListening = this.listeningSlot?.ballIndex === slot.ballIndex
        && this.listeningSlot?.idx === slot.idx;
      btn?.classList.toggle("listening", isListening);
    }
  }

  private startListening(_slotId: string, slot: Slot): void {
    this.stopListening();
    this.listeningSlot = slot;
    this.render();

    this.keyHandler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.code === "Escape") {
        this.stopListening();
        return;
      }

      const reserved = ["Space", "Enter", "Backspace", "Escape", "KeyH", "KeyK"];
      if (reserved.includes(e.code)) return;

      // Remove this key from any other binding
      this.config.dodge = this.config.dodge.filter((b) => b.code !== e.code);

      // Get current bindings for this ball
      const existing = this.config.dodge.filter((b) => b.ballIndex === slot.ballIndex);

      if (slot.idx < existing.length) {
        existing[slot.idx].code = e.code;
      } else {
        this.config.dodge.push({ code: e.code, ballIndex: slot.ballIndex });
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
    this.listeningSlot = null;
    this.render();
  }

  private resetToDefault(): void {
    this.config = createDefaultInputConfig();
    saveInputConfig(this.config);
    this.onUpdate(this.config);
    this.render();
  }
}
