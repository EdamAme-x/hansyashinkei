import {
  AmbientLight, DirectionalLight, PointLight,
  Mesh, Group, LineSegments,
  BoxGeometry, SphereGeometry, PlaneGeometry, EdgesGeometry,
  MeshStandardMaterial, LineBasicMaterial,
  Color,
} from "three";
import type { GameConfig } from "@domain/entities/GameConfig";
import type { GameWorldState } from "@domain/entities/GameWorld";
import { ThreeSceneAdapter } from "./ThreeSceneAdapter";

const LANE_LENGTH = 250;

export class GameRenderer {
  readonly adapter: ThreeSceneAdapter;

  private readonly config: GameConfig;
  private readonly laneWidth: number;
  private readonly laneOffset: number;
  private readonly ballMeshes: Mesh[] = [];
  private readonly ballGlows: PointLight[] = [];
  private readonly wallMeshPool: Group[] = [];
  private readonly activeWallMeshes = new Map<number, Group>();

  private readonly wallGeometry: BoxGeometry;
  private readonly wallEdgesGeometry: EdgesGeometry;
  private readonly wallMaterial: MeshStandardMaterial;
  private readonly wallReflectionMaterial: MeshStandardMaterial;
  private readonly wallEdgesMaterial: LineBasicMaterial;

  constructor(container: HTMLElement, config: GameConfig) {
    this.config = config;
    const { laneWidth, wallHeight, wallDepth } = config.render;
    this.laneWidth = laneWidth;
    this.laneOffset = ((config.laneCount - 1) / 2) * laneWidth;
    this.adapter = new ThreeSceneAdapter(container);

    // Lighting — 2 lights only (key + fill)
    const ambient = new AmbientLight(0xffffff, 0.3);
    this.adapter.add(ambient);

    const dirLight = new DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(3, 20, 10);
    this.adapter.add(dirLight);

    const rimLight = new DirectionalLight(0xffffff, 0.4);
    rimLight.position.set(-2, 8, -10);
    this.adapter.add(rimLight);

    this.buildLanes();
    this.buildBalls();

    this.wallGeometry = new BoxGeometry(laneWidth * 0.88, wallHeight, wallDepth);
    this.wallEdgesGeometry = new EdgesGeometry(this.wallGeometry);
    this.wallMaterial = new MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.9,
      roughness: 0.3,
    });
    this.wallReflectionMaterial = new MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.9,
      roughness: 0.3,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    this.wallEdgesMaterial = new LineBasicMaterial({
      color: 0xffffff,
      linewidth: 1,
    });
  }

  private laneX(lane: number): number {
    return lane * this.laneWidth - this.laneOffset;
  }

  private buildBalls(): void {
    const { ballRadius, ballY } = this.config.render;
    const ballGeo = new SphereGeometry(ballRadius, 32, 32);

    for (let i = 0; i < this.config.balls.length; i++) {
      const mat = new MeshStandardMaterial({
        color: 0xdddddd,
        metalness: 0.4,
        roughness: 0.15,
      });

      const mesh = new Mesh(ballGeo, mat);
      mesh.position.set(this.laneX(this.config.balls[i].homeLane), ballY, 0);
      this.adapter.add(mesh);
      this.ballMeshes.push(mesh);

      const glow = new PointLight(0xffffff, 1.0, 8);
      glow.position.set(this.laneX(this.config.balls[i].homeLane), ballY + 0.4, 0);
      this.adapter.add(glow);
      this.ballGlows.push(glow);
    }
  }

  private buildLanes(): void {
    const { laneCount } = this.config;
    const { laneWidth } = this;

    const groundGeo = new PlaneGeometry(laneWidth * laneCount + 2, LANE_LENGTH);
    const groundMat = new MeshStandardMaterial({
      color: 0x101018, metalness: 0.7, roughness: 0.5,
    });
    const ground = new Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.02, -LANE_LENGTH / 2 + 10);
    this.adapter.add(ground);

    for (let i = 0; i < laneCount; i++) {
      const stripGeo = new PlaneGeometry(laneWidth * 0.92, LANE_LENGTH);
      const stripMat = new MeshStandardMaterial({
        color: 0x1a1a24, metalness: 0.6, roughness: 0.5,
      });
      const strip = new Mesh(stripGeo, stripMat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(this.laneX(i), -0.01, -LANE_LENGTH / 2 + 10);
      this.adapter.add(strip);
    }

    for (let i = 0; i <= laneCount; i++) {
      const x = i * laneWidth - this.laneOffset - laneWidth / 2;
      const lineGeo = new PlaneGeometry(0.06, LANE_LENGTH);
      const lineMat = new MeshStandardMaterial({
        color: 0x555555,
        emissive: new Color(0x333333),
        emissiveIntensity: 0.6,
      });
      const line = new Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.01, -LANE_LENGTH / 2 + 10);
      this.adapter.add(line);
    }

    const zoneGeo = new PlaneGeometry(laneWidth * laneCount + 1, 0.1);
    const zoneMat = new MeshStandardMaterial({
      color: 0xffffff,
      emissive: new Color(0xffffff),
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.35,
    });
    const zoneLine = new Mesh(zoneGeo, zoneMat);
    zoneLine.rotation.x = -Math.PI / 2;
    zoneLine.position.set(0, 0.02, 0);
    this.adapter.add(zoneLine);
  }

  private getWallGroup(): Group {
    const recycled = this.wallMeshPool.pop();
    if (recycled) {
      recycled.visible = true;
      return recycled;
    }
    const group = new Group();
    const mesh = new Mesh(this.wallGeometry, this.wallMaterial);
    group.add(mesh);

    const line = new LineSegments(this.wallEdgesGeometry, this.wallEdgesMaterial);
    group.add(line);

    // Reflection: mirrored across floor (y=0).
    // Group is at world y=wallHeight/2. Reflection local y=-wallHeight
    // puts its center at world y = wallHeight/2 - wallHeight = -wallHeight/2.
    const reflection = new Mesh(this.wallGeometry, this.wallReflectionMaterial);
    reflection.scale.y = -1;
    reflection.position.y = -this.config.render.wallHeight;
    reflection.renderOrder = -1;
    group.add(reflection);

    this.adapter.add(group);
    return group;
  }

  private recycleWallGroup(group: Group): void {
    group.visible = false;
    this.wallMeshPool.push(group);
  }

  sync(world: GameWorldState): void {
    const wallY = this.config.render.wallHeight / 2;

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
      group.position.set(this.laneX(wall.lane), wallY, wall.z);
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
    this.wallEdgesGeometry.dispose();
    this.wallMaterial.dispose();
    this.wallReflectionMaterial.dispose();
    this.wallEdgesMaterial.dispose();
    this.adapter.dispose();
  }
}
