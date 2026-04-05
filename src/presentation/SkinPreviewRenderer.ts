import {
  Scene, PerspectiveCamera, WebGLRenderer,
  Mesh, SphereGeometry, BoxGeometry, OctahedronGeometry,
  MeshStandardMaterial, AmbientLight, DirectionalLight, PointLight,
  Color, NoToneMapping,
} from "three";
import type { AchievementSkin } from "@domain/entities/Achievement";

const SIZE = 96;
const cache = new Map<string, string>();

let sharedRenderer: WebGLRenderer | null = null;

function getRenderer(): WebGLRenderer {
  if (!sharedRenderer) {
    sharedRenderer = new WebGLRenderer({ antialias: true, alpha: true });
    sharedRenderer.setSize(SIZE, SIZE);
    sharedRenderer.setPixelRatio(2);
    sharedRenderer.toneMapping = NoToneMapping;
  }
  return sharedRenderer;
}

export function renderSkinPreview(skin: AchievementSkin): string {
  const cached = cache.get(skin.id);
  if (cached) return cached;

  const renderer = getRenderer();
  const scene = new Scene();

  const camera = new PerspectiveCamera(40, 1, 0.1, 10);
  camera.position.set(0, 0.3, 2.8);
  camera.lookAt(0, 0, 0);

  // Lighting — key, fill, rim, back for gem-like reflections
  const ambient = new AmbientLight(0xffffff, 0.25);
  scene.add(ambient);

  const key = new DirectionalLight(0xffffff, 1.4);
  key.position.set(1.5, 2.5, 3);
  scene.add(key);

  const fill = new DirectionalLight(0x6688cc, 0.5);
  fill.position.set(-3, 0.5, 1);
  scene.add(fill);

  const rim = new DirectionalLight(0xffffff, 0.8);
  rim.position.set(0.5, -1, -3);
  scene.add(rim);

  const top = new DirectionalLight(0xffffff, 0.3);
  top.position.set(0, 4, 0);
  scene.add(top);

  // Glow point light matching skin color
  if (skin.glowIntensity > 0) {
    const glow = new PointLight(skin.glowColor, skin.glowIntensity * 0.5, 6);
    glow.position.set(0.5, 0.5, 1.5);
    scene.add(glow);
  }

  // Geometry based on shape
  const radius = 0.8;
  const geo =
    skin.shape === "cube" ? new BoxGeometry(radius * 1.4, radius * 1.4, radius * 1.4) :
    skin.shape === "spiky" ? new OctahedronGeometry(radius * 1.1, 1) :
    new SphereGeometry(radius, 48, 48);

  const mat = new MeshStandardMaterial({
    color: skin.color,
    metalness: Math.min(skin.metalness + 0.15, 1), // boost for preview
    roughness: Math.max(skin.roughness - 0.05, 0),  // smoother for preview
    emissive: new Color(skin.emissiveColor),
    emissiveIntensity: skin.emissiveIntensity,
    envMapIntensity: 1.5,
  });

  // Handle invisible skin — fully transparent, just a faint outline
  if (skin.id === "skin_invisible") {
    mat.transparent = true;
    mat.opacity = 0;
  }

  const mesh = new Mesh(geo, mat);
  // Slight tilt for visual interest
  mesh.rotation.set(0.15, -0.4, 0.1);
  scene.add(mesh);

  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL("image/png");

  // Cleanup
  geo.dispose();
  mat.dispose();

  cache.set(skin.id, dataUrl);
  return dataUrl;
}

export function renderLockedPreview(): string {
  const key = "__locked__";
  const cached = cache.get(key);
  if (cached) return cached;

  const renderer = getRenderer();
  const scene = new Scene();

  const camera = new PerspectiveCamera(40, 1, 0.1, 10);
  camera.position.set(0, 0.3, 2.8);
  camera.lookAt(0, 0, 0);

  const ambient = new AmbientLight(0xffffff, 0.15);
  scene.add(ambient);

  const dir = new DirectionalLight(0xffffff, 0.3);
  dir.position.set(2, 3, 2);
  scene.add(dir);

  const geo = new SphereGeometry(0.8, 32, 32);
  const mat = new MeshStandardMaterial({
    color: 0x1a1a1a,
    metalness: 0.5,
    roughness: 0.6,
  });
  const mesh = new Mesh(geo, mat);
  mesh.rotation.set(0.15, -0.4, 0.1);
  scene.add(mesh);

  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL("image/png");

  geo.dispose();
  mat.dispose();

  cache.set(key, dataUrl);
  return dataUrl;
}
