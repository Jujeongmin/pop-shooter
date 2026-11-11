import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CHARACTERS } from '../config/characters';
import { WEAPONS } from '../config/weapons';
import type { GunModel } from '../sim/guns.ts';
import { CHAR_IDS, type CharId } from '../sim/state.ts';

export interface LoadedModel {
  /** 원본 장면 (공유: 복제해서 쓰고 dispose하지 않음) */
  scene: THREE.Object3D;
  clips: THREE.AnimationClip[];
}

export interface Assets {
  characters: Record<CharId, LoadedModel>;
  guns: Record<GunModel, THREE.Object3D>;
}

const GUN_MODELS: readonly GunModel[] = ['pistol', 'rifle', 'shotgun', 'sniper'];

async function loadGlb(loader: GLTFLoader, url: string, label: string, onBytes: (loaded: number) => void): Promise<GLTF> {
  try {
    return await loader.loadAsync(url, (e) => onBytes(e.loaded));
  } catch (err) {
    throw new Error(`${label} GLB 로드 실패 (${url}): ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** 캐릭터 6종 + 총 4종 GLB. onProgress = 0..1 (파일 수 기준 + 받은 바이트 근사) */
export async function loadAssets(renderer: THREE.WebGLRenderer, onProgress?: (p: number) => void): Promise<Assets> {
  const loader = new GLTFLoader();
  const jobs: { url: string; label: string }[] = [
    ...CHAR_IDS.map((id) => ({ url: CHARACTERS[id].file, label: `캐릭터 ${CHARACTERS[id].name}` })),
    ...GUN_MODELS.map((m) => ({ url: WEAPONS[m]!.model.glb!, label: WEAPONS[m]!.name })),
  ];
  const progress = new Array<number>(jobs.length).fill(0);
  const report = (): void => onProgress?.(progress.reduce((a, b) => a + b, 0) / jobs.length);
  const gltfs = await Promise.all(jobs.map((j, i) => loadGlb(loader, j.url, j.label, (b) => {
    progress[i] = Math.min(0.95, b / 3_000_000);
    report();
  }).then((g) => { progress[i] = 1; report(); return g; })));
  const aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  for (const g of gltfs) {
    g.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.anisotropy = aniso;
      }
    });
  }
  const characters = {} as Record<CharId, LoadedModel>;
  CHAR_IDS.forEach((id, i) => {
    const g = gltfs[i]!;
    if (!g.scene.getObjectByProperty('type', 'SkinnedMesh')) throw new Error(`${jobs[i]!.label}: SkinnedMesh 없음`);
    characters[id] = { scene: g.scene, clips: g.animations };
  });
  const guns = {} as Record<GunModel, THREE.Object3D>;
  GUN_MODELS.forEach((m, i) => { guns[m] = gltfs[CHAR_IDS.length + i]!.scene; });
  return { characters, guns };
}
