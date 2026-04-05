import {
  Scene, PerspectiveCamera, WebGLRenderer, Fog, Color,
  TextureLoader, NoToneMapping, SRGBColorSpace,
  CanvasTexture,
  type Object3D,
  type Texture,
} from "three";
import type { SceneTheme } from "@domain/entities/ThemeConfig";

/**
 * Draw YouTube-style letterbox background onto a canvas:
 * - Fill entire canvas with blurred/dimmed cover version
 * - Draw contained (aspect-preserved) image on top, slightly brighter
 */
function createLetterboxCanvas(
  img: HTMLImageElement,
  viewW: number,
  viewH: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = viewW;
  canvas.height = viewH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;
  const imgAspect = imgW / imgH;
  const viewAspect = viewW / viewH;

  // Compute contain rect
  let dx: number, dy: number, dw: number, dh: number;
  if (imgAspect > viewAspect) {
    dw = viewW;
    dh = viewW / imgAspect;
    dx = 0;
    dy = (viewH - dh) / 2;
  } else {
    dh = viewH;
    dw = viewH * imgAspect;
    dx = (viewW - dw) / 2;
    dy = 0;
  }

  // 1. Draw edge-glow: stretch the image edge pixels to fill the whole canvas,
  //    heavily blurred and dimmed, so letterbox bars get a colored glow.
  //    We draw the image scaled to cover, then blur + darken.
  ctx.save();
  ctx.filter = "blur(40px) brightness(0.2)";
  // Cover: fill entire canvas by cropping
  if (imgAspect > viewAspect) {
    const coverW = viewH * imgAspect;
    ctx.drawImage(img, (viewW - coverW) / 2, 0, coverW, viewH);
  } else {
    const coverH = viewW / imgAspect;
    ctx.drawImage(img, 0, (viewH - coverH) / 2, viewW, coverH);
  }
  ctx.restore();

  // 2. Draw the main image (contain, correct aspect ratio), dimmed
  ctx.globalAlpha = 0.5;
  ctx.drawImage(img, dx, dy, dw, dh);

  return canvas;
}

export class ThreeSceneAdapter {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;
  private bgTexture: Texture | null = null;
  private bgSourceImg: HTMLImageElement | null = null;
  private bgLoadGeneration = 0;

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

    // Rebuild letterbox canvas for new aspect ratio
    if (this.bgSourceImg) {
      this.rebuildBgTexture(width, height);
    }
  }

  applySceneTheme(sceneTheme: SceneTheme): void {
    const gen = ++this.bgLoadGeneration;

    if (this.bgTexture) {
      this.bgTexture.dispose();
      this.bgTexture = null;
    }
    this.bgSourceImg = null;

    if (sceneTheme.background.type === "texture") {
      const url = (sceneTheme.background as { url: string }).url;
      this.scene.background = new Color(sceneTheme.fogColor);

      new TextureLoader().load(url, (rawTex) => {
        // Guard: ignore stale loads if theme was changed again since this load started
        if (this.bgLoadGeneration !== gen) {
          rawTex.dispose();
          return;
        }
        rawTex.colorSpace = SRGBColorSpace;
        this.bgSourceImg = rawTex.image as HTMLImageElement;

        const el = this.renderer.domElement;
        this.rebuildBgTexture(el.width, el.height);

        rawTex.dispose();

        // Force render so bg appears even on static screens
        this.render();
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

  private rebuildBgTexture(viewW: number, viewH: number): void {
    if (!this.bgSourceImg) return;

    if (this.bgTexture) this.bgTexture.dispose();

    const canvas = createLetterboxCanvas(this.bgSourceImg, viewW, viewH);
    this.bgTexture = new CanvasTexture(canvas);
    this.bgTexture.colorSpace = SRGBColorSpace;
    this.scene.background = this.bgTexture;
  }

  dispose(): void {
    if (this.bgTexture) this.bgTexture.dispose();
    this.renderer.dispose();
  }
}
