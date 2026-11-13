// 캐릭터 초상 6장을 게임 GLB로 한 번 구워 public/ui/chars/<id>.webp로 (오프라인 헤드리스).
// 게임은 이 그림을 씀 → 시작할 때 캐릭터 GLB 6개를 다 받지 않아도 됨 (2026-11-13 로딩 줄이기). 캐릭터 GLB를 바꾸면 다시 실행.
// node tools/store/charicons.mjs   (개발 서버 5220이 떠 있어야 함)
import fs from 'node:fs';
import { launch } from './cdp.mjs';
const OUT = 'public/ui/chars';
fs.mkdirSync(OUT, { recursive: true });
const b = await launch({ width: 600, height: 400, port: 9341 });
await b.send('Network.enable');
await b.send('Network.setBlockedURLs', { urls: ['*verse8.io*', '*verse8.games*'] });
await b.send('Page.navigate', { url: 'http://localhost:5220/?offline=1&allchars=1' });
await new Promise((r) => setTimeout(r, 12000));
const icons = await b.evaluate(`
  const { renderCharIcons } = await import('/src/ui/charIcons.ts');
  const { CHAR_IDS } = await import('/src/sim/state.ts');
  for (const id of CHAR_IDS) await window.__game.assets.char(id);
  const png = renderCharIcons(window.__game.assets);
  const out = {};
  for (const [id, url] of Object.entries(png)) {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    out[id] = c.toDataURL('image/webp', 0.9);
  }
  return out;
`);
for (const [id, url] of Object.entries(icons)) {
  const file = `${OUT}/${id}.webp`;
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log('saved', file, fs.statSync(file).size);
}
b.close();
