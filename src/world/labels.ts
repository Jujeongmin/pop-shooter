import { fontFamily } from '../i18n/i18n';
import * as THREE from 'three';

/** 글자 스프라이트 (캔버스 텍스처). 만든 쪽이 disposeLabel 책임 */
export function makeLabel(text: string, opts: { color?: string; bg?: string; size?: number } = {}): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const font = `bold 64px ${fontFamily}`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 48;
  canvas.width = w;
  canvas.height = 96;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = opts.bg ?? 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.roundRect(4, 4, w - 8, 88, 40);
  ctx.fill();
  ctx.fillStyle = opts.color ?? '#2b3a67';
  ctx.fillText(text, w / 2, 52);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  const size = opts.size ?? 1;
  sprite.scale.set((w / 96) * size, size, 1);
  return sprite;
}

export function disposeLabel(s: THREE.Sprite): void {
  s.material.map?.dispose();
  s.material.dispose();
}
