import * as THREE from "three";
import type { GameConfig } from "@domain/entities/GameConfig";
import type { GameWorldState } from "@domain/entities/GameWorld";
import { ThreeSceneAdapter } from "./ThreeSceneAdapter";

const LANE_WIDTH = 2.5;
const LANE_LENGTH = 250;

export class GameRenderer {
  readonly adapter: ThreeSceneAdapter;

  private readonly config: GameConfig;
  private readonly laneOffset: number;
  private readonly ballMeshes: THREE.Mesh[] = [];
  private readonly ballGlows: THREE.PointLight[] = [];
  private readonly wallMeshPool: THREE.Mesh[] = [];
  private readonly activeWallMeshes = new Map<number, THREE.Mesh>();

  private readonly wallGeometry: THREE.BoxGeometry;
  private readonly wallMaterial: THREE.MeshStandardMaterial;

  constructor(container: HTMLElement, config: GameConfig) {
    this.config = config;
    this.laneOffset = ((config.laneCount - 1) / 2) * LANE_WIDTH;
    this.adapter = new ThreeSceneAdapter(container);

    // Lighting
    const ambient = new THREE.AmbientLight(0x8888ff, 0.15);
    this.adapter.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(5, 20, 15);
    dirLight.castShadow = true;
    this.adapter.add(dirLight);

    const fillL = new THREE.PointLight(0x4fc3f7, 0.4, 50);
    fillL.position.set(-5, 3, 0);
    this.adapter.add(fillL);

    const fillR = new THREE.PointLight(0xef5350, 0.4, 50);
    fillR.position.set(5, 3, 0);
    this.adapter.add(fillR);

    this.buildLanes();
    this.buildBalls();

    // Wall geometry
    this.wallGeometry = new THREE.BoxGeometry(LANE_WIDTH * 0.85, 2.0, 0.6);
    this.wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xff3d00,
      emissive: 0xff6f00,
      emissiveIntensity: 0.4,
      metalness: 0.6,
      roughness: 0.3,
      transparent: true,
      opacity: 0.9,
    });
  }

  private laneX(lane: number): number {
    return lane * LANE_WIDTH - this.laneOffset;
  }

  private buildBalls(): void {
    const ballGeo = new THREE.SphereGeometry(0.8, 32, 32);
    const colors = [0x4fc3f7, 0xef5350, 0x66bb6a, 0xffa726, 0xab47bc];

    for (let i = 0; i < this.config.balls.length; i++) {
      const color = colors[i % colors.length];
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.5,
        metalness: 0.3,
        roughness: 0.4,
      });

      const mesh = new THREE.Mesh(ballGeo, mat);
      mesh.castShadow = true;
      mesh.position.set(this.laneX(this.config.balls[i].homeLane), 0.8, 0);
      this.adapter.add(mesh);
      this.ballMeshes.push(mesh);

      const glow = new THREE.PointLight(color, 2.0, 12);
      glow.position.set(this.laneX(this.config.balls[i].homeLane), 1.2, 0);
      this.adapter.add(glow);
      this.ballGlows.push(glow);
    }
  }

  private buildLanes(): void {
    const { laneCount } = this.config;

    // Ground
    const groundGeo = new THREE.PlaneGeometry(LANE_WIDTH * laneCount + 2, LANE_LENGTH);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a20, metalness: 0.8, roughness: 0.5,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.02, -LANE_LENGTH / 2 + 10);
    ground.receiveShadow = true;
    this.adapter.add(ground);

    // Lane strips
    for (let i = 0; i < laneCount; i++) {
      const stripGeo = new THREE.PlaneGeometry(LANE_WIDTH * 0.92, LANE_LENGTH);
      const stripMat = new THREE.MeshStandardMaterial({
        color: 0x0e0e2a, metalness: 0.7, roughness: 0.6,
      });
      const strip = new THREE.Mesh(stripGeo, stripMat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(this.laneX(i), -0.01, -LANE_LENGTH / 2 + 10);
      strip.receiveShadow = true;
      this.adapter.add(strip);
    }

    // Dividers
    for (let i = 0; i <= laneCount; i++) {
      const x = i * LANE_WIDTH - this.laneOffset - LANE_WIDTH / 2;
      const lineGeo = new THREE.PlaneGeometry(0.04, LANE_LENGTH);
      const lineMat = new THREE.MeshStandardMaterial({
        color: 0x2a2a6e, emissive: 0x3333aa, emissiveIntensity: 0.6,
      });
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.01, -LANE_LENGTH / 2 + 10);
      this.adapter.add(line);
    }

    // Ball zone line
    const zoneGeo = new THREE.PlaneGeometry(LANE_WIDTH * laneCount + 1, 0.06);
    const zoneMat = new THREE.MeshStandardMaterial({
      color: 0x4fc3f7, emissive: 0x4fc3f7, emissiveIntensity: 1.0,
      transparent: true, opacity: 0.4,
    });
    const zoneLine = new THREE.Mesh(zoneGeo, zoneMat);
    zoneLine.rotation.x = -Math.PI / 2;
    zoneLine.position.set(0, 0.02, 0);
    this.adapter.add(zoneLine);
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
    for (let i = 0; i < world.balls.length; i++) {
      const target = this.laneX(world.balls[i].lane);
      const mesh = this.ballMeshes[i];
      mesh.position.x += (target - mesh.position.x) * 0.35;
      this.ballGlows[i].position.x = mesh.position.x;
    }

    const activeIds = new Set<number>();
    for (const wall of world.walls) {
      activeIds.add(wall.id);
      let mesh = this.activeWallMeshes.get(wall.id);
      if (!mesh) {
        mesh = this.getWallMesh();
        this.activeWallMeshes.set(wall.id, mesh);
      }
      mesh.position.set(this.laneX(wall.lane), 1.0, wall.z);
    }

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
    for (const g of this.ballGlows) g.visible = visible;
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
