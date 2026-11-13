// GLB 숫자 형식 줄이기 (패키지 설치 없음, 순수 Node): 형상·뼈·클립 내용은 그대로, 저장 형식만 작게.
//   노멀 f32×3 → i8 정규화(4바이트 정렬), 스킨 가중치 f32×4 → u8 정규화(합 255), UV f32×2 → u16 정규화(0~1 범위일 때만),
//   애니메이션 회전 f32×4 → i16 정규화. 위치·인덱스·뼈 번호·이동 트랙·이미지는 그대로.
// glTF 표준: 가중치·회전의 정규화 정수는 코어 규격, 노멀·UV는 KHR_mesh_quantization (three GLTFLoader 지원).
// node tools/store/quant_glb.mjs <in.glb> <out.glb>
// 2026-11-13 첫 방문 로딩: 캐릭터 GLB 약 570KB → 약 400KB (Verse8 배포 서버가 초당 약 150KB라 받는 양이 곧 로딩 시간)
import fs from 'node:fs';

const [input, output] = process.argv.slice(2);
const buf = fs.readFileSync(input);
if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('GLB 아님');
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen + 8;
const bin = buf.subarray(binStart, binStart + buf.readUInt32LE(20 + jsonLen));
if (json.buffers.length !== 1) throw new Error('버퍼 하나짜리 GLB만');

const COMP = { 5120: [Int8Array, 1], 5121: [Uint8Array, 1], 5122: [Int16Array, 2], 5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5126: [Float32Array, 4] };
const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

/** 접근자 값을 형식 그대로 배열로 (끼워 넣은 bufferView도 풀어서) */
function read(acc) {
  if (acc.sparse) throw new Error('sparse 접근자는 지원 안 함');
  const [Arr, size] = COMP[acc.componentType];
  const n = NUM[acc.type];
  const out = new Arr(acc.count * n);
  if (acc.bufferView === undefined) return out;
  const bv = json.bufferViews[acc.bufferView];
  const stride = bv.byteStride ?? size * n;
  const base = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const get = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' }[acc.componentType];
  for (let i = 0; i < acc.count; i++) for (let k = 0; k < n; k++) out[i * n + k] = dv[get](base + i * stride + k * size, true);
  return out;
}

// 어떤 접근자가 어디에 쓰이는지
const role = new Map(); // accessor index → 'NORMAL' | 'WEIGHTS' | 'UV' | 'ROT' | 'attr' | 'index'
for (const m of json.meshes ?? []) for (const p of m.primitives) {
  for (const [k, i] of Object.entries(p.attributes)) {
    role.set(i, k === 'NORMAL' ? 'NORMAL' : k.startsWith('WEIGHTS_') ? 'WEIGHTS' : k.startsWith('TEXCOORD_') ? 'UV' : 'attr');
  }
  if (p.indices !== undefined) role.set(p.indices, 'index');
  if (p.targets) throw new Error('모프 타깃은 지원 안 함');
}
for (const a of json.animations ?? []) for (const c of a.channels) {
  const s = a.samplers[c.sampler];
  if (c.target.path === 'rotation' && (s.interpolation ?? 'LINEAR') !== 'CUBICSPLINE' && !role.has(s.output)) role.set(s.output, 'ROT');
}

const images = new Map((json.images ?? []).filter((im) => im.bufferView !== undefined).map((im) => [im.bufferView, im]));
const parts = [];
let off = 0;
const views = [];
const push = (data, extra = {}) => {
  const pad = (4 - (off % 4)) % 4;
  if (pad) { parts.push(Buffer.alloc(pad)); off += pad; }
  views.push({ buffer: 0, byteOffset: off, byteLength: data.length, ...extra });
  parts.push(data);
  off += data.length;
  return views.length - 1;
};
const bytes = (arr) => Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
const saved = { NORMAL: 0, WEIGHTS: 0, UV: 0, ROT: 0 };

json.accessors.forEach((acc, i) => {
  if (acc.bufferView === undefined) return;
  const r = role.get(i);
  const src = read(acc);
  const before = src.byteLength;
  if (r === 'NORMAL' && acc.componentType === 5126 && acc.type === 'VEC3') {
    // i8 정규화, 정점 속성은 4바이트 정렬이라 한 칸 채움 (byteStride 4)
    const out = new Int8Array(acc.count * 4);
    for (let v = 0; v < acc.count; v++) for (let k = 0; k < 3; k++) out[v * 4 + k] = Math.max(-127, Math.min(127, Math.round(src[v * 3 + k] * 127)));
    acc.bufferView = push(bytes(out), { byteStride: 4, target: 34962 });
    acc.componentType = 5120; acc.normalized = true; delete acc.min; delete acc.max;
    saved.NORMAL += before - out.byteLength;
  } else if (r === 'WEIGHTS' && acc.componentType === 5126 && acc.type === 'VEC4') {
    // u8 정규화, 정점마다 합이 정확히 255가 되게 (큰 나머지부터 올림)
    const out = new Uint8Array(acc.count * 4);
    for (let v = 0; v < acc.count; v++) {
      const w = [0, 1, 2, 3].map((k) => Math.max(0, src[v * 4 + k]));
      const sum = w[0] + w[1] + w[2] + w[3] || 1;
      const exact = w.map((x) => (x / sum) * 255);
      const q = exact.map(Math.floor);
      let left = 255 - (q[0] + q[1] + q[2] + q[3]);
      const order = [0, 1, 2, 3].sort((a, b) => (exact[b] - q[b]) - (exact[a] - q[a]));
      for (let k = 0; left > 0; k = (k + 1) % 4, left--) q[order[k]]++;
      for (let k = 0; k < 4; k++) out[v * 4 + k] = q[k];
    }
    acc.bufferView = push(bytes(out), { target: 34962 });
    acc.componentType = 5121; acc.normalized = true; delete acc.min; delete acc.max;
    saved.WEIGHTS += before - out.byteLength;
  } else if (r === 'UV' && acc.componentType === 5126 && acc.type === 'VEC2' && src.every((x) => x >= 0 && x <= 1)) {
    const out = new Uint16Array(acc.count * 2);
    for (let k = 0; k < out.length; k++) out[k] = Math.round(src[k] * 65535);
    acc.bufferView = push(bytes(out), { target: 34962 });
    acc.componentType = 5123; acc.normalized = true; delete acc.min; delete acc.max;
    saved.UV += before - out.byteLength;
  } else if (r === 'ROT' && acc.componentType === 5126 && acc.type === 'VEC4') {
    const out = new Int16Array(acc.count * 4);
    for (let k = 0; k < out.length; k++) out[k] = Math.max(-32767, Math.min(32767, Math.round(src[k] * 32767)));
    acc.bufferView = push(bytes(out));
    acc.componentType = 5122; acc.normalized = true; delete acc.min; delete acc.max;
    saved.ROT += before - out.byteLength;
  } else {
    acc.bufferView = push(bytes(src), r === 'index' ? { target: 34963 } : r ? { target: 34962 } : {});
  }
  delete acc.byteOffset;
});
// 이미지: 바이트 그대로
for (const [vi, im] of images) {
  const bv = json.bufferViews[vi];
  im.bufferView = push(Buffer.from(bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength)));
}
const tail = (4 - (off % 4)) % 4;
if (tail) { parts.push(Buffer.alloc(tail)); off += tail; }
json.bufferViews = views;
json.buffers[0].byteLength = off;
if (saved.NORMAL + saved.UV > 0) {
  json.extensionsUsed = [...new Set([...(json.extensionsUsed ?? []), 'KHR_mesh_quantization'])];
  json.extensionsRequired = [...new Set([...(json.extensionsRequired ?? []), 'KHR_mesh_quantization'])];
}

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
console.log(`saved ${output}: ${buf.length} -> ${fs.statSync(output).size}  (${Object.entries(saved).map(([k, v]) => `${k} -${Math.round(v / 1024)}K`).join(' ')})`);
