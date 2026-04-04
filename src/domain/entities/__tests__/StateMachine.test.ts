import { describe, it, expect, vi } from "vitest";
import { StateMachine, GameState, GameEvent } from "@domain/entities/StateMachine";

describe("StateMachine", () => {
  it("should start in Title state", () => {
    const sm = new StateMachine();
    expect(sm.state).toBe(GameState.Title);
  });

  it("should transition Title -> Playing on Start", () => {
    const sm = new StateMachine();
    expect(sm.dispatch(GameEvent.Start)).toBe(true);
    expect(sm.state).toBe(GameState.Playing);
  });

  it("should transition Playing -> GameOver on Die", () => {
    const sm = new StateMachine(GameState.Playing);
    expect(sm.dispatch(GameEvent.Die)).toBe(true);
    expect(sm.state).toBe(GameState.GameOver);
  });

  it("should transition GameOver -> Playing on Restart", () => {
    const sm = new StateMachine(GameState.GameOver);
    expect(sm.dispatch(GameEvent.Restart)).toBe(true);
    expect(sm.state).toBe(GameState.Playing);
  });

  it("should transition GameOver -> Title on BackToTitle", () => {
    const sm = new StateMachine(GameState.GameOver);
    expect(sm.dispatch(GameEvent.BackToTitle)).toBe(true);
    expect(sm.state).toBe(GameState.Title);
  });

  it("should reject invalid transitions", () => {
    const sm = new StateMachine();
    expect(sm.dispatch(GameEvent.Die)).toBe(false);
    expect(sm.state).toBe(GameState.Title);
  });

  it("should call listeners on transition", () => {
    const sm = new StateMachine();
    const listener = vi.fn();
    sm.onStateChange(listener);

    sm.dispatch(GameEvent.Start);

    expect(listener).toHaveBeenCalledWith(GameState.Title, GameState.Playing);
  });

  it("should allow unsubscribe", () => {
    const sm = new StateMachine();
    const listener = vi.fn();
    const unsub = sm.onStateChange(listener);

    unsub();
    sm.dispatch(GameEvent.Start);

    expect(listener).not.toHaveBeenCalled();
  });
});
