import type { InputConfig } from "./InputConfig";
import { saveInputConfig, codeToLabel, createDefaultInputConfig } from "./InputConfig";
import type { KVStore } from "@domain/repositories/KVStore";
import { el } from "./dom";

type Slot = { ballIndex: number; idx: number };
type Tab = "classic" | "triple";

interface SlotDef {
  id: string;
  slot: Slot;
}

const CLASSIC_SLOTS: SlotDef[] = [
  { id: "c-left-1", slot: { ballIndex: 0, idx: 0 } },
  { id: "c-left-2", slot: { ballIndex: 0, idx: 1 } },
  { id: "c-right-1", slot: { ballIndex: 1, idx: 0 } },
  { id: "c-right-2", slot: { ballIndex: 1, idx: 1 } },
];

const TRIPLE_SLOTS: SlotDef[] = [
  { id: "t-left-1", slot: { ballIndex: 0, idx: 0 } },
  { id: "t-left-2", slot: { ballIndex: 0, idx: 1 } },
  { id: "t-mid-1", slot: { ballIndex: 2, idx: 0 } },
  { id: "t-mid-2", slot: { ballIndex: 2, idx: 1 } },
  { id: "t-right-1", slot: { ballIndex: 1, idx: 0 } },
  { id: "t-right-2", slot: { ballIndex: 1, idx: 1 } },
];

const ALL_SLOTS = [...CLASSIC_SLOTS, ...TRIPLE_SLOTS];

export class KeybindUI {
  private readonly screen = el("keybind-screen");
  private readonly resetBtn = el("keybind-reset");
  private readonly closeBtn = el("keybind-close");
  private readonly tabClassicBtn = el("keybind-tab-classic");
  private readonly tabTripleBtn = el("keybind-tab-triple");
  private readonly panelClassic = el("keybind-panel-classic");
  private readonly panelTriple = el("keybind-panel-triple");

  private config: InputConfig;
  private readonly kv: KVStore;
  private readonly onUpdate: (config: InputConfig) => void;
  private readonly onClose: () => void;
  private currentTab: Tab = "classic";
  private listeningSlot: Slot | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  private readonly keyEls = new Map<string, HTMLElement>();
  private readonly btnEls = new Map<string, HTMLElement>();

  constructor(
    config: InputConfig,
    kv: KVStore,
    onUpdate: (config: InputConfig) => void,
    onClose: () => void,
  ) {
    this.config = config;
    this.kv = kv;
    this.onUpdate = onUpdate;
    this.onClose = onClose;

    for (const { id, slot } of ALL_SLOTS) {
      this.keyEls.set(id, el(`keybind-${id}-key`));
      const btn = el(`keybind-${id}-btn`);
      this.btnEls.set(id, btn);
      btn.addEventListener("click", () => this.startListening(slot));
    }

    this.tabClassicBtn.addEventListener("click", () => this.switchTab("classic"));
    this.tabTripleBtn.addEventListener("click", () => this.switchTab("triple"));
    this.resetBtn.addEventListener("click", () => this.resetToDefault());
    this.closeBtn.addEventListener("click", () => this.hide());
    this.render();
  }

  show(): void {
    this.render();
    this.screen.classList.remove("hidden");
  }

  isOpen(): boolean {
    return !this.screen.classList.contains("hidden");
  }

  hide(): void {
    this.stopListening();
    this.screen.classList.add("hidden");
    this.onClose();
  }

  private switchTab(tab: Tab): void {
    this.stopListening();
    this.currentTab = tab;
    this.tabClassicBtn.classList.toggle("active", tab === "classic");
    this.tabTripleBtn.classList.toggle("active", tab === "triple");
    this.panelClassic.classList.toggle("hidden", tab !== "classic");
    this.panelTriple.classList.toggle("hidden", tab !== "triple");
    this.render();
  }

  private getBindingsFor(ballIndex: number): string[] {
    return this.config.dodge
      .filter((b) => b.ballIndex === ballIndex)
      .map((b) => b.code);
  }

  private render(): void {
    const slots = this.currentTab === "classic" ? CLASSIC_SLOTS : TRIPLE_SLOTS;

    for (const { id, slot } of slots) {
      const codes = this.getBindingsFor(slot.ballIndex);
      const code = codes[slot.idx];
      const keyEl = this.keyEls.get(id);
      if (keyEl) keyEl.textContent = code ? codeToLabel(code) : "—";
    }

    for (const { id, slot } of slots) {
      const btn = this.btnEls.get(id);
      const isListening = this.listeningSlot?.ballIndex === slot.ballIndex
        && this.listeningSlot?.idx === slot.idx;
      btn?.classList.toggle("listening", isListening);
    }
  }

  private startListening(slot: Slot): void {
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

      saveInputConfig(this.kv, this.config);
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
    saveInputConfig(this.kv, this.config);
    this.onUpdate(this.config);
    this.render();
  }
}
