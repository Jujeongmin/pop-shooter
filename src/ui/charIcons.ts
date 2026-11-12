import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Assets } from '../assets/loadAssets';
import { CHARACTER } from '../config/gameConfig';
import { CHAR_IDS, type CharId } from '../sim/state.ts';

const S = 192;

/**
 * 캐릭터 창 초상: 6명을 대기 자세로 정면에서 한 번씩 그려 PNG 주소로.
 * 복제 스켈레톤(boneTexture)·믹서는 그린 뒤 해제, 오프스크린 렌더러는 dispose + forceContextLoss.
 */
let cache: Record<CharId, string> | null = null;

export function bakeCharIcons(assets: Assets): Record<CharId, string> {
  // 캐릭터 창·멘토 탭이 같이 씀: 한 번만 그림
  if (cache) return cache;
  const canvas = document.createElement('canvas');
  const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setSize(S, S, false);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#b8c4e0', 2.2));
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  sun.position.set(1.5, 3, 4);
  scene.add(sun);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  const out = {} as Record<CharId, string>;
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  for (const id of CHAR_IDS) {
    const src = assets.characters[id];
    const model = SkeletonUtils.clone(src.scene);
    const mixer = new THREE.AnimationMixer(model);
    const idle = src.clips.find((c) => c.name === CHARACTER.clips.idle);
    if (idle) mixer.clipAction(idle).play();
    mixer.update(0.4);
    scene.add(model);
    model.updateMatrixWorld(true);
    box.setFromObject(model);
    box.getSize(size);
    box.getCenter(center);
    // 전신, 살짝 위·옆에서
    const dist = (size.y * 0.62) / Math.tan((cam.fov * Math.PI) / 360);
    cam.position.set(center.x + dist * 0.25, center.y + size.y * 0.12, center.z + dist);
    cam.lookAt(center);
    r.render(scene, cam);
    out[id] = canvas.toDataURL('image/png');
    scene.remove(model);
    mixer.stopAllAction();
    mixer.uncacheRoot(model);
    model.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) (o as THREE.SkinnedMesh).skeleton.dispose(); });
  }
  r.dispose();
  r.forceContextLoss();
  cache = out;
  return out;
}
