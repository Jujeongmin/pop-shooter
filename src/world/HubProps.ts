import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fontFamily } from '../i18n/i18n';
import { iconUrl, type IconName } from '../ui/icons';

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

/**
 * 외곽선 전용 도형: 같은 자리 꼭짓점을 합쳐 부드러운 법선으로 다시 계산.
 * 원뿔 끝·상자 모서리처럼 면마다 법선이 갈라진 도형을 그대로 부풀리면 면이 벌어지고 끝이 튀어나옴 (사용자 2026-11-12 지적).
 */
function outlineGeometry(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', geo.getAttribute('position').clone());
  if (geo.index) g.setIndex(geo.index.clone());
  const merged = mergeVertices(g, 1e-4);
  g.dispose();
  merged.computeVertexNormals();
  return merged;
}

export class ToyBuilder {
  readonly root = new THREE.Group();
  readonly animators: Animate[] = [];
  /** 시설 겉모양 묶음 (월드 2~8에서는 숨기고 FacilityDress의 월드 모양으로 대신, 기능 부품은 따로 남김) */
  readonly housings: THREE.Object3D[] = [];

  /** 겉모양 묶음 하나 (parent 아래, housings에 등록) */
  housing(parent: THREE.Object3D): THREE.Group {
    const h = new THREE.Group();
    parent.add(h);
    this.housings.push(h);
    return h;
  }
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

  /** 모든 시설 재질 색을 원래 색에서 tint 쪽으로 k만큼 (월드 테마, k = 0이면 원래대로). 원래 색은 처음 한 번 기억 */
  tint(color: string | null, k: number): void {
    const t = new THREE.Color(color ?? '#ffffff');
    for (const m of this.mats.values()) {
      const orig = (m.userData.orig as THREE.Color | undefined) ?? (m.userData.orig = m.color.clone());
      m.color.copy(orig);
      if (color && k > 0) m.color.lerp(t, k);
    }
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
      const o = new THREE.Mesh(this.own(outlineGeometry(geo)), this.ink);
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
    const board = this.toy(this.box(w + 0.16, h + 0.16, 0.16, 0.08), opts.color ?? '#ffffff', 0, 0, -0.05, g);
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
      img.src = iconUrl(icon);
    }
    // 글꼴이 늦게 오면 다시 그림
    void document.fonts?.ready.then(() => draw(null)).then(() => { if (icon) { const img = new Image(); img.onload = () => draw(img); img.src = iconUrl(icon); } });
    const face = new THREE.Mesh(this.own(new THREE.PlaneGeometry(w, h)), this.own(new THREE.MeshBasicMaterial({ map: tex, transparent: true })));
    // 글자 면은 판의 자식으로: 판이 카메라와 캐릭터 사이에 끼어 흐려질 때 글자 면도 같이 숨음 (OcclusionFader가 흐린 도형의
    // 그림자 없는 자식을 숨김). 예전엔 판만 흐려지고 불투명한 글자 면이 남아 간판 뒤 캐릭터를 완전히 가렸음 (2026-11-13 점검)
    face.position.z = 0.09;
    board.add(face);
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
