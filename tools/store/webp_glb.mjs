// GLB 안의 PNG 텍스처만 WebP로 바꿔 새 GLB로 (형상·재질·좌표는 그대로, 바이트만 교체). 패키지 설치 없음: 헤드리스 Chrome 캔버스로 인코딩.
// glTF 표준 확장 EXT_texture_webp (three GLTFLoader 지원). JPEG는 그대로 둠.
// node tools/store/webp_glb.mjs <in.glb> <out.glb> [quality 0~1, 기본 0.92] [--jpeg] [--max 1024]
//   --jpeg = JPEG 텍스처도 WebP로, --max N = 긴 변이 N보다 크면 줄임 (캐릭터 2048² JPEG 610KB → 1024² WebP, 2026-11-13 첫 방문 로딩)
// 2026-11-13: 총 _lod1의 노멀맵 PNG(약 230KB)가 GLB의 2/3 → 시작 로딩 줄이기
import fs from 'node:fs';
import { launch } from './cdp.mjs';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const maxArg = argv.indexOf('--max');
const maxSize = maxArg >= 0 ? Number(argv[maxArg + 1]) : 0;
const pos = argv.filter((a, i) => !a.startsWith('--') && !(maxArg >= 0 && i === maxArg + 1));
const [input, output, q] = pos;
const quality = Number(q ?? 0.92);
const alsoJpeg = flag('--jpeg');
const buf = fs.readFileSync(input);
if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('GLB 아님');
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen + 8;
const binLen = buf.readUInt32LE(20 + jsonLen);
const bin = buf.subarray(binStart, binStart + binLen);
if (json.buffers.length !== 1) throw new Error('버퍼 하나짜리 GLB만');

const pngs = (json.images ?? []).map((im, i) => ({ im, i })).filter(({ im }) => im.mimeType === 'image/png' || (alsoJpeg && im.mimeType === 'image/jpeg'));
if (!pngs.length) { console.log('바꿀 이미지 없음'); process.exit(0); }

const b = await launch({ width: 200, height: 200, port: 9342 });
const webp = new Map();
for (const { im, i } of pngs) {
  const bv = json.bufferViews[im.bufferView];
  const data = bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength).toString('base64');
  // 색 변환·알파 곱하기 없이 그대로 (노멀맵 값이 바뀌면 안 됨)
  const url = await b.evaluate(`
    const bytes = Uint8Array.from(atob(${JSON.stringify(data)}), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bytes], { type: ${JSON.stringify(im.mimeType)} }), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    const k = ${maxSize} > 0 ? Math.min(1, ${maxSize} / Math.max(bmp.width, bmp.height)) : 1;
    const c = new OffscreenCanvas(Math.round(bmp.width * k), Math.round(bmp.height * k));
    const ctx = c.getContext('2d', { colorSpace: 'srgb' });
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const out = await c.convertToBlob({ type: 'image/webp', quality: ${quality} });
    const ab = new Uint8Array(await out.arrayBuffer());
    let s = ''; for (let k = 0; k < ab.length; k += 0x8000) s += String.fromCharCode(...ab.subarray(k, k + 0x8000));
    return btoa(s);
  `);
  webp.set(i, Buffer.from(url, 'base64'));
  console.log(`${im.name ?? i}: ${im.mimeType} ${bv.byteLength} -> webp ${webp.get(i).length}`);
}
b.close();

// 버퍼 다시 쌓기: 바뀐 이미지 bufferView만 새 바이트, 나머지는 그대로 (4바이트 정렬)
const parts = [];
let off = 0;
const newViews = json.bufferViews.map((bv, vi) => {
  const img = (json.images ?? []).findIndex((im) => im.bufferView === vi);
  const data = img >= 0 && webp.has(img) ? webp.get(img) : bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength);
  const pad = (4 - (off % 4)) % 4;
  if (pad) { parts.push(Buffer.alloc(pad)); off += pad; }
  const nv = { ...bv, byteOffset: off, byteLength: data.length };
  parts.push(data);
  off += data.length;
  return nv;
});
const tail = (4 - (off % 4)) % 4;
if (tail) { parts.push(Buffer.alloc(tail)); off += tail; }
json.bufferViews = newViews;
json.buffers[0].byteLength = off;
for (const i of webp.keys()) json.images[i].mimeType = 'image/webp';
// 텍스처가 WebP 이미지를 source로 직접 쓰지 않고 확장으로 (표준 방식)
for (const t of json.textures ?? []) {
  if (t.source !== undefined && webp.has(t.source)) {
    t.extensions = { ...(t.extensions ?? {}), EXT_texture_webp: { source: t.source } };
    delete t.source;
  }
}
json.extensionsUsed = [...new Set([...(json.extensionsUsed ?? []), 'EXT_texture_webp'])];
json.extensionsRequired = [...new Set([...(json.extensionsRequired ?? []), 'EXT_texture_webp'])];

let js = Buffer.from(JSON.stringify(json), 'utf8');
const jpad = (4 - (js.length % 4)) % 4;
if (jpad) js = Buffer.concat([js, Buffer.alloc(jpad, 0x20)]);
const binBuf = Buffer.concat(parts);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + js.length + 8 + binBuf.length, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(binBuf.length, 0); bh.writeUInt32LE(0x004e4942, 4);
fs.writeFileSync(output, Buffer.concat([header, jh, js, bh, binBuf]));
console.log(`saved ${output}: ${buf.length} -> ${fs.statSync(output).size}`);
