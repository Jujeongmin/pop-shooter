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

/** 총 모델을 나중에 받아도 되는 쪽(진열대)이 쓰는 창구 */
export interface GunSource {
  /** 그 총을 이미 받았으면 바로, 아니면 받은 뒤 cb (원본을 넘김: 복제해서 쓸 것) */
  whenGun(m: GunModel, cb: (model: THREE.Object3D) => void): void;
  /** 가벼운 총 (있으면 진열에 씀) */
  gunsLow?: Partial<Record<GunModel, THREE.Object3D>>;
}

export interface Assets extends GunSource {
  /** 받은 캐릭터만 (나머지는 char()로 받음) */
  characters: Partial<Record<CharId, LoadedModel>>;
  /** 받은 총만 (나머지는 gun()으로 받음) */
  guns: Partial<Record<GunModel, THREE.Object3D>>;
  /** 캐릭터 받기 (이미 받았거나 받는 중이면 같은 약속). 받으면 characters에도 들어감 */
  char(id: CharId): Promise<LoadedModel>;
  /** 총 받기 (같은 방식). 받으면 guns에도 들어감 */
  gun(m: GunModel): Promise<THREE.Object3D>;
  /** 총 4종을 다 받으면 */
  allGuns(): Promise<void>;
  /** 나머지 총·캐릭터를 하나씩 뒤에서 받기 (게임 시작 뒤) */
  loadRest(): void;
  /** 받은 캐릭터 LOD 형상 (멀리 있을 때 쓰는 가벼운 몸, 뼈 번호는 원본 뼈대 순서로 맞춤). 아직이면 undefined */
  lods: Partial<Record<CharId, THREE.BufferGeometry>>;
  /** 받은 가벼운 총 (약 600 삼각형, 멀리 있는 사람·벽 진열용). 아직이면 undefined */
  gunsLow: Partial<Record<GunModel, THREE.Object3D>>;
}

/** 가벼운 총 파일: 게임용 총 파일 이름의 _lod1w를 _lod2w로 (optimize_glb.py --tris 600 → webp_glb.mjs) */
function gunLowUrl(m: GunModel): string {
  return WEAPONS[m]!.model.glb!.replace(/_lod\w+\.glb$/, '_lod2w.glb');
}

/** 캐릭터 LOD 파일: 게임용 캐릭터 파일 이름의 _t1kq를 _lod로 (tools/blender/char_lod.py → tools/store/quant_glb.mjs) */
function lodUrl(id: CharId): string {
  return CHARACTERS[id].file.replace(/_t1kq\.glb$/, '_lod.glb');
}

function bodyMesh(root: THREE.Object3D): THREE.SkinnedMesh | null {
  let best: THREE.SkinnedMesh | null = null;
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (m.isSkinnedMesh && (!best || m.geometry.attributes.position!.count > best.geometry.attributes.position!.count)) best = m;
  });
  return best;
}

export const GUN_MODELS: readonly GunModel[] = ['pistol', 'rifle', 'shotgun', 'sniper'];

async function loadGlb(loader: GLTFLoader, url: string, label: string, onBytes: (loaded: number) => void): Promise<GLTF> {
  try {
    return await loader.loadAsync(url, (e) => onBytes(e.loaded));
  } catch (err) {
    throw new Error(`${label} GLB 로드 실패 (${url}): ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * 시작할 때는 first의 캐릭터·총만 받음 (2026-11-13 첫 방문 로딩: Verse8 배포 서버가 느려(초당 약 100KB) 받는 양이 곧 로딩 시간.
 * 예전엔 캐릭터 6종 + 총 4종 약 8MB를 다 받아야 시작). 나머지는 char(id)·gun(m)으로 필요할 때 / loadRest()로 시작 뒤 뒤에서.
 * mine = 서버 저장을 읽으면 알게 되는 내 캐릭터·총: 알게 되는 즉시 같이 받기 시작. onProgress = 0..1
 */
export async function loadAssets(
  renderer: THREE.WebGLRenderer,
  first: { chars: readonly CharId[]; guns: readonly GunModel[] },
  onProgress?: (p: number) => void,
  mine?: Promise<{ char: CharId; gun: GunModel } | null>,
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
  const charPending = new Map<CharId, Promise<LoadedModel>>();
  const charJob = (id: CharId, onBytes: (b: number) => void = () => undefined): Promise<LoadedModel> => {
    let p = charPending.get(id);
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
    p.catch(() => charPending.delete(id));
    charPending.set(id, p);
    return p;
  };
  const guns: Partial<Record<GunModel, THREE.Object3D>> = {};
  const gunPending = new Map<GunModel, Promise<THREE.Object3D>>();
  const gunJob = (m: GunModel, onBytes: (b: number) => void = () => undefined): Promise<THREE.Object3D> => {
    let p = gunPending.get(m);
    if (p) return p;
    p = loadGlb(loader, WEAPONS[m]!.model.glb!, WEAPONS[m]!.name, onBytes).then((g) => {
      prep(g);
      guns[m] = g.scene;
      return g.scene;
    });
    p.catch(() => gunPending.delete(m));
    gunPending.set(m, p);
    return p;
  };

  void mine?.then((me) => {
    if (!me) return;
    charJob(me.char).catch(() => undefined);
    gunJob(me.gun).catch(() => undefined);
  }).catch(() => undefined);
  const firstChars = [...new Set(first.chars)];
  const firstGuns = [...new Set(first.guns)];
  const n = firstChars.length + firstGuns.length;
  const progress = new Array<number>(n).fill(0);
  const report = (): void => onProgress?.(progress.reduce((a, b) => a + b, 0) / n);
  const track = <T>(i: number, size: number, p: (onBytes: (b: number) => void) => Promise<T>): Promise<T> =>
    p((b) => { progress[i] = Math.min(0.95, b / size); report(); }).then((v) => { progress[i] = 1; report(); return v; });
  await Promise.all([
    ...firstChars.map((id, i) => track(i, 600_000, (on) => charJob(id, on))),
    ...firstGuns.map((m, i) => track(firstChars.length + i, 180_000, (on) => gunJob(m, on))),
  ]);

  // 캐릭터 LOD: 원본을 받은 뒤 받아서, 뼈 번호를 원본 뼈대 순서(뼈 이름으로)로 바꿔 둠. 형상은 모든 아바타가 같이 씀 (dispose 안 함 — shared)
  const lods: Partial<Record<CharId, THREE.BufferGeometry>> = {};
  const lodJob = async (id: CharId): Promise<void> => {
    if (lods[id]) return;
    const main = bodyMesh((await charJob(id)).scene);
    if (!main) return;
    const g = await loader.loadAsync(lodUrl(id));
    const lod = bodyMesh(g.scene);
    if (!lod) return;
    const toMain = lod.skeleton.bones.map((b) => main.skeleton.bones.findIndex((m) => m.name === b.name));
    if (toMain.some((i) => i < 0)) return;
    const geo = lod.geometry;
    const si = geo.attributes.skinIndex!;
    for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) si.setComponent(i, k, toMain[si.getComponent(i, k)]!);
    si.needsUpdate = true;
    lods[id] = geo;
  };

  const gunsLow: Partial<Record<GunModel, THREE.Object3D>> = {};
  const gunLowJob = async (m: GunModel): Promise<void> => {
    if (gunsLow[m]) return;
    const g = await loader.loadAsync(gunLowUrl(m));
    prep(g);
    gunsLow[m] = g.scene;
  };

  let resting = false;
  return {
    lods,
    gunsLow,
    characters,
    guns,
    char: (id) => charJob(id),
    gun: (m) => gunJob(m),
    whenGun(m, cb): void {
      const have = guns[m];
      if (have) cb(have);
      else void gunJob(m).then(cb, () => undefined);
    },
    allGuns: () => Promise.all(GUN_MODELS.map((m) => gunJob(m))).then(() => undefined),
    loadRest(): void {
      if (resting) return;
      resting = true;
      // 하나씩 (게임 중 대역폭·디코드를 한꺼번에 쓰지 않게). 총 먼저: 작고, 총 상점 진열대에 바로 보임
      void (async () => {
        for (const m of GUN_MODELS) {
          try { await gunJob(m); } catch { /* 필요할 때 다시 받음 */ }
        }
        for (const id of CHAR_IDS) {
          try { await charJob(id); } catch { /* 필요할 때 다시 받음 */ }
        }
        // 멀리 있는 사람용 가벼운 몸 (약 85KB씩)·가벼운 총 (약 60KB씩)
        for (const id of CHAR_IDS) {
          try { await lodJob(id); } catch { /* 없으면 원래 몸으로 */ }
        }
        for (const m of GUN_MODELS) {
          try { await gunLowJob(m); } catch { /* 없으면 원래 총으로 */ }
        }
      })();
    },
  };
}
