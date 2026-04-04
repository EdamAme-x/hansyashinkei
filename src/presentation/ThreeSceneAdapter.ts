import {
  Scene, PerspectiveCamera, WebGLRenderer, Fog, Color,
  NoToneMapping,
  type Object3D,
} from "three";

export class ThreeSceneAdapter {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;

  constructor(container: HTMLElement) {
    this.scene = new Scene();
    this.scene.background = new Color(0x000000);
    this.scene.fog = new Fog(0x000000, 15, 85);

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

  dispose(): void {
    this.renderer.dispose();
  }
}
