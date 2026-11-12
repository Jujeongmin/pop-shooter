import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { fontFamily } from '../i18n/i18n';
import type { IconName } from '../ui/icons';

/**
 * 광장 시설 장난감 도형 (2026-11-11 사용자: 구조물을 한눈에 알아보게, 코드 도형으로).
 * 공통: 둥근 도형 + 남색 외곽선(뒷면 부풀림) + 아이콘 간판 + 시설마다 움직이는 부분 하나.
 * 소유: 이 빌더가 만든 geometry·material·texture 전부 → dispose(). 총 진열은 GLB 원본 복제(공유 geometry, dispose 안 함).
 */

export const INK = '#2b3a67';
const OUTLINE = 0.035;

/** 뒷면을 법선 방향으로 부풀린 외곽선 재질 (모든 도형 공유) */
function outlineMaterial(): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n  transformed += normalize(normal) * ${OUTLINE.toFixed(3)};`);
  };
  return m;
}

export type Animate = (dt: number, clock: number) => void;

export class ToyBuilder {
  readonly root = new THREE.Group();
  readonly animators: Animate[] = [];
  private readonly owned: { dispose(): void }[] = [];
  private readonly mats = new Map<string, THREE.MeshStandardMaterial>();
  private readonly ink = outlineMaterial();

  constructor() {
    this.owned.push(this.ink);
  }

  mat(color: string, opts: { emissive?: string; metal?: number; rough?: number } = {}): THREE.MeshStandardMaterial {
    const key = `${color}|${opts.emissive ?? ''}|${opts.metal ?? 0}|${opts.rough ?? 0.45}`;
    let m = this.mats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color, roughness: opts.rough ?? 0.45, metalness: opts.metal ?? 0.04,
        emissive: opts.emissive ?? '#000000', emissiveIntensity: opts.emissive ? 0.55 : 0,
      });
      this.mats.set(key, m);
      this.owned.push(m);
    }
    return m;
  }

  own<T extends { dispose(): void }>(o: T): T {
    this.owned.push(o);
    return o;
  }

  /** 장난감 도형 하나 (+ 외곽선). parent 기본 = root */
  toy(geo: THREE.BufferGeometry, color: string | THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.root, outline = true): THREE.Mesh {
    this.owned.push(geo);
    const mesh = new THREE.Mesh(geo, typeof color === 'string' ? this.mat(color) : color);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (outline) {
      const o = new THREE.Mesh(geo, this.ink);
      o.castShadow = false;
      mesh.add(o);
    }
    parent.add(mesh);
    return mesh;
  }

  box(w: number, h: number, d: number, r = 0.12): THREE.BufferGeometry {
    return new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2));
  }

  /** 톱니바퀴 (앞뒤 두께 t, 반지름 r, 이 n개). 앞 = +z */
  gear(r: number, t: number, n: number): THREE.BufferGeometry {
    const s = new THREE.Shape();
    const inner = r * 0.8;
    for (let i = 0; i < n * 2; i++) {
      const a0 = (i / (n * 2)) * Math.PI * 2;
      const a1 = ((i + 1) / (n * 2)) * Math.PI * 2;
      const rr = i % 2 === 0 ? r : inner;
      if (i === 0) s.moveTo(Math.cos(a0) * rr, Math.sin(a0) * rr); else s.lineTo(Math.cos(a0) * rr, Math.sin(a0) * rr);
      s.lineTo(Math.cos(a1) * rr, Math.sin(a1) * rr);
    }
    const hole = new THREE.Path();
    hole.absarc(0, 0, r * 0.28, 0, Math.PI * 2, true);
    s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 6 });
    g.translate(0, 0, -t / 2);
    g.computeVertexNormals();
    return g;
  }

  /**
   * 아이콘 간판: 둥근 판(앞 = +z) + 기둥. 판 앞면 = 캔버스(아이콘 그림 + 이름). 아이콘 그림은 받으면 다시 그림.
   * at = 판 가운데 위치, 판 크기 w×h (m).
   */
  sign(icon: IconName | null, text: string, x: number, y: number, z: number, opts: { w?: number; h?: number; color?: string; rotY?: number; post?: boolean } = {}): THREE.Group {
    const w = opts.w ?? 2.2;
    const h = opts.h ?? 0.8;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = opts.rotY ?? 0;
    this.toy(this.box(w + 0.16, h + 0.16, 0.16, 0.08), opts.color ?? '#ffffff', 0, 0, -0.05, g);
    if (opts.post !== false) this.toy(new THREE.CylinderGeometry(0.07, 0.09, y, 10), '#c98a5a', 0, -y / 2, -0.12, g);
    const canvas = document.createElement('canvas');
    const px = 128;
    canvas.width = Math.round(w * px);
    canvas.height = Math.round(h * px);
    const tex = this.own(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const draw = (img: HTMLImageElement | null): void => {
      const c = canvas.getContext('2d')!;
      c.clearRect(0, 0, canvas.width, canvas.height);
      c.fillStyle = '#fffaf0';
      c.beginPath();
      c.roundRect(0, 0, canvas.width, canvas.height, 36);
      c.fill();
      const ih = canvas.height * 0.8;
      const pad = canvas.height * 0.1;
      if (img) c.drawImage(img, pad, pad, ih, ih);
      c.fillStyle = INK;
      const fs = Math.round(canvas.height * 0.48);
      c.font = `${fs}px ${fontFamily}`;
      c.textBaseline = 'middle';
      c.textAlign = 'center';
      const left = img || icon ? pad + ih : 0;
      c.fillText(text, left + (canvas.width - left) / 2, canvas.height * 0.54, canvas.width - left - pad);
      tex.needsUpdate = true;
    };
    draw(null);
    if (icon) {
      const img = new Image();
      img.onload = () => draw(img);
      img.src = `${import.meta.env.BASE_URL}ui/icons/${icon}.webp`;
    }
    // 글꼴이 늦게 오면 다시 그림
    void document.fonts?.ready.then(() => draw(null)).then(() => { if (icon) { const img = new Image(); img.onload = () => draw(img); img.src = `${import.meta.env.BASE_URL}ui/icons/${icon}.webp`; } });
    const face = new THREE.Mesh(this.own(new THREE.PlaneGeometry(w, h)), this.own(new THREE.MeshBasicMaterial({ map: tex, transparent: true })));
    face.position.z = 0.04;
    g.add(face);
    this.root.add(g);
    return g;
  }

  update(dt: number, clock: number): void {
    for (const a of this.animators) a(dt, clock);
  }

  dispose(): void {
    for (const o of this.owned) o.dispose();
    this.root.removeFromParent();
  }
}
