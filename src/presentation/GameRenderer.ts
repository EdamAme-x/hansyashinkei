import * as THREE from "three";
import { LANE_COUNT } from "@domain/entities/Lane";
import type { GameWorldState } from "@domain/entities/GameWorld";
import { ThreeSceneAdapter } from "@infrastructure/threejs/ThreeSceneAdapter";

const LANE_WIDTH = 2.5;
const LANE_OFFSET = ((LANE_COUNT - 1) / 2) * LANE_WIDTH;

function laneX(lane: number): number {
  return lane * LANE_WIDTH - LANE_OFFSET;
}

export class GameRenderer {
  readonly adapter: ThreeSceneAdapter;

  private readonly ballMeshes: [THREE.Mesh, THREE.Mesh];
  private readonly wallMeshPool: THREE.Mesh[] = [];
  private readonly activeWallMeshes = new Map<number, THREE.Mesh>();

  private readonly wallGeometry: THREE.BoxGeometry;
  private readonly wallMaterial: THREE.MeshStandardMaterial;

  private laneMeshes: THREE.Mesh[] = [];

  constructor(container: HTMLElement) {
    this.adapter = new ThreeSceneAdapter(container);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 15, 10);
    dirLight.castShadow = true;
    this.adapter.add(ambient);
    this.adapter.add(dirLight);

    // Lane floor
    this.buildLanes();

    // Balls
    const ballGeo = new THREE.SphereGeometry(0.4, 32, 32);
    const ballMatL = new THREE.MeshStandardMaterial({ color: 0x4fc3f7 });
    const ballMatR = new THREE.MeshStandardMaterial({ color: 0xef5350 });

    const leftBall = new THREE.Mesh(ballGeo, ballMatL);
    leftBall.castShadow = true;
    leftBall.position.set(laneX(1), 0.4, 0);

    const rightBall = new THREE.Mesh(ballGeo, ballMatR);
    rightBall.castShadow = true;
    rightBall.position.set(laneX(2), 0.4, 0);

    this.ballMeshes = [leftBall, rightBall];
    this.adapter.add(leftBall);
    this.adapter.add(rightBall);

    // Wall geometry pool
    this.wallGeometry = new THREE.BoxGeometry(LANE_WIDTH * 0.8, 1.5, 0.5);
    this.wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6f00,
      transparent: true,
      opacity: 0.85,
    });
  }

  private buildLanes(): void {
    const laneGeo = new THREE.PlaneGeometry(LANE_WIDTH * 0.9, 120);
    const laneMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a3e,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < LANE_COUNT; i++) {
      const plane = new THREE.Mesh(laneGeo, laneMat);
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(laneX(i), -0.01, -30);
      plane.receiveShadow = true;
      this.adapter.add(plane);
      this.laneMeshes.push(plane);
    }

    // Lane dividers
    const dividerGeo = new THREE.PlaneGeometry(0.05, 120);
    const dividerMat = new THREE.MeshStandardMaterial({
      color: 0x3a3a6e,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i <= LANE_COUNT; i++) {
      const x = (i - 0.5) * LANE_WIDTH - LANE_OFFSET;
      const div = new THREE.Mesh(dividerGeo, dividerMat);
      div.rotation.x = -Math.PI / 2;
      div.position.set(x, 0, -30);
      this.adapter.add(div);
    }
  }

  private getWallMesh(): THREE.Mesh {
    const recycled = this.wallMeshPool.pop();
    if (recycled) {
      recycled.visible = true;
      return recycled;
    }
    const mesh = new THREE.Mesh(this.wallGeometry, this.wallMaterial);
    mesh.castShadow = true;
    this.adapter.add(mesh);
    return mesh;
  }

  private recycleWallMesh(mesh: THREE.Mesh): void {
    mesh.visible = false;
    this.wallMeshPool.push(mesh);
  }

  sync(world: GameWorldState): void {
    // Balls
    for (let i = 0; i < 2; i++) {
      const target = laneX(world.balls[i].lane);
      const mesh = this.ballMeshes[i];
      mesh.position.x += (target - mesh.position.x) * 0.3;
    }

    // Walls – add / update
    const activeIds = new Set<number>();
    for (const wall of world.walls) {
      activeIds.add(wall.id);
      let mesh = this.activeWallMeshes.get(wall.id);
      if (!mesh) {
        mesh = this.getWallMesh();
        this.activeWallMeshes.set(wall.id, mesh);
      }
      mesh.position.set(laneX(wall.lane), 0.75, wall.z);
    }

    // Remove stale
    for (const [id, mesh] of this.activeWallMeshes) {
      if (!activeIds.has(id)) {
        this.recycleWallMesh(mesh);
        this.activeWallMeshes.delete(id);
      }
    }
  }

  render(): void {
    this.adapter.render();
  }

  resize(w: number, h: number): void {
    this.adapter.resize(w, h);
  }

  showBalls(visible: boolean): void {
    for (const m of this.ballMeshes) m.visible = visible;
  }

  clearWalls(): void {
    for (const [, mesh] of this.activeWallMeshes) {
      this.recycleWallMesh(mesh);
    }
    this.activeWallMeshes.clear();
  }

  dispose(): void {
    this.wallGeometry.dispose();
    this.wallMaterial.dispose();
    this.adapter.dispose();
  }
}
