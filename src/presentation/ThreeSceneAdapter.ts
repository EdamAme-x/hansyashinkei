import {
  Scene, PerspectiveCamera, WebGLRenderer, Fog, Color,
  TextureLoader, NoToneMapping,
  type Object3D,
  type Texture,
} from "three";
import type { SceneTheme } from "@domain/entities/ThemeConfig";

export class ThreeSceneAdapter {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;

  constructor(container: HTMLElement, sceneTheme: SceneTheme) {
    this.scene = new Scene();

    if (sceneTheme.background.type === "color") {
      this.scene.background = new Color(sceneTheme.background.hex);
    } else {
      this.scene.background = new Color(sceneTheme.fogColor);
      new TextureLoader().load(sceneTheme.background.url, (tex) => {
        this.scene.background = tex;
      });
    }

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
    // Dispose the previous background texture to prevent GPU memory leaks.
    if (this.scene.background && (this.scene.background as Texture).isTexture) {
      (this.scene.background as Texture).dispose();
    }

    if (sceneTheme.background.type === "color") {
      this.scene.background = new Color(sceneTheme.background.hex);
    } else {
      new TextureLoader().load(sceneTheme.background.url, (tex) => {
        // Dispose any texture that was set between the load call and the callback.
        if (this.scene.background && (this.scene.background as Texture).isTexture) {
          (this.scene.background as Texture).dispose();
        }
        this.scene.background = tex;
      });
    }
    if (this.scene.fog) {
      const fog = this.scene.fog as Fog;
      fog.color.set(sceneTheme.fogColor);
      fog.near = sceneTheme.fogNear;
      fog.far = sceneTheme.fogFar;
    }
  }

  dispose(): void {
    if (this.scene.background && (this.scene.background as Texture).isTexture) {
      (this.scene.background as Texture).dispose();
    }
    this.renderer.dispose();
  }
}
