import * as THREE from 'three';

/**
 * 로딩 화면 동안 GPU 미리 준비 (사용자 2026-11-12: 업그레이드에 들어갈 때 렉).
 * three는 물체가 처음 화면에 들어오는 프레임에 텍스처를 GPU로 올리고 셰이더를 만든다 → 시작 화면 밖 시설(업그레이드 등)로 가면
 * 텍스처 18장이 한 프레임에 올라가며 멈칫 (폰에서 더 큼). 여기서 장면·캐릭터·총 텍스처를 전부 올리고, 보이는 물체의 셰이더를 만든다.
 * 이미 올라간 텍스처는 three가 건너뜀. 숨긴 물체(전투 무대 등)도 셰이더를 미리 만듦.
 */
export function warmGpu(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, extra: readonly THREE.Object3D[]): void {
  const seen = new Set<THREE.Texture>();
  const visit = (root: THREE.Object3D): void => {
    root.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!mat) return;
      for (const m of Array.isArray(mat) ? mat : [mat]) {
        for (const v of Object.values(m)) {
          if (v instanceof THREE.Texture && !seen.has(v)) {
            seen.add(v);
            renderer.initTexture(v);
          }
        }
      }
    });
  };
  visit(scene);
  for (const o of extra) visit(o);
  // 셰이더: compile은 보이는 물체만 → 숨겨 둔 것(전투 무대·구역 효과 등)도 잠깐 보이게 해서 같이 만들고 되돌림 (그리지는 않음)
  const hidden: THREE.Object3D[] = [];
  scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
  renderer.compile(scene, camera);
  for (const o of hidden) o.visible = false;
  // 원본 캐릭터·총(아직 장면에 없는 복제본의 재질)도 이 장면 조명으로
  for (const o of extra) renderer.compile(o, camera, scene);
}
