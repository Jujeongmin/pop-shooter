import * as THREE from 'three';
import type { Assets } from '../assets/loadAssets';
import type { GunDef } from '../sim/guns.ts';

const W = 256;
const H = 160;

/** 총 GLB 복제 + 월드 색 입힘 (Avatar.makeGun과 같은 방식). 복제 material은 돌려주는 쪽이 dispose */
export function tintedGun(assets: Assets, gun: GunDef): { obj: THREE.Object3D; mats: THREE.Material[] } {
  // 부르는 쪽이 그 총을 받은 뒤에 부름 (GunPanel: assets.allGuns() 뒤)
  const obj = assets.guns[gun.model]!.clone(true);
  const tint = new THREE.Color(gun.tint);
  const mats: THREE.Material[] = [];
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const m = (mesh.material as THREE.MeshStandardMaterial).clone();
    if (m.color) m.color.multiply(tint);
    mesh.material = m;
    mats.push(m);
  });
  return { obj, mats };
}

/**
 * 총 상점 썸네일: 총 16자루를 옆모습으로 한 번씩 그려 PNG 주소로 (투명 배경).
 * 오프스크린 렌더러는 다 그리면 dispose + forceContextLoss (브라우저 WebGL 컨텍스트 수 제한).
 */
export function bakeGunIcons(assets: Assets, guns: readonly GunDef[]): string[] {
  const canvas = document.createElement('canvas');
  const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setSize(W, H, false);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#b8c4e0', 2.2));
  const sun = new THREE.DirectionalLight('#ffffff', 2.4);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
  const out: string[] = [];
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  for (const g of guns) {
    const { obj, mats } = tintedGun(assets, g);
    scene.add(obj);
    box.setFromObject(obj);
    box.getSize(size);
    box.getCenter(center);
    // 총열 방향 = 가로로 긴 축. 그 축에 수직으로 옆에서 봄 (살짝 위·앞에서)
    const alongX = size.x >= size.z;
    const len = Math.max(size.x, size.z);
    const half = Math.max(len / 2 / (W / H), size.y / 2) * 1.12;
    cam.left = -half * (W / H);
    cam.right = half * (W / H);
    cam.top = half;
    cam.bottom = -half;
    cam.updateProjectionMatrix();
    const d = len * 3;
    if (alongX) cam.position.set(center.x, center.y + d * 0.18, center.z + d);
    else cam.position.set(center.x - d, center.y + d * 0.18, center.z);
    cam.lookAt(center);
    r.render(scene, cam);
    out.push(canvas.toDataURL('image/png'));
    scene.remove(obj);
    for (const m of mats) m.dispose();
  }
  r.dispose();
  r.forceContextLoss();
  return out;
}
