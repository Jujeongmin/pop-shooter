import * as THREE from 'three';

/** 둥근 빛 텍스처 (가운데 흰색 → 노랑 → 투명). 섬광·명중에 공유 */
function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,240,150,0.95)');
  g.addColorStop(0.6, 'rgba(255,190,80,0.45)');
  g.addColorStop(1, 'rgba(255,170,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const POOL = 6;

/**
 * 발사·명중 효과: 총구 섬광(둥근 빛) + 탄 궤적(짧은 빛줄기) + 명중 팡(빛 + 링).
 * 텍스처·geometry·material은 이 객체가 소유해 공유, 풀 크기 고정.
 */
export class HitFx {
  private readonly tex = glowTexture();
  private readonly flashMat = new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  private readonly flash = new THREE.Sprite(this.flashMat);
  private flashT = 1;
  private readonly tracerGeo = new THREE.CylinderGeometry(0.025, 0.025, 1, 6, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2);
  private readonly ringGeo = new THREE.RingGeometry(0.22, 0.34, 24);
  private readonly tracers: { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number }[] = [];
  private readonly hits: { s: THREE.Sprite; ring: THREE.Mesh; ringMat: THREE.MeshBasicMaterial; t: number }[] = [];
  private nextTracer = 0;
  private nextHit = 0;
  private readonly root = new THREE.Group();

  constructor(scene: THREE.Scene) {
    this.flash.visible = false;
    this.root.add(this.flash);
    for (let i = 0; i < POOL; i++) {
      // 풀 항목마다 투명도가 달라 material을 따로 (고정 개수, dispose에서 해제)
      const mat = new THREE.MeshBasicMaterial({ color: '#fff3a6', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const m = new THREE.Mesh(this.tracerGeo, mat);
      m.visible = false;
      this.root.add(m);
      this.tracers.push({ m, mat, t: 1 });
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.visible = false;
      const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(this.ringGeo, ringMat);
      ring.visible = false;
      this.root.add(s, ring);
      this.hits.push({ s, ring, ringMat, t: 1 });
    }
    scene.add(this.root);
  }

  /** 총구 섬광 + 총구 → 명중 지점 빛줄기 + 명중 팡 */
  shot(muzzle: THREE.Vector3, hit: THREE.Vector3): void {
    this.flash.position.copy(muzzle);
    this.flash.material.rotation = Math.random() * Math.PI;
    this.flash.scale.setScalar(0.5 + Math.random() * 0.15);
    this.flashT = 0;
    this.flash.visible = true;

    const tr = this.tracers[this.nextTracer]!;
    this.nextTracer = (this.nextTracer + 1) % POOL;
    tr.m.position.copy(muzzle);
    tr.m.lookAt(hit);
    tr.m.scale.set(1, 1, muzzle.distanceTo(hit));
    tr.t = 0;
    tr.m.visible = true;

    const h = this.hits[this.nextHit]!;
    this.nextHit = (this.nextHit + 1) % POOL;
    h.s.position.copy(hit);
    h.ring.position.copy(hit);
    h.ring.lookAt(muzzle);
    h.t = 0;
    h.s.visible = h.ring.visible = true;
  }

  update(dt: number): void {
    if (this.flash.visible) {
      this.flashT += dt;
      if (this.flashT > 0.06) this.flash.visible = false;
    }
    for (const tr of this.tracers) {
      if (!tr.m.visible) continue;
      tr.t += dt / 0.08;
      if (tr.t >= 1) { tr.m.visible = false; continue; }
      tr.mat.opacity = 1 - tr.t;
    }
    for (const h of this.hits) {
      if (!h.s.visible) continue;
      h.t += dt / 0.3;
      if (h.t >= 1) { h.s.visible = h.ring.visible = false; continue; }
      h.s.scale.setScalar(0.9 * (1 - h.t * 0.5));
      (h.s.material as THREE.SpriteMaterial).opacity = 1 - h.t;
      h.ring.scale.setScalar(1 + h.t * 2.2);
      h.ringMat.opacity = 1 - h.t;
    }
  }

  dispose(): void {
    for (const tr of this.tracers) tr.mat.dispose();
    for (const h of this.hits) { (h.s.material as THREE.Material).dispose(); h.ringMat.dispose(); }
    this.flashMat.dispose();
    this.tex.dispose();
    this.tracerGeo.dispose();
    this.ringGeo.dispose();
    this.root.removeFromParent();
  }
}
