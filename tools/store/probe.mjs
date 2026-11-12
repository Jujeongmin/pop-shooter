import { launch } from './cdp.mjs';
const b = await launch({ width: 1280, height: 720 });
await b.send('Page.navigate', { url: 'http://localhost:5220/' });
await new Promise((r) => setTimeout(r, 12000));
const info = await b.evaluate(`
  const g = window.__game; if (!g) return 'no game';
  const R = g.stage.renderer; const gl = R.getContext();
  const t0 = performance.now(); let n = 0;
  await new Promise((res) => { const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  const e = gl.getExtension('WEBGL_debug_renderer_info');
  return { fps: n / 2, renderer: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?', online: window.__prem?.online, nick: !!document.querySelector('.nick-wrap'), daily: !!document.querySelector('.daily-wrap'), off: !!document.querySelector('.result-wrap:not([hidden])') };
`);
console.log(JSON.stringify(info));
await b.shot('tools/store/probe.png');
b.close();
