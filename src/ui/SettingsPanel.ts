import { lang, LANG_NAME, LANGS, setLang, t } from '../i18n/i18n';
import { button, el } from './dom';

/** 설정 창: 언어 고르기 (고르면 저장 후 새로고침) */
export class SettingsPanel {
  private readonly root: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'result-wrap ui-on');
    const card = el('div', 'result-card settings');
    card.append(el('div', 'result-title', t('settings.title')), el('div', 'settings-label', t('settings.lang')));
    const grid = el('div', 'lang-grid');
    for (const l of LANGS) {
      const b = button(LANG_NAME[l], () => { if (l !== lang) setLang(l); else this.close(); }, `btn small lang-btn${l === lang ? ' on' : ''}`);
      b.lang = l;
      grid.append(b);
    }
    card.append(grid, button(t('settings.close'), () => this.close(), 'btn'));
    this.root.append(card);
    this.root.hidden = true;
    // 바깥 어두운 곳 누르면 닫기
    this.root.addEventListener('pointerup', (e) => { if (e.target === this.root) this.close(); });
    parent.append(this.root);
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
