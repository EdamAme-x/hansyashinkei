import { describe, it, expect } from "vitest";
import { createBalls, dodgeBall, returnBall } from "@domain/entities/Lane";
import { createDefaultConfig } from "@domain/entities/GameConfig";

const config = createDefaultConfig();

describe("Lane / Ball", () => {
  it("should create balls at home lanes from config", () => {
    const balls = createBalls(config);
    expect(balls[0].lane).toBe(1);
    expect(balls[1].lane).toBe(2);
    expect(balls[0].dodging).toBe(false);
    expect(balls[1].dodging).toBe(false);
  });

  it("should dodge left ball to dodge lane", () => {
    const balls = createBalls(config);
    const dodged = dodgeBall(balls[0], 0, config);
    expect(dodged.lane).toBe(0);
    expect(dodged.dodging).toBe(true);
  });

  it("should dodge right ball to dodge lane", () => {
    const balls = createBalls(config);
    const dodged = dodgeBall(balls[1], 1, config);
    expect(dodged.lane).toBe(3);
    expect(dodged.dodging).toBe(true);
  });

  it("should return ball to home lane", () => {
    const balls = createBalls(config);
    const dodged = dodgeBall(balls[0], 0, config);
    const returned = returnBall(dodged, 0, config);
    expect(returned.lane).toBe(1);
    expect(returned.dodging).toBe(false);
  });

  it("should not dodge if already dodging", () => {
    const balls = createBalls(config);
    const dodged = dodgeBall(balls[0], 0, config);
    const again = dodgeBall(dodged, 0, config);
    expect(again.lane).toBe(0);
  });
});
