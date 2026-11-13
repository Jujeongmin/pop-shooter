import type { NicknamePanel } from './NicknamePanel';
import { audio } from '../audio/audio';
import { lang, LANG_NAME, LANGS, setLang, t, type StrKey } from '../i18n/i18n';
import { button, el } from './dom';

/** 설정 창: 소리(전체·효과음·배경음 음량, 음소거; 기기에 저장) + 언어 고르기 (고르면 저장 후 새로고침) */
export class SettingsPanel {
  private readonly root: HTMLDivElement;

  constructor(parent: HTMLElement, guide: { enabled: boolean; setEnabled(on: boolean): void } | null = null, nick: NicknamePanel | null = null, reset: (() => Promise<boolean>) | null = null) {
    this.root = el('div', 'result-wrap ui-on');
    const card = el('div', 'result-card settings');
    card.append(el('div', 'result-title', t('settings.title')));
    const mute = button('', () => { audio.setMuted(!audio.muted); audio.saveSettings(); syncMute(); }, 'btn small mute-btn');
    const syncMute = (): void => {
      mute.textContent = t(audio.muted ? 'settings.soundOff' : 'settings.soundOn');
      mute.classList.toggle('on', audio.muted);
    };
    syncMute();
    // 상황 안내 켜기·끄기
    const guideBtn = button('', () => { if (guide) { guide.setEnabled(!guide.enabled); syncGuide(); } }, 'btn small mute-btn');
    const syncGuide = (): void => {
      guideBtn.textContent = t(guide?.enabled ? 'settings.guideOn' : 'settings.guideOff');
      guideBtn.classList.toggle('on', !guide?.enabled);
    };
    syncGuide();
    guideBtn.hidden = !guide;
    // 닉네임 바꾸기 (서버 연결이 있을 때만)
    const nickBtn = button('', () => { this.close(); nick?.open(); }, 'btn small mute-btn');
    const syncNick = (): void => { nickBtn.textContent = nick?.nick ? t('nick.change', { n: nick.nick }) : t('nick.set'); };
    syncNick();
    nickBtn.hidden = !nick;
    if (nick) nick.onChange = syncNick;
    card.append(
      mute,
      guideBtn,
      nickBtn,
      this.slider('settings.master', audio.masterVolume, (v) => audio.setMaster(v)),
      this.slider('settings.sfx', audio.volume, (v) => audio.setVolume(v), true),
      this.slider('settings.music', audio.musicVolume, (v) => audio.setMusicVolume(v)),
      el('div', 'settings-label', t('settings.lang')),
    );
    const grid = el('div', 'lang-grid');
    for (const l of LANGS) {
      const b = button(LANG_NAME[l], () => { if (l !== lang) setLang(l); else this.close(); }, `btn small lang-btn${l === lang ? ' on' : ''}`);
      b.lang = l;
      grid.append(b);
    }
    // 계정 초기화: 두 번 눌러야 (첫 번째는 확인 문구로 바뀜). 산 것·닉네임은 유지, 기록판에서 빠짐
    const resetBtn = button(t('settings.reset'), () => {
      if (!reset || resetBtn.disabled) return;
      if (!resetBtn.classList.contains('armed')) {
        resetBtn.classList.add('armed');
        resetBtn.textContent = t('settings.resetAsk');
        return;
      }
      resetBtn.disabled = true;
      resetBtn.textContent = t('settings.resetting');
      void reset().then((ok) => {
        if (ok) return;
        resetBtn.disabled = false;
        resetBtn.classList.remove('armed');
        resetBtn.textContent = t('settings.resetFail');
      });
    }, 'btn small reset-btn');
    resetBtn.hidden = !reset;
    // 초기화·닫기 한 줄 (따로 두 줄이면 설정 창이 화면보다 길어져 위가 잘림, 사용자 2026-11-13)
    const foot = el('div', 'settings-foot');
    foot.append(resetBtn, button(t('settings.close'), () => {
      resetBtn.classList.remove('armed');
      resetBtn.textContent = t('settings.reset');
      this.close();
    }, 'btn'));
    card.append(grid, foot);
    this.root.append(card);
    this.root.hidden = true;
    // 바깥 어두운 곳 누르면 닫기
    this.root.addEventListener('pointerup', (e) => { if (e.target === this.root) this.close(); });
    parent.append(this.root);
  }

  /** 음량 슬라이더 한 줄. 움직이는 동안 바로 반영, 놓으면 저장 (효과음은 놓을 때 소리로 확인) */
  private slider(key: StrKey, value: number, apply: (v: number) => void, preview = false): HTMLElement {
    const row = el('label', 'vol-row');
    const input = el('input', 'vol-range ui-on');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.step = '1';
    input.value = String(Math.round(value * 100));
    input.addEventListener('input', () => apply(input.valueAsNumber / 100));
    input.addEventListener('change', () => {
      audio.saveSettings();
      if (preview) audio.play('uiTick');
    });
    row.append(el('span', 'settings-label', t(key)), input);
    return row;
  }

  open(): void {
    this.root.hidden = false;
    this.root.classList.remove('in');
    void this.root.offsetWidth;
    this.root.classList.add('in');
  }

  close(): void {
    this.root.hidden = true;
  }
}
