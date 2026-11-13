import * as THREE from 'three';
import { el } from './dom';
import { icon, type IconName } from './icons';

const _v = new THREE.Vector3();
const POOL = 12;
const LIFE = 0.9;

interface Item { node: HTMLDivElement; t: number; pos: THREE.Vector3 }

/** 월드 위치에서 떠오르는 글자 (DOM 노드 풀 재사용, 동시에 최대 12개) */
export class FloatText {
  private readonly items: Item[] = [];
  private next = 0;
  private readonly cam: THREE.Camera;

  constructor(parent: HTMLElement, cam: THREE.Camera) {
    this.cam = cam;
    const layer = el('div', 'float-layer');
    parent.appendChild(layer);
    for (let i = 0; i < POOL; i++) {
      const node = el('div', 'float-text');
      node.hidden = true;
      layer.appendChild(node);
      this.items.push({ node, t: LIFE, pos: new THREE.Vector3() });
    }
  }

  /** ico = 글자 앞 능력치 아이콘 (훈련 수치, 사용자 2026-11-13) */
  show(text: string, at: THREE.Vector3, cls = '', ico?: IconName): void {
    const it = this.items[this.next]!;
    this.next = (this.next + 1) % POOL;
    it.t = 0;
    it.pos.copy(at);
    if (ico) it.node.replaceChildren(icon(ico), el('span', '', text));
    else it.node.textContent = text;
    it.node.className = `float-text ${cls}`;
    // 보이기 전에 자리부터: 예전엔 다음 update까지 위치가 없어 한 프레임 화면 왼쪽 위(0,0)에 떴음 (느린 폰에서 보임, 2026-11-13)
    this.place(it);
    it.node.hidden = false;
  }

  private place(it: Item): void {
    _v.copy(it.pos);
    _v.y += it.t * 1.2;
    _v.project(this.cam);
    const k = it.t / LIFE;
    // 카메라 뒤(z > 1)는 숨김 (투영하면 엉뚱한 자리에 뜸)
    it.node.style.visibility = _v.z > 1 ? 'hidden' : '';
    it.node.style.transform = `translate(${(_v.x * 0.5 + 0.5) * window.innerWidth}px, ${(-_v.y * 0.5 + 0.5) * window.innerHeight}px) translate(-50%, -50%) scale(${1 + 0.25 * (1 - k)})`;
    it.node.style.opacity = String(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
  }

  update(dt: number): void {
    for (const it of this.items) {
      if (it.t >= LIFE) continue;
      it.t += dt;
      if (it.t >= LIFE) { it.node.hidden = true; continue; }
      this.place(it);
    }
  }
}
