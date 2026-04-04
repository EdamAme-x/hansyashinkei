import { describe, it, expect } from "vitest";
import { BallSide, createBalls, dodgeBall, returnBall } from "@domain/entities/Lane";

describe("Lane / Ball", () => {
  it("should create balls at lanes 1 and 2", () => {
    const [left, right] = createBalls();
    expect(left.lane).toBe(1);
    expect(right.lane).toBe(2);
    expect(left.dodging).toBe(false);
    expect(right.dodging).toBe(false);
  });

  it("should dodge left ball to lane 0", () => {
    const [left] = createBalls();
    const dodged = dodgeBall(left, BallSide.Left);
    expect(dodged.lane).toBe(0);
    expect(dodged.dodging).toBe(true);
  });

  it("should dodge right ball to lane 3", () => {
    const [, right] = createBalls();
    const dodged = dodgeBall(right, BallSide.Right);
    expect(dodged.lane).toBe(3);
    expect(dodged.dodging).toBe(true);
  });

  it("should return ball to original lane", () => {
    const [left] = createBalls();
    const dodged = dodgeBall(left, BallSide.Left);
    const returned = returnBall(dodged, BallSide.Left);
    expect(returned.lane).toBe(1);
    expect(returned.dodging).toBe(false);
  });

  it("should not dodge if already dodging", () => {
    const [left] = createBalls();
    const dodged = dodgeBall(left, BallSide.Left);
    const again = dodgeBall(dodged, BallSide.Left);
    expect(again.lane).toBe(0);
  });
});
