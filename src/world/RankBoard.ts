import * as THREE from 'three';
import { fontFamily, t } from '../i18n/i18n';
import type { LobbyApi } from '../net/LobbyApi';
import { safeDisplayNick } from '../net/shared/nickFilter.ts';
import type { RankBoard as RankData, RankRow } from '../net/shared/rank.ts';
import { formatNum } from '../sim/format.ts';
import { stageLabel } from '../sim/stages.ts';
import type { Collider } from './movement';

const W = 1024;
const H = 720;
/** 판 크기(m) */
const BW = 5.2;
/** 판 아래 높이(m): 따라가는 카메라에서 판 전체가 보이게 낮게 */
const BASE_Y = 0.8;
const BH = BW * (H / W);
const REFRESH_MS = 30_000;
const INK = '#2b3a67';
const MEDAL = ['#ffd34d', '#c9d2ea', '#e8a066'];
const BLOCKS = ['#ff9ec4', '#7cc4ff', '#ffd34d', '#7fd78a', '#b9a6ff', '#ff8a5b'];

/**
 * 광장 3D 기록판: 장난감 블록 테두리 + 다리 + 캔버스 판. 상위 10명(환생 → 최고 스테이지 → 공격력) + 내 순위.
 * 30초마다·내 저장 뒤 조금 있다가 서버(rankTop)에서 받아, 내용이 바뀔 때만 다시 그림. 닉네임 글자는 글꼴 묶음을 먼저 받고 그림.
 * 서버 없으면 "아직 기록이 없어요". 소유: 캔버스 텍스처·geometry·material (광장과 수명 같음, dispose()).
 */
export class RankBoard {
  readonly root = new THREE.Group();
  readonly collider: Collider;
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly tex: THREE.CanvasTexture;
  private readonly owned: { dispose(): void }[] = [];
  private readonly api: LobbyApi | null;
  private lastKey = '';
  private timer = 0;
  private soonTimer = 0;

  constructor(x: number, z: number, api: LobbyApi | null) {
    this.api = api;
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    const planeGeo = new THREE.PlaneGeometry(BW, BH);
    const planeMat = new THREE.MeshBasicMaterial({ map: this.tex });
    this.owned.push(this.tex, planeGeo, planeMat);
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.position.set(0, BASE_Y + BH / 2, 0.08);
    this.root.add(plane);
    // 뒷판 + 장난감 블록 테두리 + 다리 두 개
    const back = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.3, BH + 0.3, 0.14), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }));
    this.owned.push(back.geometry, back.material as THREE.Material);
    back.position.set(0, BASE_Y + BH / 2, 0);
    back.castShadow = true;
    this.root.add(back);
    const blockGeo = new THREE.BoxGeometry(0.5, 0.32, 0.3);
    const blockMats = BLOCKS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }));
    this.owned.push(blockGeo, ...blockMats);
    const n = Math.round((BW + 0.6) / 0.52);
    for (let i = 0; i < n; i++) {
      const bx = -BW / 2 - 0.05 + i * 0.52 + 0.25;
      const top = new THREE.Mesh(blockGeo, blockMats[i % BLOCKS.length]);
      top.position.set(bx, BASE_Y + BH + 0.28, 0.02);
      top.castShadow = true;
      this.root.add(top);
    }
    const legGeo = new THREE.CylinderGeometry(0.12, 0.14, BASE_Y + 0.15, 12);
    const legMat = new THREE.MeshStandardMaterial({ color: '#c98a5a', roughness: 0.6 });
    this.owned.push(legGeo, legMat);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(sx * (BW / 2 - 0.4), (BASE_Y + 0.15) / 2, -0.05);
      leg.castShadow = true;
      this.root.add(leg);
    }
    this.root.position.set(x, 0, z);
    this.collider = { kind: 'box', x, z, hx: BW / 2 + 0.2, hz: 0.3 };
    this.draw(null);
    if (api) {
      void this.refresh();
      this.timer = window.setInterval(() => void this.refresh(), REFRESH_MS);
    }
  }

  /** 내 저장 뒤: 조금 있다가 한 번 (연속 저장은 하나로) */
  refreshSoon(): void {
    if (!this.api) return;
    window.clearTimeout(this.soonTimer);
    this.soonTimer = window.setTimeout(() => void this.refresh(), 3000);
  }

  private async refresh(): Promise<void> {
    if (!this.api || document.visibilityState === 'hidden') return;
    try {
      const b = await this.api.rankTop();
      if (!b?.ok) return;
      const key = JSON.stringify(b);
      if (key === this.lastKey) return;
      this.lastKey = key;
      // 닉네임 글자의 글꼴 묶음을 먼저 받음 (캔버스에 기본 글꼴로 구워지지 않게)
      const text = b.rows.map((r) => r.nick ?? '').join('') + (b.mine?.nick ?? '');
      if (text) await Promise.race([document.fonts.load(`40px ${fontFamily}`, text), new Promise((r) => setTimeout(r, 2500))]).catch(() => undefined);
      this.draw(b);
    } catch { /* 서버 없음·잠깐 실패: 다음 갱신 때 */ }
  }

  private name(r: RankRow): string {
    return (r.nick && safeDisplayNick(r.nick)) || t('peer.player');
  }

  private draw(b: RankData | null): void {
    const c = this.ctx;
    c.clearRect(0, 0, W, H);
    // 바탕 + 제목 띠
    c.fillStyle = '#fffaf0';
    c.fillRect(0, 0, W, H);
    c.fillStyle = INK;
    c.beginPath();
    c.roundRect(24, 20, W - 48, 92, 28);
    c.fill();
    c.fillStyle = '#ffffff';
    c.textBaseline = 'middle';
    c.textAlign = 'center';
    c.font = `56px ${fontFamily}`;
    c.fillText(t('rank.title', { w: 1 }), W / 2, 68);
    c.fillStyle = '#8a93b0';
    c.font = `32px ${fontFamily}`;
    c.textAlign = 'right';
    c.fillText(t('rank.cols'), W - 40, 142);
    const rows = b?.rows ?? [];
    if (!rows.length) {
      c.fillStyle = INK;
      c.textAlign = 'center';
      c.font = `46px ${fontFamily}`;
      c.fillText(t('rank.empty'), W / 2, H / 2);
    }
    const top = 182;
    const rowH = 50;
    rows.forEach((r, i) => {
      const y = top + i * rowH;
      if (r.me) {
        c.fillStyle = '#fff2c2';
        c.beginPath();
        c.roundRect(28, y - rowH / 2 + 3, W - 56, rowH - 6, 14);
        c.fill();
      }
      // 순위: 1~3위는 메달 원
      if (i < 3) {
        c.fillStyle = MEDAL[i]!;
        c.beginPath();
        c.arc(64, y, 19, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = INK;
      c.textAlign = 'center';
      c.font = `32px ${fontFamily}`;
      c.fillText(String(i + 1), 64, y + 1);
      c.textAlign = 'left';
      c.font = `42px ${fontFamily}`;
      c.fillText(this.name(r), 104, y + 1, 470);
      c.textAlign = 'right';
      c.font = `38px ${fontFamily}`;
      c.fillStyle = '#7c63e6';
      c.fillText(String(r.rb), 690, y + 1);
      c.fillStyle = INK;
      c.fillText(r.bs > 0 ? stageLabel(r.bs) : '-', 820, y + 1);
      c.fillStyle = '#d9822b';
      c.fillText(formatNum(r.pw), W - 40, y + 1);
    });
    // 아래: 내 순위
    c.fillStyle = INK;
    c.textAlign = 'center';
    c.font = `42px ${fontFamily}`;
    const foot = b && b.myRank > 0 ? t('rank.mine', { n: b.myRank }) : b ? t('rank.none') : '';
    if (foot) c.fillText(foot, W / 2, H - 34);
    this.tex.needsUpdate = true;
  }

  dispose(): void {
    window.clearInterval(this.timer);
    window.clearTimeout(this.soonTimer);
    for (const o of this.owned) o.dispose();
    this.root.removeFromParent();
  }
}
