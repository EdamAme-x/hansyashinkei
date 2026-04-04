export interface Wall {
  readonly id: number;
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

export function createWall(idGen: WallIdGen, lane: number, z: number): Wall {
  return { id: idGen.next(), lane, z, passed: false };
}
