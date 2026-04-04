import {
  Scene, PerspectiveCamera, WebGLRenderer, Fog, Color,
  TextureLoader, NoToneMapping, SRGBColorSpace,
  CanvasTexture,
  type Object3D,
  type Texture,
} from "three";
import type { SceneTheme } from "@domain/entities/ThemeConfig";

/** Darken a texture by drawing it onto a canvas with reduced opacity over black. */
function darkenTexture(source: Texture, brightness: number): CanvasTexture {
  const img = source.image as HTMLImageElement;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = brightness;
    ctx.drawImage(img, 0, 0, w, h);
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export class ThreeSceneAdapter {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;
  private bgTexture: Texture | null = null;

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
  }

  applySceneTheme(sceneTheme: SceneTheme): void {
    if (this.bgTexture) {
      this.bgTexture.dispose();
      this.bgTexture = null;
    }

    if (sceneTheme.background.type === "texture") {
      const url = (sceneTheme.background as { url: string }).url;
      this.scene.background = new Color(sceneTheme.fogColor);

      new TextureLoader().load(url, (rawTex) => {
        rawTex.colorSpace = SRGBColorSpace;
        // Darken to ~40% brightness so text/UI stays readable
        const darkTex = darkenTexture(rawTex, 0.6);
        rawTex.dispose();

        if (this.bgTexture) this.bgTexture.dispose();
        this.bgTexture = darkTex;
        this.scene.background = darkTex;
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

  dispose(): void {
    if (this.bgTexture) this.bgTexture.dispose();
    this.renderer.dispose();
  }
}
