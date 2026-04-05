import {
  AmbientLight, DirectionalLight, PointLight,
  Mesh, Group, LineSegments, Object3D,
  BoxGeometry, SphereGeometry, PlaneGeometry, EdgesGeometry, OctahedronGeometry,
  MeshStandardMaterial, MeshBasicMaterial, LineBasicMaterial,
  Color, AdditiveBlending, Vector3,
  TextureLoader, SRGBColorSpace, CanvasTexture,
} from "three";
import type { BufferGeometry } from "three";
import type { GameConfig } from "@domain/entities/GameConfig";
import type { ThemeConfig, SceneTheme } from "@domain/entities/ThemeConfig";
import type { GameWorldState } from "@domain/entities/GameWorld";
import type { AchievementSkin, BallShape } from "@domain/entities/Achievement";
import { ThreeSceneAdapter } from "./ThreeSceneAdapter";

const LANE_LENGTH = 250;
const SHARD_COUNT = 24;
const SHARD_LIFETIME = 1.2;

interface Shard {
  mesh: Mesh<BoxGeometry, MeshBasicMaterial>;
  velocity: Vector3;
  life: number;
}

export class GameRenderer {
  readonly adapter: ThreeSceneAdapter;

  private config: GameConfig;
  private scene: SceneTheme;
  private laneWidth: number;
  private laneOffset: number;
  private ballMeshes: Mesh[] = [];
  private ballGlows: PointLight[] = [];
  private readonly shards: Shard[] = [];
  private readonly shardGeometry: BoxGeometry;
  private readonly shardMaterial: MeshBasicMaterial;
  private deathAnimId = 0;
  private wallMeshPool: Group[] = [];
  private activeWallMeshes = new Map<number, Group>();

  private wallGeometry: BoxGeometry;
  private wallEdgesGeometry: EdgesGeometry;
  private wallMaterial: MeshStandardMaterial;
  private wallEdgesMaterial: LineBasicMaterial;
  private wallTexGeneration = 0;

  // Track objects per category for cleanup on reconfigure
  private laneMeshes: Object3D[] = [];
  private lights: Object3D[] = [];

  // Achievement skin
  private activeSkin: AchievementSkin | null = null;

  constructor(container: HTMLElement, config: GameConfig, theme: ThemeConfig) {
    this.config = config;
    this.scene = theme.scene;
    const { laneWidth, wallHeight, wallDepth } = config.render;
    this.laneWidth = laneWidth;
    this.laneOffset = ((config.laneCount - 1) / 2) * laneWidth;
    this.adapter = new ThreeSceneAdapter(container, theme.scene);

    this.buildLights();
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
        this.wallMaterial.color.set(0xffffff);
        this.wallMaterial.metalness = 0.1;
        this.wallMaterial.roughness = 0.8;
        this.wallMaterial.needsUpdate = true;
      });
    }
    this.wallEdgesMaterial = new LineBasicMaterial({
      color: this.scene.wallEdgeColor,
      linewidth: 1,
    });
  }

  /** Switch to a different game config (e.g. classic → triple) without replacing the canvas. */
  reconfigure(config: GameConfig): void {
    this.config = config;
    this.laneWidth = config.render.laneWidth;
    this.laneOffset = ((config.laneCount - 1) / 2) * this.laneWidth;

    // Remove old lanes & balls from scene
    for (const obj of this.laneMeshes) this.adapter.remove(obj);
    this.laneMeshes = [];
    for (const m of this.ballMeshes) this.adapter.remove(m);
    for (const g of this.ballGlows) this.adapter.remove(g);
    this.ballMeshes = [];
    this.ballGlows = [];

    // Remove old walls
    this.clearWalls();
    for (const g of this.wallMeshPool) this.adapter.remove(g);
    this.wallMeshPool = [];

    // Rebuild wall geometry for new lane width
    this.wallGeometry.dispose();
    this.wallEdgesGeometry.dispose();
    const { laneWidth, wallHeight, wallDepth } = config.render;
    this.wallGeometry = new BoxGeometry(laneWidth * 0.88, wallHeight, wallDepth);
    this.wallEdgesGeometry = new EdgesGeometry(this.wallGeometry);

    // Rebuild lanes & balls
    this.buildLanes();
    this.buildBalls();

    this.adapter.render();
  }

  private laneX(lane: number): number {
    return lane * this.laneWidth - this.laneOffset;
  }

  private buildLights(): void {
    const ambient = new AmbientLight(0xffffff, 0.3);
    this.adapter.add(ambient);
    this.lights.push(ambient);

    const dirLight = new DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(3, 20, 10);
    this.adapter.add(dirLight);
    this.lights.push(dirLight);

    const rimLight = new DirectionalLight(0xffffff, 0.4);
    rimLight.position.set(-2, 8, -10);
    this.adapter.add(rimLight);
    this.lights.push(rimLight);
  }

  private buildBalls(): void {
    const { ballRadius, ballY } = this.config.render;
    const { ballSkins } = this.scene;

    for (let i = 0; i < this.config.balls.length; i++) {
      const aSkin = this.activeSkin;
      const themeSkin = ballSkins[i] ?? ballSkins[ballSkins.length - 1];

      const geo = aSkin
        ? createBallGeometry(aSkin.shape, ballRadius)
        : new SphereGeometry(ballRadius, 32, 32);

      const mat = new MeshStandardMaterial({
        color: aSkin?.color ?? themeSkin.color,
        metalness: aSkin?.metalness ?? themeSkin.metalness,
        roughness: aSkin?.roughness ?? themeSkin.roughness,
        emissive: new Color(aSkin?.emissiveColor ?? 0x000000),
        emissiveIntensity: aSkin?.emissiveIntensity ?? 0,
      });

      const mesh = new Mesh(geo, mat);
      mesh.position.set(this.laneX(this.config.balls[i].homeLane), ballY, 0);
      this.adapter.add(mesh);
      this.ballMeshes.push(mesh);

      const glow = new PointLight(
        aSkin?.glowColor ?? themeSkin.glowColor,
        aSkin?.glowIntensity ?? themeSkin.glowIntensity,
        8,
      );
      glow.position.set(this.laneX(this.config.balls[i].homeLane), ballY + 0.4, 0);
      this.adapter.add(glow);
      this.ballGlows.push(glow);
    }
  }

  private buildLanes(): void {
    const { laneCount } = this.config;
    const { laneWidth } = this;
    const s = this.scene;

    // Alpha gradient: opaque near camera, transparent at far end.
    const fadeCanvas = document.createElement("canvas");
    fadeCanvas.width = 1;
    fadeCanvas.height = 256;
    const fadeCtx = fadeCanvas.getContext("2d");
    if (fadeCtx) {
      const grad = fadeCtx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, "#000");
      grad.addColorStop(0.20, "#fff");
      grad.addColorStop(1, "#fff");
      fadeCtx.fillStyle = grad;
      fadeCtx.fillRect(0, 0, 1, 256);
    }
    const fadeTex = new CanvasTexture(fadeCanvas);

    const groundGeo = new PlaneGeometry(laneWidth * laneCount + 2, LANE_LENGTH, 1, 32);
    const groundMat = new MeshBasicMaterial({
      color: 0x0a0a0a,
      transparent: true, alphaMap: fadeTex, depthWrite: false, fog: false,
    });
    const ground = new Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.02, -LANE_LENGTH / 2 + 10);
    this.adapter.add(ground);
    this.laneMeshes.push(ground);

    for (let i = 0; i < laneCount; i++) {
      const stripGeo = new PlaneGeometry(laneWidth * 0.92, LANE_LENGTH, 1, 32);
      const stripMat = new MeshBasicMaterial({
        color: 0x0e0e0e,
        transparent: true, alphaMap: fadeTex, depthWrite: false, fog: false,
      });
      const strip = new Mesh(stripGeo, stripMat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(this.laneX(i), -0.01, -LANE_LENGTH / 2 + 10);
      this.adapter.add(strip);
      this.laneMeshes.push(strip);
    }

    for (let i = 0; i <= laneCount; i++) {
      const x = i * laneWidth - this.laneOffset - laneWidth / 2;
      const lineGeo = new PlaneGeometry(0.06, LANE_LENGTH, 1, 32);
      const lineMat = new MeshBasicMaterial({
        color: 0x222222,
        transparent: true, alphaMap: fadeTex, depthWrite: false, fog: false,
      });
      const line = new Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.01, -LANE_LENGTH / 2 + 10);
      this.adapter.add(line);
      this.laneMeshes.push(line);
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
    this.laneMeshes.push(zoneLine);
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

    // Bright bottom bar so wall is clearly visible against dark floor
    const { wallHeight, wallDepth } = this.config.render;
    const barGeo = new PlaneGeometry(this.laneWidth * 0.88, wallDepth);
    const barMat = new MeshBasicMaterial({
      color: 0xaaaaaa,
      transparent: true,
      opacity: 0.6,
    });
    const bar = new Mesh(barGeo, barMat);
    bar.rotation.x = -Math.PI / 2;
    bar.position.y = -wallHeight / 2 + 0.01;
    group.add(bar);

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
    const wallGen = ++this.wallTexGeneration;
    if (s.wallTextureUrl) {
      new TextureLoader().load(
        s.wallTextureUrl,
        (tex) => {
          if (this.wallTexGeneration !== wallGen) { tex.dispose(); return; }
          tex.colorSpace = SRGBColorSpace;
          this.wallMaterial.map = tex;
          this.wallMaterial.color.set(0xffffff);
          this.wallMaterial.metalness = 0.1;
          this.wallMaterial.roughness = 0.8;
          this.wallMaterial.needsUpdate = true;
        },
        undefined,
        (err) => { console.warn("Failed to load wall texture:", err); },
      );
    } else if (this.wallMaterial.map) {
      this.wallMaterial.map.dispose();
      this.wallMaterial.map = null;
      this.wallMaterial.color.set(s.wallColor);
      this.wallMaterial.metalness = s.wallMetalness;
      this.wallMaterial.roughness = s.wallRoughness;
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
        shard.mesh.material.opacity = t * 0.8;
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
      shard.mesh.material.dispose();
    }
    this.shards.length = 0;
  }

  clearWalls(): void {
    for (const [, group] of this.activeWallMeshes) {
      this.recycleWallGroup(group);
    }
    this.activeWallMeshes.clear();
  }

  /** Apply an achievement skin to all balls. Swaps geometry if shape differs. */
  applyActiveSkin(skin: AchievementSkin): void {
    this.activeSkin = skin;
    const { ballRadius } = this.config.render;

    for (let i = 0; i < this.ballMeshes.length; i++) {
      const mesh = this.ballMeshes[i];
      const mat = mesh.material as MeshStandardMaterial;
      mat.color.set(skin.color);
      mat.metalness = skin.metalness;
      mat.roughness = skin.roughness;
      mat.emissive.set(skin.emissiveColor);
      mat.emissiveIntensity = skin.emissiveIntensity;
      const invisible = skin.id === "skin_invisible";
      mat.transparent = invisible;
      mat.opacity = invisible ? 0 : 1;
      mat.needsUpdate = true;

      this.ballGlows[i].color.set(skin.glowColor);
      this.ballGlows[i].intensity = skin.glowIntensity;

      // Update shard color to match skin
      this.shardMaterial.color.set(invisible ? 0xffffff : skin.glowColor);

      // Swap geometry if shape changed
      const newGeo = createBallGeometry(skin.shape, ballRadius);
      if (mesh.geometry.type !== newGeo.type || shapeKey(skin.shape) !== shapeKey(currentShape(mesh))) {
        mesh.geometry.dispose();
        mesh.geometry = newGeo;
      } else {
        newGeo.dispose();
      }
    }
    this.adapter.render();
  }

  /** Pulse emissive/glow for animated skins. Call from render loop. */
  updateSkinPulse(time: number): void {
    const skin = this.activeSkin;
    if (!skin || skin.pulseSpeed === 0) return;
    const pulse = (Math.sin(time * skin.pulseSpeed) + 1) / 2;
    for (let i = 0; i < this.ballMeshes.length; i++) {
      const mat = this.ballMeshes[i].material as MeshStandardMaterial;
      mat.emissiveIntensity = skin.emissiveIntensity * (0.5 + 0.5 * pulse);
      this.ballGlows[i].intensity = skin.glowIntensity * (0.7 + 0.3 * pulse);
    }
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

function createBallGeometry(shape: BallShape, radius: number): BufferGeometry {
  switch (shape) {
    case "cube": return new BoxGeometry(radius * 1.5, radius * 1.5, radius * 1.5);
    case "spiky": return new OctahedronGeometry(radius * 1.2, 1);
    default: return new SphereGeometry(radius, 32, 32);
  }
}

function shapeKey(shape: BallShape): string { return shape; }

function currentShape(mesh: Mesh): BallShape {
  if (mesh.geometry instanceof BoxGeometry) return "cube";
  if (mesh.geometry instanceof OctahedronGeometry) return "spiky";
  return "sphere";
}
