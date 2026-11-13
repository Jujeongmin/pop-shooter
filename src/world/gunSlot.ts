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
  src.whenGun(m, (model) => {
    const gun = model.clone(true);
    const box = new THREE.Box3().setFromObject(gun);
    gun.scale.multiplyScalar(len / Math.max(0.01, box.max.x - box.min.x, box.max.z - box.min.z));
    slot.add(gun);
  });
  return slot;
}
