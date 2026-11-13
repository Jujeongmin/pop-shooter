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
  /** 받은 캐릭터만 (나머지는 char()로 받음) */
  characters: Partial<Record<CharId, LoadedModel>>;
  guns: Record<GunModel, THREE.Object3D>;
  /** 캐릭터 받기 (이미 받았거나 받는 중이면 같은 약속). 받으면 characters에도 들어감 */
  char(id: CharId): Promise<LoadedModel>;
  /** 나머지 캐릭터를 하나씩 뒤에서 받기 (게임 시작 뒤) */
  loadRest(): void;
}

const GUN_MODELS: readonly GunModel[] = ['pistol', 'rifle', 'shotgun', 'sniper'];

async function loadGlb(loader: GLTFLoader, url: string, label: string, onBytes: (loaded: number) => void): Promise<GLTF> {
  try {
    return await loader.loadAsync(url, (e) => onBytes(e.loaded));
  } catch (err) {
    throw new Error(`${label} GLB 로드 실패 (${url}): ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * 시작할 때는 총 4종 + first 캐릭터만 받음 (2026-11-13 로딩 줄이기: 예전엔 캐릭터 6종 6.5MB를 다 받아야 시작).
 * 나머지 캐릭터는 char(id)로 필요할 때 / loadRest()로 시작 뒤 뒤에서. onProgress = 0..1 (파일 수 기준 + 받은 바이트 근사)
 */
export async function loadAssets(
  renderer: THREE.WebGLRenderer,
  first: readonly CharId[],
  onProgress?: (p: number) => void,
  /** 서버 저장을 읽으면 알게 되는 내 캐릭터: 알게 되는 즉시 같이 받기 시작 (짐작과 다를 때 총·짐작 캐릭터를 다 받은 뒤에야 받던 것) */
  mine?: Promise<CharId | null>,
): Promise<Assets> {
  const loader = new GLTFLoader();
  const aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const prep = (g: GLTF): void => {
    g.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.anisotropy = aniso;
      }
    });
  };
  const characters: Partial<Record<CharId, LoadedModel>> = {};
  const pending = new Map<CharId, Promise<LoadedModel>>();
  const charJob = (id: CharId, onBytes: (b: number) => void = () => undefined): Promise<LoadedModel> => {
    let p = pending.get(id);
    if (p) return p;
    const label = `캐릭터 ${CHARACTERS[id].name}`;
    p = loadGlb(loader, CHARACTERS[id].file, label, onBytes).then((g) => {
      if (!g.scene.getObjectByProperty('type', 'SkinnedMesh')) throw new Error(`${label}: SkinnedMesh 없음`);
      prep(g);
      const m = { scene: g.scene, clips: g.animations };
      characters[id] = m;
      return m;
    });
    // 실패하면 다음에 다시 받게
    p.catch(() => pending.delete(id));
    pending.set(id, p);
    return p;
  };

  void mine?.then((id) => { if (id) charJob(id).catch(() => undefined); }).catch(() => undefined);
  const firstIds = [...new Set(first)];
  const n = firstIds.length + GUN_MODELS.length;
  const progress = new Array<number>(n).fill(0);
  const report = (): void => onProgress?.(progress.reduce((a, b) => a + b, 0) / n);
  const track = <T>(i: number, p: (onBytes: (b: number) => void) => Promise<T>): Promise<T> =>
    p((b) => { progress[i] = Math.min(0.95, b / 1_200_000); report(); }).then((v) => { progress[i] = 1; report(); return v; });
  const [, gunGltfs] = await Promise.all([
    Promise.all(firstIds.map((id, i) => track(i, (on) => charJob(id, on)))),
    Promise.all(GUN_MODELS.map((m, i) => track(firstIds.length + i, (on) => loadGlb(loader, WEAPONS[m]!.model.glb!, WEAPONS[m]!.name, on)))),
  ]);
  const guns = {} as Record<GunModel, THREE.Object3D>;
  GUN_MODELS.forEach((m, i) => { prep(gunGltfs[i]!); guns[m] = gunGltfs[i]!.scene; });

  let resting = false;
  return {
    characters,
    guns,
    char: (id) => charJob(id),
    loadRest(): void {
      if (resting) return;
      resting = true;
      // 하나씩 (게임 중 대역폭·디코드를 한꺼번에 쓰지 않게)
      void (async () => {
        for (const id of CHAR_IDS) {
          try { await charJob(id); } catch { /* 필요할 때 다시 받음 */ }
        }
      })();
    },
  };
}
