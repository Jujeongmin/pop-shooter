// 효과음 합성 레시피: 장난감 총·버블 느낌 (통통 튀는 소리). pop-battle의 틀을 가져와 이 게임 소리만 남김.
// 레시피마다 길이(len)를 정해 OfflineAudioContext로 한 번 구워 AudioBuffer로 쓴다. r = 시드 난수.
import { MIX, type SynthSoundId } from '../config/audio';
import { noise, normalize, rng, tone } from './synth';

type Recipe = (c: BaseAudioContext, o: AudioNode, r: () => number) => void;

/** 버블 "퐁": 짧게 올라가는 사인 */
function pop(c: BaseAudioContext, o: AudioNode, t: number, f0: number, f1: number, peak: number, decay = 0.05): void {
  tone(c, o, { t, f0, f1, glide: decay * 0.7, decay, peak, attack: 0.002 });
}

/** 플라스틱 딸깍 */
function click(c: BaseAudioContext, o: AudioNode, t: number, freq: number, peak: number): void {
  noise(c, o, { t, decay: 0.014, peak, filter: 'bandpass', f0: freq, q: 5 });
}

const RECIPES: Record<SynthSoundId, { len: number; make: Recipe }> = {
  // 러닝머신 발소리 "톡": 낮은 고무 바닥 소리 + 벨트 쓸림
  step: {
    len: 0.16,
    make: (c, o) => {
      tone(c, o, { t: 0, f0: 140, f1: 70, glide: 0.05, decay: 0.07, peak: 0.7 });
      noise(c, o, { t: 0, decay: 0.05, peak: 0.25, filter: 'lowpass', f0: 900 });
    },
  },
  // 월드 이동 "슈웅 띵": 내려가는 바람 + 올라가는 종 두 개 (환생 소리와 다르게 짧게)
  travel: {
    len: 0.9,
    make: (c, o) => {
      noise(c, o, { t: 0, attack: 0.08, decay: 0.3, peak: 0.45, filter: 'bandpass', f0: 3000, f1: 400, q: 1.4 });
      tone(c, o, { t: 0, f0: 900, f1: 260, glide: 0.3, decay: 0.3, peak: 0.25 });
      [988, 1480].forEach((f, i) => tone(c, o, { t: 0.36 + i * 0.1, type: 'triangle', f0: f, decay: 0.35, peak: 0.38 }));
      tone(c, o, { t: 0.46, f0: 2960, decay: 0.3, peak: 0.08 });
    },
  },
  // 월드 클리어 만세 "빠바밤!": 팡파르 세 음 + 폭죽 터짐
  cheer: {
    len: 1.1,
    make: (c, o) => {
      noise(c, o, { t: 0, decay: 0.08, peak: 0.5, filter: 'highpass', f0: 2500 });
      [[523, 0.1], [659, 0.1], [784, 0.12], [1047, 0.5]].forEach(([f, d], i) => {
        tone(c, o, { t: 0.08 + i * 0.11, type: 'square', f0: f!, decay: d!, peak: 0.22, lowpass: 3000 });
        tone(c, o, { t: 0.08 + i * 0.11, type: 'triangle', f0: f!, decay: d!, peak: 0.3 });
      });
      for (let k = 0; k < 6; k++) tone(c, o, { t: 0.5 + k * 0.05, f0: 2000 + k * 260, decay: 0.12, peak: 0.07 });
    },
  },
  // 코인 "찰랑": 높은 두 음 (작고 짧게, 자주 나도 거슬리지 않게)
  coin: {
    len: 0.26,
    make: (c, o) => {
      tone(c, o, { t: 0, type: 'triangle', f0: 1760, decay: 0.07, peak: 0.5 });
      tone(c, o, { t: 0.06, type: 'triangle', f0: 2349, decay: 0.16, peak: 0.45 });
      tone(c, o, { t: 0.06, f0: 4698, decay: 0.05, peak: 0.06 });
    },
  },
  // 구역 착지 "뿅 쿵": 올라가는 뿅 + 바닥 닿는 톡
  zoneLand: {
    len: 0.42,
    make: (c, o) => {
      tone(c, o, { t: 0, f0: 320, f1: 760, glide: 0.1, decay: 0.12, peak: 0.45 });
      tone(c, o, { t: 0.2, f0: 190, f1: 90, glide: 0.08, decay: 0.12, peak: 0.8 });
      noise(c, o, { t: 0.2, decay: 0.05, peak: 0.3, filter: 'lowpass', f0: 1200 });
      pop(c, o, 0.24, 900, 1500, 0.35, 0.08);
    },
  },
  // 업그레이드 "띠링": 올라가는 세 음
  upgrade: {
    len: 0.5,
    make: (c, o) => {
      [784, 988, 1319].forEach((f, i) => {
        tone(c, o, { t: i * 0.06, type: 'triangle', f0: f, decay: i === 2 ? 0.28 : 0.1, peak: 0.45 });
        tone(c, o, { t: i * 0.06, type: 'square', f0: f / 2, decay: 0.06, peak: 0.06, lowpass: 2200 });
      });
      noise(c, o, { t: 0.12, decay: 0.2, peak: 0.07, filter: 'highpass', f0: 6000 });
    },
  },
  // 총 구입 "철컥 짜잔"
  gunBuy: {
    len: 0.7,
    make: (c, o) => {
      click(c, o, 0, 2400, 0.8);
      click(c, o, 0.05, 1600, 0.7);
      [523, 659, 784, 1047].forEach((f, i) => tone(c, o, { t: 0.1 + i * 0.07, type: 'triangle', f0: f, decay: i === 3 ? 0.4 : 0.12, peak: 0.4 }));
      [2093, 2637].forEach((f, i) => tone(c, o, { t: 0.4 + i * 0.07, f0: f, decay: 0.22, peak: 0.1 }));
    },
  },
  // 환생 "슈우웅 반짝": 올라가는 쓸림 + 아르페지오
  rebirth: {
    len: 1.3,
    make: (c, o) => {
      noise(c, o, { t: 0, attack: 0.3, decay: 0.15, peak: 0.4, filter: 'bandpass', f0: 300, f1: 4000, q: 1.2 });
      tone(c, o, { t: 0, f0: 200, f1: 900, glide: 0.4, attack: 0.3, decay: 0.15, peak: 0.3 });
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(c, o, { t: 0.4 + i * 0.07, type: 'triangle', f0: f, decay: 0.35, peak: 0.32 }));
      [2093, 2637, 3136].forEach((f, i) => tone(c, o, { t: 0.7 + i * 0.08, f0: f, decay: 0.4, peak: 0.1 }));
    },
  },
  // 보스가 던짐 "휙"
  bossThrow: {
    len: 0.22,
    make: (c, o) => {
      noise(c, o, { t: 0, attack: 0.05, decay: 0.12, peak: 0.5, filter: 'bandpass', f0: 500, f1: 1800, q: 1.4 });
    },
  },
  // 내가 맞음 "뿍": 낮게 눌리는 고무 소리
  playerHit: {
    len: 0.24,
    make: (c, o) => {
      tone(c, o, { t: 0, f0: 260, f1: 110, glide: 0.1, decay: 0.16, peak: 0.8 });
      tone(c, o, { t: 0, type: 'triangle', f0: 520, f1: 240, glide: 0.08, decay: 0.08, peak: 0.25 });
      noise(c, o, { t: 0, decay: 0.04, peak: 0.3, filter: 'lowpass', f0: 1400 });
    },
  },
  // 승리 징글: 도미솔도 + 반짝
  win: {
    len: 1.7,
    make: (c, o) => {
      const notes = [523, 659, 784, 1047];
      notes.forEach((f, i) => {
        const last = i === notes.length - 1;
        tone(c, o, { t: i * 0.12, type: 'triangle', f0: f, hold: last ? 0.35 : 0.04, decay: last ? 0.8 : 0.12, peak: 0.45 });
        tone(c, o, { t: i * 0.12, type: 'square', f0: f, hold: last ? 0.3 : 0.03, decay: last ? 0.5 : 0.08, peak: 0.1, lowpass: 3000 });
      });
      [2093, 2637, 3136].forEach((f, i) => tone(c, o, { t: 0.5 + i * 0.08, f0: f, decay: 0.3, peak: 0.12 }));
    },
  },
  // 패배 "뿌우우": 내려가는 장난스러운 네 음 (무겁지 않게)
  lose: {
    len: 1.5,
    make: (c, o) => {
      const notes = [392, 370, 349, 330];
      notes.forEach((f, i) => {
        const last = i === notes.length - 1;
        tone(c, o, { t: i * 0.22, type: 'sawtooth', f0: f, hold: last ? 0.35 : 0.1, decay: last ? 0.5 : 0.1, peak: 0.3, lowpass: 900, vibrato: last ? [6, 8] : undefined });
      });
    },
  },
  // 설정 슬라이더 확인용 "톡"
  uiTick: {
    len: 0.06,
    make: (c, o, r) => {
      pop(c, o, 0, 950 + r() * 40, 1350, 0.6, 0.035);
      click(c, o, 0, 3500, 0.12);
    },
  },
};

/** 효과음 하나를 굽는다 */
export async function renderSfx(id: SynthSoundId): Promise<AudioBuffer> {
  const rec = RECIPES[id];
  const rate = MIX.sfxRate;
  const ctx = new OfflineAudioContext(1, Math.ceil(rec.len * rate), rate);
  const seed = [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  rec.make(ctx, ctx.destination, rng(seed));
  return normalize(await ctx.startRendering());
}
