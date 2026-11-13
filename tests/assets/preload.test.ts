import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// index.html이 첫 방문 때 미리 받는 파일: 실제로 있고, 게임이 쓰는 이름과 같아야 함 (이름을 바꾸면 헛받기가 됨)
test('index.html preload list matches the files the game loads first', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const paths = [...html.matchAll(/'(assets\/[^']+\.glb)'/g)].map((m) => m[1]!);
  assert.ok(paths.length >= 3);
  for (const p of paths) assert.ok(fs.existsSync(`public/${p}`), `missing public/${p}`);
  const chars = fs.readFileSync('src/config/characters.ts', 'utf8');
  const blue = /blue: def\('blue', '[^']+', '([^']+)'/.exec(chars)![1]!;
  assert.ok(paths.includes(`assets/models/${blue}`), `blue character file ${blue} must be preloaded`);
  const cfg = fs.readFileSync('src/config/gameConfig.ts', 'utf8');
  const variant = /: '(_lod1\w*)';/.exec(cfg)![1]!;
  assert.ok(paths.includes(`assets/models/pop_battle_pistol${variant}.glb`), 'pistol file must be preloaded');
  const font = /href="\.\/(fonts\/[^"]+)"/.exec(html)![1]!;
  assert.ok(fs.existsSync(`public/${font}`), `missing public/${font}`);
});
