// 총 상점 간판용 'gun' 아이콘: 게임의 장난감 총(GLB)을 옆모습으로 구워 PNG로 (오프라인 헤드리스). node tools/store/gunicon.mjs <출력 png> <총 index>
import fs from 'node:fs';
import { launch } from './cdp.mjs';
const [out, idx] = [process.argv[2], Number(process.argv[3] ?? 1)];
const b = await launch({ width: 600, height: 400, port: 9340 });
await b.send('Network.enable');
await b.send('Network.setBlockedURLs', { urls: ['*verse8.io*', '*verse8.games*'] });
await b.send('Page.navigate', { url: 'http://localhost:5220/?offline=1&guns=lod0' });
await new Promise((r) => setTimeout(r, 11000));
const url = await b.evaluate(`
  const { bakeGunIcons } = await import('/src/ui/gunIcons.ts');
  const { GUNS } = await import('/src/sim/guns.ts');
  return bakeGunIcons(window.__game.assets, [GUNS[${idx}]])[0];
`);
fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
b.close();
console.log('saved', out);
