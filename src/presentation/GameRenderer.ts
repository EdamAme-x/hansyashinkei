import {
  AmbientLight, DirectionalLight, PointLight,
  Mesh, Group, LineSegments,
  BoxGeometry, SphereGeometry, PlaneGeometry, EdgesGeometry,
  MeshStandardMaterial, MeshBasicMaterial, LineBasicMaterial,
  Color, AdditiveBlending, Vector3,
  TextureLoader, SRGBColorSpace, CanvasTexture,
} from "three";
import type { GameConfig } from "@domain/entities/GameConfig";
import type { ThemeConfig, SceneTheme } from "@domain/entities/ThemeConfig";
import type { GameWorldState } from "@domain/entities/GameWorld";
import { ThreeSceneAdapter } from "./ThreeSceneAdapter";

const LANE_LENGTH = 250;
const SHARD_COUNT = 24;
const SHARD_LIFETIME = 1.2;

interface Shard {
  mesh: Mesh;
  velocity: Vector3;
  life: number;
}

export class GameRenderer {
  readonly adapter: ThreeSceneAdapter;

  private readonly config: GameConfig;
  private readonly scene: SceneTheme;
  private readonly laneWidth: number;
  private readonly laneOffset: number;
  private readonly ballMeshes: Mesh[] = [];
  private readonly ballGlows: PointLight[] = [];
  private readonly shards: Shard[] = [];
  private readonly shardGeometry: BoxGeometry;
  private readonly shardMaterial: MeshBasicMaterial;
  private deathAnimId = 0;
  private readonly wallMeshPool: Group[] = [];
  private readonly activeWallMeshes = new Map<number, Group>();

  private readonly wallGeometry: BoxGeometry;
  private readonly wallEdgesGeometry: EdgesGeometry;
  private readonly wallMaterial: MeshStandardMaterial;
  private readonly wallEdgesMaterial: LineBasicMaterial;

  constructor(container: HTMLElement, config: GameConfig, theme: ThemeConfig) {
    this.config = config;
    this.scene = theme.scene;
    const { laneWidth, wallHeight, wallDepth } = config.render;
    this.laneWidth = laneWidth;
    this.laneOffset = ((config.laneCount - 1) / 2) * laneWidth;
    this.adapter = new ThreeSceneAdapter(container, theme.scene);

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
      color: this.scene.wallColor,
      metalness: this.scene.wallMetalness,
      roughness: this.scene.wallRoughness,
    });
    this.shardGeometry = new BoxGeometry(0.12, 0.12, 0.12);
    this.shardMaterial = new MeshBasicMaterial({
      color: this.scene.shardColor,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    // Load initial wall texture if set
    if (this.scene.wallTextureUrl) {
      new TextureLoader().load(this.scene.wallTextureUrl, (tex) => {
        tex.colorSpace = SRGBColorSpace;
        this.wallMaterial.map = tex;
        this.wallMaterial.needsUpdate = true;
      });
    }
    this.wallEdgesMaterial = new LineBasicMaterial({
      color: this.scene.wallEdgeColor,
      linewidth: 1,
    });
  }

  private laneX(lane: number): number {
    return lane * this.laneWidth - this.laneOffset;
  }

  private buildBalls(): void {
    const { ballRadius, ballY } = this.config.render;
    const ballGeo = new SphereGeometry(ballRadius, 32, 32);
    const { ballSkins } = this.scene;

    for (let i = 0; i < this.config.balls.length; i++) {
      const skin = ballSkins[i] ?? ballSkins[ballSkins.length - 1];

      const mat = new MeshStandardMaterial({
        color: skin.color,
        metalness: skin.metalness,
        roughness: skin.roughness,
      });

      const mesh = new Mesh(ballGeo, mat);
      mesh.position.set(this.laneX(this.config.balls[i].homeLane), ballY, 0);
      this.adapter.add(mesh);
      this.ballMeshes.push(mesh);

      const glow = new PointLight(skin.glowColor, skin.glowIntensity, 8);
      glow.position.set(this.laneX(this.config.balls[i].homeLane), ballY + 0.4, 0);
      this.adapter.add(glow);
      this.ballGlows.push(glow);
    }
  }

  private buildLanes(): void {
    const { laneCount } = this.config;
    const { laneWidth } = this;
    const s = this.scene;

    const groundGeo = new PlaneGeometry(laneWidth * laneCount + 2, LANE_LENGTH);
    const groundMat = new MeshStandardMaterial({
      color: s.groundColor, metalness: s.groundMetalness, roughness: s.groundRoughness,
      transparent: false,
    });
    const ground = new Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.02, -LANE_LENGTH / 2 + 10);
    this.adapter.add(ground);

    for (let i = 0; i < laneCount; i++) {
      const stripGeo = new PlaneGeometry(laneWidth * 0.92, LANE_LENGTH);
      const stripMat = new MeshStandardMaterial({
        color: s.laneStripColor, metalness: 0.6, roughness: 0.5,
        transparent: false,
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
        color: s.laneDividerColor,
        emissive: new Color(s.laneDividerEmissive),
        emissiveIntensity: s.laneDividerEmissiveIntensity,
      });
      const line = new Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.01, -LANE_LENGTH / 2 + 10);
      this.adapter.add(line);
    }

    const zoneGeo = new PlaneGeometry(laneWidth * laneCount + 1, 0.1);
    const zoneMat = new MeshStandardMaterial({
      color: s.hitZoneColor,
      emissive: new Color(s.hitZoneColor),
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.35,
    });
    const zoneLine = new Mesh(zoneGeo, zoneMat);
    zoneLine.rotation.x = -Math.PI / 2;
    zoneLine.position.set(0, 0.02, 0);
    this.adapter.add(zoneLine);

    // Horizon glow — gradient fade at the far end of lanes so the floor
    // blends smoothly into darkness rather than cutting off abruptly.
    // A canvas-based alpha gradient goes from opaque (near side) to
    // fully transparent (far side), sitting just above the floor plane.
    const glowDepth = 30;
    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = 4;   // single-column gradient; width doesn't matter
    glowCanvas.height = 64;
    const glowCtx = glowCanvas.getContext("2d");
    if (glowCtx) {
      const grad = glowCtx.createLinearGradient(0, 0, 0, 64);
      // near end (bottom of canvas → near camera): transparent
      grad.addColorStop(0, "rgba(0,0,0,0)");
      // far end (top of canvas → far from camera): fully opaque dark
      grad.addColorStop(1, "rgba(0,0,0,1)");
      glowCtx.fillStyle = grad;
      glowCtx.fillRect(0, 0, 4, 64);
    }
    const glowTex = new CanvasTexture(glowCanvas);
    const glowGeo = new PlaneGeometry(laneWidth * laneCount + 6, glowDepth);
    const glowMat = new MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      depthWrite: false,
    });
    const glow = new Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    // Place so the near edge aligns with the far end of the visible lane area
    // and the gradient sweeps forward toward the player for a smooth horizon.
    glow.position.set(0, 0.03, -LANE_LENGTH / 2 + 10 - glowDepth / 2);
    this.adapter.add(glow);
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

  applyTheme(theme: ThemeConfig): void {
    const s = theme.scene;

    // Wall material
    this.wallMaterial.color.set(s.wallColor);
    this.wallMaterial.metalness = s.wallMetalness;
    this.wallMaterial.roughness = s.wallRoughness;
    this.wallEdgesMaterial.color.set(s.wallEdgeColor);

    // Wall texture
    if (s.wallTextureUrl) {
      new TextureLoader().load(s.wallTextureUrl, (tex) => {
        tex.colorSpace = SRGBColorSpace;
        this.wallMaterial.map = tex;
        this.wallMaterial.needsUpdate = true;
      });
    } else if (this.wallMaterial.map) {
      this.wallMaterial.map.dispose();
      this.wallMaterial.map = null;
      this.wallMaterial.needsUpdate = true;
    }

    // Shard
    this.shardMaterial.color.set(s.shardColor);

    // Scene background + fog
    this.adapter.applySceneTheme(s);

    // Force a render
    this.adapter.render();
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

  explodeBall(ballIndex: number): void {
    const ball = this.ballMeshes[ballIndex];
    if (!ball) return;

    // Clear any in-progress death animation before starting a new one,
    // otherwise the old rAF loop keeps running and orphaned shards accumulate.
    this.clearShards();

    const origin = ball.position.clone();
    ball.visible = false;
    this.ballGlows[ballIndex].visible = false;

    for (let i = 0; i < SHARD_COUNT; i++) {
      const mesh = new Mesh(this.shardGeometry, this.shardMaterial.clone());
      mesh.position.copy(origin);

      const scale = 0.5 + Math.random() * 1.5;
      mesh.scale.setScalar(scale);
      mesh.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
      );

      const speed = 3 + Math.random() * 6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const velocity = new Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.abs(Math.sin(phi) * Math.sin(theta)) * speed * 0.8 + 1,
        Math.cos(phi) * speed * 0.5,
      );

      this.adapter.add(mesh);
      this.shards.push({ mesh, velocity, life: SHARD_LIFETIME });
    }

    let lastTime = performance.now();
    const animate = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      let alive = false;
      for (const shard of this.shards) {
        if (shard.life <= 0) continue;
        alive = true;

        shard.life -= dt;
        shard.velocity.y -= 12 * dt;
        shard.mesh.position.addScaledVector(shard.velocity, dt);
        shard.mesh.rotation.x += dt * 5;
        shard.mesh.rotation.z += dt * 3;

        const t = Math.max(0, shard.life / SHARD_LIFETIME);
        (shard.mesh.material as MeshBasicMaterial).opacity = t * 0.8;
        shard.mesh.scale.setScalar(shard.mesh.scale.x * (0.98 + 0.02 * t));
      }

      this.adapter.render();

      if (alive) {
        this.deathAnimId = requestAnimationFrame(animate);
      } else {
        this.clearShards();
      }
    };

    this.deathAnimId = requestAnimationFrame(animate);
  }

  clearShards(): void {
    cancelAnimationFrame(this.deathAnimId);
    for (const shard of this.shards) {
      this.adapter.remove(shard.mesh);
      (shard.mesh.material as MeshBasicMaterial).dispose();
    }
    this.shards.length = 0;
  }

  clearWalls(): void {
    for (const [, group] of this.activeWallMeshes) {
      this.recycleWallGroup(group);
    }
    this.activeWallMeshes.clear();
  }

  dispose(): void {
    this.clearShards();
    this.shardGeometry.dispose();
    this.shardMaterial.dispose();
    this.wallGeometry.dispose();
    this.wallEdgesGeometry.dispose();
    this.wallMaterial.dispose();
    this.wallEdgesMaterial.dispose();
    this.adapter.dispose();
  }
}
