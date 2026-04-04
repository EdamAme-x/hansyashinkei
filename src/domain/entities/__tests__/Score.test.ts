import { describe, it, expect } from "vitest";
import { createScore, buildHistory } from "@domain/entities/Score";

describe("createScore", () => {
  it("should create a score with the given value", () => {
    const score = createScore("s-1", 150);

    expect(score.id).toBe("s-1");
    expect(score.value).toBe(150);
    expect(score.timestamp).toBeGreaterThan(0);
  });
});

describe("buildHistory", () => {
  it("should return null bestScore for empty array", () => {
    const history = buildHistory([]);

    expect(history.scores).toEqual([]);
    expect(history.bestScore).toBeNull();
  });

  it("should identify the best score", () => {
    const scores = [
      createScore("a", 100),
      createScore("b", 300),
      createScore("c", 200),
    ];
    const history = buildHistory(scores);

    expect(history.bestScore?.value).toBe(300);
    expect(history.bestScore?.id).toBe("b");
  });

  it("should sort scores by timestamp descending", () => {
    const now = Date.now();
    const scores = [
      { id: "1", value: 10, timestamp: now - 2000, replayId: null },
      { id: "2", value: 20, timestamp: now, replayId: null },
      { id: "3", value: 15, timestamp: now - 1000, replayId: null },
    ];
    const history = buildHistory(scores);

    expect(history.scores.map((s) => s.id)).toEqual(["2", "3", "1"]);
  });
});
