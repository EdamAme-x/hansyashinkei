export interface Wall {
  readonly id: number;
  readonly waveId: number;
  readonly lane: number;
  z: number;
  passed: boolean;
}

export interface WallIdGen {
  next(): number;
  reset(): void;
}

export function createWallIdGen(): WallIdGen {
  let id = 0;
  return {
    next: () => id++,
    reset: () => { id = 0; },
  };
}

export function createWall(idGen: WallIdGen, waveId: number, lane: number, z: number): Wall {
  return { id: idGen.next(), waveId, lane, z, passed: false };
}
