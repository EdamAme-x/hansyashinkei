import {
  Scene, PerspectiveCamera, WebGLRenderer, Fog, Color,
  NoToneMapping,
  type Object3D,
} from "three";
import type { SceneTheme } from "@domain/entities/ThemeConfig";

export class ThreeSceneAdapter {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;

  constructor(container: HTMLElement, sceneTheme: SceneTheme) {
    this.scene = new Scene();
    this.scene.background = new Color(sceneTheme.fogColor);
    this.scene.fog = new Fog(sceneTheme.fogColor, sceneTheme.fogNear, sceneTheme.fogFar);

    // Background image → CSS layer (not Three.js texture)
    this.applyBackgroundImage(sceneTheme);

    this.camera = new PerspectiveCamera(
      70,
      container.clientWidth / container.clientHeight,
      0.1,
      300,
    );
    this.camera.position.set(0, 12, 14);
    this.camera.lookAt(0, 0, -40);

    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = NoToneMapping;
    container.appendChild(this.renderer.domElement);
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
    this.scene.background = new Color(sceneTheme.fogColor);
    if (this.scene.fog) {
      const fog = this.scene.fog as Fog;
      fog.color.set(sceneTheme.fogColor);
      fog.near = sceneTheme.fogNear;
      fog.far = sceneTheme.fogFar;
    }
    this.applyBackgroundImage(sceneTheme);
  }

  private applyBackgroundImage(sceneTheme: SceneTheme): void {
    const bgBlur = document.getElementById("bg-blur");
    const bgImage = document.getElementById("bg-image");
    if (!bgBlur || !bgImage) return;

    if (sceneTheme.background.type === "texture") {
      const url = sceneTheme.background.url;
      bgBlur.style.backgroundImage = `url(${url})`;
      bgImage.style.backgroundImage = `url(${url})`;
      bgBlur.style.display = "";
      bgImage.style.display = "";
    } else {
      bgBlur.style.backgroundImage = "";
      bgImage.style.backgroundImage = "";
      bgBlur.style.display = "none";
      bgImage.style.display = "none";
    }
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
