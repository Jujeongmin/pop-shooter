import { t, type StrKey } from '../i18n/i18n';
import type { LobbyApi, NickSetResult } from '../net/LobbyApi';
import type { NetClient } from '../net/NetClient';
import { loadNickname, saveNickname } from '../net/nickname';
import { checkNickname, NICK_RULE } from '../net/shared/nickFilter.ts';
import { button, el, setText } from './dom';

const REASON: Record<string, StrKey> = {
  empty: 'nick.err.empty',
  length: 'nick.err.length',
  chars: 'nick.err.chars',
  blocked: 'nick.err.blocked',
  taken: 'nick.err.taken',
  rate: 'nick.err.rate',
  net: 'nick.err.net',
};

/**
 * 닉네임 정하기 창 (서버가 최종 검사: 길이·허용 문자·금칙어·중복·변경 간격).
 * - 서버에 연결되면 nickGet → 없거나(첫 접속) 지금 규칙에 걸리면(mustChange) 자동으로 열림.
 * - 설정 창의 [닉네임 바꾸기]로도 열림.
 * 입력 중 키보드(WASD)는 Controls가 input 대상이면 무시. 모바일 키보드로 화면이 줄어드는 동안은 Stage3D가 크기를 고정.
 */
export class NicknamePanel {
  private readonly root: HTMLDivElement;
  private readonly input: HTMLInputElement;
  private readonly err: HTMLDivElement;
  private readonly ok: HTMLButtonElement;
  private readonly cancel: HTMLButtonElement;
  private readonly api: LobbyApi;
  private readonly net: NetClient;
  private busy = false;
  /** 지금 닉네임 (없으면 null) */
  nick: string | null = loadNickname();
  /** 닉네임이 바뀌면 (설정 창 버튼 글자 등) */
  onChange: ((nick: string) => void) | null = null;
  /**
   * 닉네임 확인이 끝남 (이미 있음·방금 정함·서버 없음). 그전에는 다른 자동 창(오늘의 선물)을 띄우지 않음:
   * 선물 창이 먼저 뜨고 닉네임 창이 그 위에 겹쳐 뜨던 것 (사용자 2026-11-13)
   */
  settled = false;

  constructor(parent: HTMLElement, net: NetClient, api: LobbyApi) {
    this.net = net;
    this.api = api;
    this.root = el('div', 'result-wrap ui-on nick-wrap');
    const card = el('div', 'result-card nick-card');
    this.input = el('input', 'nick-input');
    this.input.type = 'text';
    this.input.maxLength = NICK_RULE.max;
    this.input.autocomplete = 'off';
    this.input.spellcheck = false;
    this.input.placeholder = t('nick.placeholder');
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') void this.submit();
    });
    this.input.addEventListener('input', () => setText(this.err, ''));
    this.err = el('div', 'nick-err');
    this.ok = button(t('nick.ok'), () => void this.submit(), 'btn big');
    this.cancel = button(t('settings.close'), () => this.close(), 'btn small');
    const btns = el('div', 'reb-btns');
    btns.append(this.cancel, this.ok);
    card.append(el('div', 'result-title', t('nick.title')), el('div', 'result-tip', t('nick.rule', { min: NICK_RULE.min, max: NICK_RULE.max })), this.input, this.err, btns);
    this.root.append(card);
    this.root.hidden = true;
    parent.append(this.root);
  }

  /** 서버 연결 뒤: 닉네임이 없거나 바꿔야 하면 창을 엶 (첫 접속은 닫기 버튼 없음) */
  async checkOnConnect(): Promise<void> {
    try {
      if (!(await this.net.connect())) return;
      const r = await this.api.nickGet();
      if (r.nick) {
        this.setNick(r.nick);
        return;
      }
      this.open(r.mustChange ? 'nick.err.blocked' : null, true);
    } catch {
      // 서버 없음: 이름표는 '플레이어'로
      this.settled = true;
    }
  }

  open(errKey: StrKey | null = null, required = false): void {
    this.cancel.hidden = required;
    this.input.value = this.nick ?? '';
    setText(this.err, errKey ? t(errKey) : '');
    this.root.hidden = false;
    this.root.classList.remove('in');
    void this.root.offsetWidth;
    this.root.classList.add('in');
    // 모바일에서 바로 키보드가 뜨면 화면이 크게 흔들려서 데스크톱에서만 자동 포커스
    if (window.matchMedia('(pointer: fine)').matches) this.input.focus();
  }

  close(): void {
    this.input.blur();
    this.root.hidden = true;
  }

  private setNick(nick: string): void {
    this.settled = true;
    this.nick = nick;
    saveNickname(nick);
    this.onChange?.(nick);
  }

  private async submit(): Promise<void> {
    if (this.busy) return;
    const c = checkNickname(this.input.value);
    if (!c.ok) {
      setText(this.err, t(REASON[c.reason]!, { min: NICK_RULE.min, max: NICK_RULE.max }));
      return;
    }
    this.busy = true;
    this.ok.disabled = true;
    let r: NickSetResult;
    try {
      r = await this.api.nickSet(c.value);
    } catch {
      r = { ok: false, reason: undefined };
    }
    this.busy = false;
    this.ok.disabled = false;
    if (r.ok) {
      this.setNick(r.nick ?? c.value);
      this.close();
      return;
    }
    const key = REASON[r.reason ?? 'net'] ?? 'nick.err.net';
    setText(this.err, t(key, { min: NICK_RULE.min, max: NICK_RULE.max, s: Math.ceil((r.retryMs ?? 0) / 1000) }));
  }
}
