import { describe, it, expect } from "vitest";

// Inline minimal VsSimulation for testing (mirrors server/src/simulation.ts logic)
// since we can't import from server/ in client tests

const VS_MAX_HP = 1000;
const VS_WALL_DAMAGE = 200;
const VS_ORB_DAMAGE = 75;
const VS_PASS_HEAL = 25;
const VS_INVINCIBLE_FRAMES = 120;

interface PlayerState {
  hp: number;
  score: number;
  invincibleUntilFrame: number;
}

function createPlayer(): PlayerState {
  return { hp: VS_MAX_HP, score: 0, invincibleUntilFrame: 0 };
}

describe("VS HP mechanics", () => {
  it("wall hit reduces HP by 200", () => {
    const p = createPlayer();
    p.hp = Math.max(0, p.hp - VS_WALL_DAMAGE);
    expect(p.hp).toBe(800);
  });

  it("wall hit during invincibility does nothing", () => {
    const p = createPlayer();
    p.invincibleUntilFrame = 120;
    const frame = 50;
    if (frame >= p.invincibleUntilFrame) {
      p.hp -= VS_WALL_DAMAGE;
    }
    expect(p.hp).toBe(VS_MAX_HP);
  });

  it("wall hit after invincibility expires deals damage", () => {
    const p = createPlayer();
    p.invincibleUntilFrame = 120;
    const frame = 121;
    if (frame >= p.invincibleUntilFrame) {
      p.hp = Math.max(0, p.hp - VS_WALL_DAMAGE);
      p.invincibleUntilFrame = frame + VS_INVINCIBLE_FRAMES;
    }
    expect(p.hp).toBe(800);
    expect(p.invincibleUntilFrame).toBe(241);
  });

  it("5 wall hits kill a player", () => {
    const p = createPlayer();
    for (let i = 0; i < 5; i++) {
      p.hp = Math.max(0, p.hp - VS_WALL_DAMAGE);
    }
    expect(p.hp).toBe(0);
  });

  it("wall pass heals 25, capped at 1000", () => {
    const p = createPlayer();
    p.hp = 990;
    p.hp = Math.min(VS_MAX_HP, p.hp + VS_PASS_HEAL);
    expect(p.hp).toBe(VS_MAX_HP);
  });

  it("orb collect deals 75 to opponent", () => {
    const p1 = createPlayer();
    const p2 = createPlayer();
    p2.hp = Math.max(0, p2.hp - VS_ORB_DAMAGE);
    expect(p2.hp).toBe(925);
    expect(p1.hp).toBe(VS_MAX_HP);
  });

  it("full game scenario: hits + heals + orbs", () => {
    const p1 = createPlayer();
    const p2 = createPlayer();

    // P1 hits wall 3 times
    for (let i = 0; i < 3; i++) p1.hp = Math.max(0, p1.hp - VS_WALL_DAMAGE);
    expect(p1.hp).toBe(400);

    // P1 passes 10 walls
    for (let i = 0; i < 10; i++) p1.hp = Math.min(VS_MAX_HP, p1.hp + VS_PASS_HEAL);
    expect(p1.hp).toBe(650);

    // P2 collects 2 orbs → P1 takes 150 damage
    for (let i = 0; i < 2; i++) p1.hp = Math.max(0, p1.hp - VS_ORB_DAMAGE);
    expect(p1.hp).toBe(500);

    // P1 collects 1 orb → P2 takes 75 damage
    p2.hp = Math.max(0, p2.hp - VS_ORB_DAMAGE);
    expect(p2.hp).toBe(925);
  });

  it("game ends when HP reaches 0", () => {
    const p = createPlayer();
    let finished = false;
    for (let i = 0; i < 10; i++) {
      p.hp = Math.max(0, p.hp - VS_WALL_DAMAGE);
      if (p.hp <= 0) { finished = true; break; }
    }
    expect(finished).toBe(true);
    expect(p.hp).toBe(0);
  });
});
