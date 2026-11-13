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
    it.node.hidden = false;
  }

  update(dt: number): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const it of this.items) {
      if (it.t >= LIFE) continue;
      it.t += dt;
      if (it.t >= LIFE) { it.node.hidden = true; continue; }
      _v.copy(it.pos);
      _v.y += it.t * 1.2;
      _v.project(this.cam);
      const k = it.t / LIFE;
      it.node.style.transform = `translate(${(_v.x * 0.5 + 0.5) * w}px, ${(-_v.y * 0.5 + 0.5) * h}px) translate(-50%, -50%) scale(${1 + 0.25 * (1 - k)})`;
      it.node.style.opacity = String(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
    }
  }
}
