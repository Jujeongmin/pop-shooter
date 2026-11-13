// 배포본 첫 방문 로딩 재기: 빈 프로필(캐시 없음·비로그인) 헤드리스 Chrome으로 Verse8 게임 페이지를 열고,
// 게임이 답하는 시작 구간 시간(main.ts 'POP_BOOT?')을 읽음. node tools/store/coldboot.mjs [url] [down Mbps, 0 = 제한 없음]
import { launch } from './cdp.mjs';
const url = process.argv[2] ?? 'https://verse8.io/K8K5U7V';
const mbps = Number(process.argv[3] ?? 0);
const b = await launch({ width: 1280, height: 720, port: 9344 });
await b.send('Network.enable');
if (mbps > 0) {
  // 페이지와 그 안 프레임에 같이 걸리게 (프레임이 다른 프로세스면 안 걸릴 수 있음 → 결과의 받는 시간으로 확인)
  await b.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: (mbps * 1e6) / 8, uploadThroughput: (mbps * 1e6) / 16 });
}
const t0 = Date.now();
await b.send('Page.navigate', { url });
const r = await b.evaluate(`
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let f = null, frameAt = 0;
  for (let i = 0; i < 300 && !f; i++) { f = [...document.querySelectorAll('iframe')].find((x) => x.src.includes('verse8.games')) ?? null; if (!f) await wait(100); }
  if (!f) return { error: 'no game frame', text: document.body.innerText.slice(0, 200) };
  frameAt = Math.round(performance.now());
  let wrapperGone = 0;
  let reply = null;
  window.addEventListener('message', (e) => { if (e.data && e.data.type === 'POP_BOOT') reply = e.data; });
  for (let i = 0; i < 600; i++) {
    if (!wrapperGone && !/\\d+%\\s*\\n+\\s*(Forging|Summoning|Breathing|Opening|All set)/.test(document.body.innerText)) wrapperGone = Math.round(performance.now());
    f.contentWindow.postMessage({ type: 'POP_BOOT?' }, '*');
    await wait(200);
    if (reply && reply.marks.some((m) => m[0] === 'warm') && wrapperGone) break;
  }
  return { sha: new URL(f.src).searchParams.get('sha')?.slice(0, 7), frameAt, wrapperGone, boot: reply };
`);
console.log(JSON.stringify({ wallMs: Date.now() - t0, mbps, ...r }, null, 1));
b.close();
