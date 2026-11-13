import * as THREE from 'three';
import type { GunSource } from '../assets/loadAssets';
import type { GunModel } from '../sim/guns.ts';

/**
 * 진열용 총 자리: 빈 그룹을 바로 돌려주고, 그 총을 받으면(이미 받았으면 바로) 복제해서 긴 변이 len(m)이 되게 넣음.
 * 위치·회전은 돌려받은 그룹에 줄 것. 시작할 때 내 총만 받고 나머지는 뒤에서 받기 때문 (2026-11-13 첫 방문 로딩).
 * 복제본은 원본과 geometry·material을 같이 씀 (dispose 안 함 — shared).
 */
export function gunSlot(src: GunSource, m: GunModel, len: number): THREE.Group {
  const slot = new THREE.Group();
  const put = (model: THREE.Object3D): void => {
    const gun = model.clone(true);
    const box = new THREE.Box3().setFromObject(gun);
    gun.scale.multiplyScalar(len / Math.max(0.01, box.max.x - box.min.x, box.max.z - box.min.z));
    slot.add(gun);
  };
  // 벽 진열은 작게 멀리 보여서 가벼운 총이 있으면 그것 (뒤에서 받으면 바꿔 끼움)
  src.whenGun(m, (model) => {
    const low = src.gunsLow?.[m];
    if (low) model = low;
    else if (src.gunsLow) void waitLow(src, m).then((l) => { if (l) { slot.clear(); put(l); } });
    put(model);
  });
  return slot;
}

/** 가벼운 총이 올 때까지 (최대 60초, 0.5초마다 확인) */
async function waitLow(src: GunSource, m: GunModel): Promise<THREE.Object3D | undefined> {
  for (let i = 0; i < 120; i++) {
    const l = src.gunsLow?.[m];
    if (l) return l;
    await new Promise((r) => setTimeout(r, 500));
  }
  return undefined;
}
