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

/** Apply authoritative server state to the local VS world.
 *  NOTE: Does NOT sync ball dodge state — that's kept local for responsiveness. */
export function applyServerState(
  vs: VsWorldState,
  serverState: VsPlayerState,
  orbs: VsOrbState[],
): void {
  vs.hp = serverState.hp;
  vs.invincibleUntilFrame = serverState.invincibleUntilFrame;
  vs.orbs = orbs;
  // Ball dodge state is NOT synced from server — local input is authoritative
  // to avoid input lag where server state overwrites local dodge before it roundtrips
}
