export const GameState = {
  Title: "title",
  Playing: "playing",
  GameOver: "gameover",
} as const;

export type GameState = (typeof GameState)[keyof typeof GameState];

export const GameEvent = {
  Start: "start",
  Die: "die",
  Restart: "restart",
  BackToTitle: "backToTitle",
} as const;

export type GameEvent = (typeof GameEvent)[keyof typeof GameEvent];

type Transition = {
  from: GameState;
  event: GameEvent;
  to: GameState;
};

const transitions: Transition[] = [
  { from: GameState.Title, event: GameEvent.Start, to: GameState.Playing },
  { from: GameState.Playing, event: GameEvent.Die, to: GameState.GameOver },
  { from: GameState.GameOver, event: GameEvent.Restart, to: GameState.Playing },
  { from: GameState.GameOver, event: GameEvent.BackToTitle, to: GameState.Title },
];

export type StateChangeListener = (
  prev: GameState,
  next: GameState,
) => void;

export class StateMachine {
  private _state: GameState;
  private readonly listeners: StateChangeListener[] = [];

  constructor(initial: GameState = GameState.Title) {
    this._state = initial;
  }

  get state(): GameState {
    return this._state;
  }

  dispatch(event: GameEvent): boolean {
    const t = transitions.find(
      (tr) => tr.from === this._state && tr.event === event,
    );
    if (!t) return false;

    const prev = this._state;
    this._state = t.to;

    for (const listener of this.listeners) {
      listener(prev, this._state);
    }
    return true;
  }

  onStateChange(listener: StateChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }
}
