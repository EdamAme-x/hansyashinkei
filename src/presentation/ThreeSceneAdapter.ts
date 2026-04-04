import {
  Scene, PerspectiveCamera, WebGLRenderer, Fog, Color,
  TextureLoader, NoToneMapping, SRGBColorSpace,
  Mesh, PlaneGeometry, ShaderMaterial,
  type Object3D,
  type Texture,
} from "three";
import type { SceneTheme } from "@domain/entities/ThemeConfig";

// ---------------------------------------------------------------------------
// Vertex shader — just pass through NDC position and UV
// ---------------------------------------------------------------------------
const BG_VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

// ---------------------------------------------------------------------------
// "Cover" fragment shader — scales/crops the image to fill the viewport.
// Applied with very low opacity to create a blurred-looking dim backdrop.
// (No actual GPU blur — the darkening + scale-up gives a similar feel.)
// ---------------------------------------------------------------------------
const COVER_FRAG = /* glsl */`
uniform sampler2D uTex;
uniform float uImgAspect;   // image w/h
uniform float uViewAspect;  // viewport w/h
uniform float uBrightness;  // 0-1
varying vec2 vUv;
void main() {
  // Scale UV so image covers the quad (CSS object-fit:cover)
  vec2 uv = vUv;
  float imgA = uImgAspect;
  float viewA = uViewAspect;
  if (imgA > viewA) {
    // image is wider than viewport — crop sides
    float scale = viewA / imgA;
    uv.x = (uv.x - 0.5) * scale + 0.5;
  } else {
    // image is taller than viewport — crop top/bottom
    float scale = imgA / viewA;
    uv.y = (uv.y - 0.5) * scale + 0.5;
  }
  vec4 col = texture2D(uTex, uv);
  gl_FragColor = vec4(col.rgb * uBrightness, 1.0);
}
`;

// ---------------------------------------------------------------------------
// "Contain" fragment shader — letterboxes the image (CSS object-fit:contain).
// Outside the image area we emit transparent black so the cover layer shows.
// ---------------------------------------------------------------------------
const CONTAIN_FRAG = /* glsl */`
uniform sampler2D uTex;
uniform float uImgAspect;   // image w/h
uniform float uViewAspect;  // viewport w/h
uniform float uBrightness;  // 0-1
varying vec2 vUv;
void main() {
  vec2 uv = vUv;
  float imgA = uImgAspect;
  float viewA = uViewAspect;
  if (imgA > viewA) {
    // image wider than viewport — pillarbox: shrink vertically
    float scale = imgA / viewA;
    uv.y = (uv.y - 0.5) * scale + 0.5;
  } else {
    // image taller — letterbox: shrink horizontally
    float scale = viewA / imgA;
    uv.x = (uv.x - 0.5) * scale + 0.5;
  }
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    discard;
  }
  vec4 col = texture2D(uTex, uv);
  gl_FragColor = vec4(col.rgb * uBrightness, col.a);
}
`;

// ---------------------------------------------------------------------------
// Helper — build one fullscreen quad plane
// ---------------------------------------------------------------------------
function makeBgPlane(frag: string, texture: Texture, imgAspect: number, viewAspect: number, brightness: number): Mesh {
  const geo = new PlaneGeometry(2, 2);
  const mat = new ShaderMaterial({
    vertexShader: BG_VERT,
    fragmentShader: frag,
    uniforms: {
      uTex: { value: texture },
      uImgAspect: { value: imgAspect },
      uViewAspect: { value: viewAspect },
      uBrightness: { value: brightness },
    },
    depthTest: false,
    depthWrite: false,
    fog: false,
    transparent: frag === CONTAIN_FRAG,
  });
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
}

export class ThreeSceneAdapter {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;

  private bgTexture: Texture | null = null;
  private bgCoverPlane: Mesh | null = null;
  private bgContainPlane: Mesh | null = null;

  constructor(container: HTMLElement, sceneTheme: SceneTheme) {
    this.scene = new Scene();
    this.scene.background = new Color(sceneTheme.fogColor);
    this.scene.fog = new Fog(sceneTheme.fogColor, sceneTheme.fogNear, sceneTheme.fogFar);

    this.camera = new PerspectiveCamera(
      70,
      container.clientWidth / container.clientHeight,
      0.1,
      300,
    );
    this.camera.position.set(0, 12, 14);
    this.camera.lookAt(0, 0, -40);

    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = NoToneMapping;
    container.appendChild(this.renderer.domElement);

    this.applySceneTheme(sceneTheme);
  }

  add(obj: Object3D): void {
    this.scene.add(obj);
  }

  remove(obj: Object3D): void {
    this.scene.remove(obj);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this._updateBgAspect(width / height);
  }

  applySceneTheme(sceneTheme: SceneTheme): void {
    this._removeBgPlanes();

    if (this.bgTexture) {
      this.bgTexture.dispose();
      this.bgTexture = null;
    }

    if (sceneTheme.background.type === "texture") {
      const url = (sceneTheme.background as { url: string }).url;
      // Keep the scene background as solid color; the planes handle the image
      this.scene.background = new Color(sceneTheme.fogColor);

      new TextureLoader().load(url, (rawTex) => {
        rawTex.colorSpace = SRGBColorSpace;
        this.bgTexture = rawTex;

        const img = rawTex.image as HTMLImageElement;
        const imgW = img.naturalWidth || img.width;
        const imgH = img.naturalHeight || img.height;
        const imgAspect = imgW / imgH;
        const viewAspect = this.camera.aspect;

        // Back plane: cover (fills viewport, crops) — very dim
        this.bgCoverPlane = makeBgPlane(COVER_FRAG, rawTex, imgAspect, viewAspect, 0.15);
        this.bgCoverPlane.renderOrder = -1001;
        this.scene.add(this.bgCoverPlane);

        // Front plane: contain (letterboxed, correct ratio) — dimmed but readable
        this.bgContainPlane = makeBgPlane(CONTAIN_FRAG, rawTex, imgAspect, viewAspect, 0.55);
        this.bgContainPlane.renderOrder = -1000;
        this.scene.add(this.bgContainPlane);
      });
    } else {
      this.scene.background = new Color(sceneTheme.background.hex);
    }

    if (this.scene.fog) {
      const fog = this.scene.fog as Fog;
      fog.color.set(sceneTheme.fogColor);
      fog.near = sceneTheme.fogNear;
      fog.far = sceneTheme.fogFar;
    }
  }

  // Update both planes' uViewAspect when the viewport is resized
  private _updateBgAspect(viewAspect: number): void {
    for (const plane of [this.bgCoverPlane, this.bgContainPlane]) {
      if (!plane) continue;
      const mat = plane.material as ShaderMaterial;
      mat.uniforms["uViewAspect"].value = viewAspect;
    }
  }

  private _removeBgPlanes(): void {
    if (this.bgCoverPlane) {
      this.scene.remove(this.bgCoverPlane);
      (this.bgCoverPlane.material as ShaderMaterial).dispose();
      this.bgCoverPlane.geometry.dispose();
      this.bgCoverPlane = null;
    }
    if (this.bgContainPlane) {
      this.scene.remove(this.bgContainPlane);
      (this.bgContainPlane.material as ShaderMaterial).dispose();
      this.bgContainPlane.geometry.dispose();
      this.bgContainPlane = null;
    }
  }

  dispose(): void {
    this._removeBgPlanes();
    if (this.bgTexture) this.bgTexture.dispose();
    this.renderer.dispose();
  }
}
