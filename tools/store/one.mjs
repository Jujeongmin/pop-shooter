// 장면 하나만 다시 찍기: node tools/store/one.mjs <출력> <장면 파일 번호>
process.env.ONLY = process.argv[3];
await import('./shots.mjs');
