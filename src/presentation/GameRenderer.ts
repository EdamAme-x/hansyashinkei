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
  private readonly wallMeshPool: THREE.Group[] = [];
  private readonly activeWallMeshes = new Map<number, THREE.Group>();

  private readonly wallGeometry: THREE.BoxGeometry;
  private readonly wallMaterial: THREE.MeshStandardMaterial;
  private readonly wallEdgesMaterial: THREE.LineBasicMaterial;

  constructor(container: HTMLElement, config: GameConfig) {
    this.config = config;
    this.laneOffset = ((config.laneCount - 1) / 2) * LANE_WIDTH;
    this.adapter = new ThreeSceneAdapter(container);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.2);
    this.adapter.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(3, 20, 10);
    dirLight.castShadow = true;
    this.adapter.add(dirLight);

    // Rim light from behind for ball highlights
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
    rimLight.position.set(-2, 8, -10);
    this.adapter.add(rimLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.15);
    backLight.position.set(0, 5, -30);
    this.adapter.add(backLight);

    this.buildLanes();
    this.buildBalls();

    // Wall — tall, white edges
    this.wallGeometry = new THREE.BoxGeometry(LANE_WIDTH * 0.88, 3.5, 0.5);
    this.wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.9,
      roughness: 0.3,
    });
    this.wallEdgesMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      linewidth: 1,
    });
  }

  private laneX(lane: number): number {
    return lane * LANE_WIDTH - this.laneOffset;
  }

  private buildBalls(): void {
    const ballGeo = new THREE.SphereGeometry(0.88, 32, 32);

    for (let i = 0; i < this.config.balls.length; i++) {
      const mat = new THREE.MeshPhysicalMaterial({
        color: 0xdddddd,
        metalness: 0.05,
        roughness: 0.15,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        sheen: 0.5,
        sheenRoughness: 0.3,
        sheenColor: new THREE.Color(0xffffff),
        reflectivity: 0.9,
      });

      const mesh = new THREE.Mesh(ballGeo, mat);
      mesh.castShadow = true;
      mesh.position.set(this.laneX(this.config.balls[i].homeLane), 0.8, 0);
      this.adapter.add(mesh);
      this.ballMeshes.push(mesh);

      const glow = new THREE.PointLight(0xffffff, 1.0, 8);
      glow.position.set(this.laneX(this.config.balls[i].homeLane), 1.2, 0);
      this.adapter.add(glow);
      this.ballGlows.push(glow);
    }
  }

  private buildLanes(): void {
    const { laneCount } = this.config;

    // Ground — dark
    const groundGeo = new THREE.PlaneGeometry(LANE_WIDTH * laneCount + 2, LANE_LENGTH);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x101018, metalness: 0.7, roughness: 0.5,
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
        color: 0x1a1a24, metalness: 0.6, roughness: 0.5,
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
      const lineGeo = new THREE.PlaneGeometry(0.06, LANE_LENGTH);
      const lineMat = new THREE.MeshStandardMaterial({
        color: 0x555555,
        emissive: 0x333333,
        emissiveIntensity: 0.6,
      });
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.01, -LANE_LENGTH / 2 + 10);
      this.adapter.add(line);
    }

    // Ball zone line
    const zoneGeo = new THREE.PlaneGeometry(LANE_WIDTH * laneCount + 1, 0.1);
    const zoneMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.35,
    });
    const zoneLine = new THREE.Mesh(zoneGeo, zoneMat);
    zoneLine.rotation.x = -Math.PI / 2;
    zoneLine.position.set(0, 0.02, 0);
    this.adapter.add(zoneLine);
  }

  private getWallGroup(): THREE.Group {
    const recycled = this.wallMeshPool.pop();
    if (recycled) {
      recycled.visible = true;
      return recycled;
    }
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(this.wallGeometry, this.wallMaterial);
    mesh.castShadow = true;
    group.add(mesh);

    const edges = new THREE.EdgesGeometry(this.wallGeometry);
    const line = new THREE.LineSegments(edges, this.wallEdgesMaterial);
    group.add(line);

    this.adapter.add(group);
    return group;
  }

  private recycleWallGroup(group: THREE.Group): void {
    group.visible = false;
    this.wallMeshPool.push(group);
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
      let group = this.activeWallMeshes.get(wall.id);
      if (!group) {
        group = this.getWallGroup();
        this.activeWallMeshes.set(wall.id, group);
      }
      group.position.set(this.laneX(wall.lane), 1.75, wall.z);
    }

    for (const [id, group] of this.activeWallMeshes) {
      if (!activeIds.has(id)) {
        this.recycleWallGroup(group);
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
    for (const [, group] of this.activeWallMeshes) {
      this.recycleWallGroup(group);
    }
    this.activeWallMeshes.clear();
  }

  dispose(): void {
    this.wallGeometry.dispose();
    this.wallMaterial.dispose();
    this.wallEdgesMaterial.dispose();
    this.adapter.dispose();
  }
}
