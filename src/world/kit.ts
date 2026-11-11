import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Kenney 브릭 키트 모델 한 개 = 지오메트리 하나(부품 합침, 모델 기준) + 원래 머티리얼 */
export interface KitModel {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
}

export type BrickName = 'brick-2x4' | 'brick-2x2' | 'brick-1x2' | 'slope-2x4' | 'plate-4x8' | 'round-1x1';

const FILES: Record<BrickName, string> = {
  'brick-2x4': 'bevel-lq-brick-2x4',
  'brick-2x2': 'bevel-lq-brick-2x2',
  'brick-1x2': 'bevel-lq-brick-1x2',
  'slope-2x4': 'bevel-lq-brick-slope-2x4',
  'plate-4x8': 'bevel-lq-plate-4x8',
  'round-1x1': 'bevel-lq-brick-1x1-round',
};

/** 키트 원본 크기 → 광장 크기 (스터드 0.079 → 약 1.2m) */
export const BRICK_SCALE = 15;

export async function loadBricks(): Promise<Record<BrickName, KitModel>> {
  const loader = new GLTFLoader();
  const base = `${import.meta.env.BASE_URL}assets/kits/brick/`;
  const entries = await Promise.all((Object.keys(FILES) as BrickName[]).map(async (name) => {
    const gltf = await loader.loadAsync(`${base}${FILES[name]}.glb`);
    gltf.scene.updateMatrixWorld(true);
    const geos: THREE.BufferGeometry[] = [];
    let material: THREE.MeshStandardMaterial | null = null;
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const g = mesh.geometry.clone();
      g.applyMatrix4(mesh.matrixWorld);
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
      geos.push(g);
      material ??= mesh.material as THREE.MeshStandardMaterial;
    });
    const geometry = mergeGeometries(geos)!;
    for (const g of geos) g.dispose();
    return [name, { geometry, material: material! }] as const;
  }));
  return Object.fromEntries(entries) as Record<BrickName, KitModel>;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _e = new THREE.Euler();
const _c = new THREE.Color();

/** 같은 모델을 여러 곳에 색만 바꿔 놓기 → InstancedMesh 하나 (그리기 호출 1회) */
export class BrickBatch {
  private readonly items = new Map<BrickName, { m: THREE.Matrix4; c: THREE.Color }[]>();

  add(name: BrickName, x: number, y: number, z: number, color: THREE.ColorRepresentation, rotY = 0, scale = BRICK_SCALE): void {
    _p.set(x, y, z);
    _q.setFromEuler(_e.set(0, rotY, 0));
    _s.setScalar(scale);
    const list = this.items.get(name) ?? [];
    list.push({ m: new THREE.Matrix4().compose(_p, _q, _s), c: new THREE.Color(color) });
    this.items.set(name, list);
  }

  /** 모델별 InstancedMesh. 지오메트리·머티리얼은 키트와 공유(여기서 dispose 금지) */
  build(kit: Record<BrickName, KitModel>): THREE.Group {
    const g = new THREE.Group();
    for (const [name, list] of this.items) {
      const k = kit[name];
      const mesh = new THREE.InstancedMesh(k.geometry, k.material, list.length);
      list.forEach((it, i) => {
        mesh.setMatrixAt(i, _m.copy(it.m));
        mesh.setColorAt(i, _c.copy(it.c));
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
    }
    return g;
  }
}
