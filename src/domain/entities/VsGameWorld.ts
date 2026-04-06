import type { GameWorldState } from "./GameWorld";
import type { VsPlayerState, VsOrbState } from "@shared/protocol";
import { VS_MAX_HP } from "@shared/protocol";

/** Client-side VS world state — extends base world with HP/invincibility/orbs. */
export interface VsWorldState {
  world: GameWorldState;
  hp: number;
  invincibleUntilFrame: number;
  orbs: VsOrbState[];
}

export function createVsWorldState(world: GameWorldState): VsWorldState {
  return {
    world,
    hp: VS_MAX_HP,
    invincibleUntilFrame: 0,
    orbs: [],
  };
}

/** Apply authoritative server state to the local VS world. */
export function applyServerState(
  vs: VsWorldState,
  serverState: VsPlayerState,
  orbs: VsOrbState[],
): void {
  vs.hp = serverState.hp;
  vs.invincibleUntilFrame = serverState.invincibleUntilFrame;
  vs.orbs = orbs;

  // Sync ball dodge state from server
  for (let i = 0; i < vs.world.balls.length && i < serverState.dodging.length; i++) {
    const serverDodging = serverState.dodging[i];
    if (vs.world.balls[i].dodging !== serverDodging) {
      vs.world.balls[i] = {
        lane: serverDodging
          ? vs.world.config.balls[i].dodgeLane
          : vs.world.config.balls[i].homeLane,
        dodging: serverDodging,
      };
    }
  }
}
