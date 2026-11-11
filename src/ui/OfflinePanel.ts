import type { Game } from '../core/Game';
import { t } from '../i18n/i18n';
import { addCoins } from '../sim/actions.ts';
import { formatNum } from '../sim/format.ts';
import { offlineReward } from '../sim/offline.ts';
import { button, el } from './dom';
import { icon } from './icons';

/** 1분 넘게 비웠을 때만 창을 띄움 (새로고침마다 뜨지 않게) */
const MIN_SEC = 60;

export function durationText(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? t('time.hm', { h, m }) : t('time.m', { m: Math.max(1, m) });
}

/**
 * 오프라인 보상: 게임 시작 때 한 번. offlineReward(저장된 lastSeen 기준)가 있으면 "자리 비운 동안" 창 → [받기].
 * 받으면 코인 추가 + 즉시 저장(lastSeen 갱신). 광고 2배 버튼은 계획 2.
 * 창이 떠 있는 동안: 저장 보류(받기 전에 닫아도 다음에 다시 받게), 이동 잠금. 창을 띄웠으면 true.
 */
export function showOfflineReward(game: Game, ui: HTMLElement, now: number): boolean {
  const r = offlineReward(game.state, now);
  if (r.seconds < MIN_SEC || !(r.coins > 0)) return false;
  game.saver.hold = true;
  const wrap = el('div', 'result-wrap ui-on in');
  // 창이 열린 동안 키보드로도 못 움직이게 (moveLock을 계속 0보다 크게, 닫히면 아무것도 안 함)
  game.moveLock = Math.max(game.moveLock, 0.1);
  game.onTick(() => { if (wrap.isConnected) game.moveLock = Math.max(game.moveLock, 0.1); });
  const card = el('div', 'result-card');
  card.append(el('div', 'result-title', t('off.title')), el('div', 'result-tip', t('off.body', { t: durationText(r.seconds) })));
  const coin = el('div', 'result-coins');
  coin.append(icon('coin', 'big'), el('span', '', `+${formatNum(r.coins)}`));
  card.append(coin, button(t('off.claim'), () => {
    if (!wrap.isConnected) return;
    wrap.remove();
    game.saver.hold = false;
    game.setState(addCoins(game.state, r.coins), true);
  }, 'btn big'));
  wrap.append(card);
  ui.append(wrap);
  return true;
}
