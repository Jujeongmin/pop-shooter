// 사운드 설정: 효과음 종류·음량·동시 재생 제한, 배경음 (pop-battle의 오디오 구조를 가져와 줄임).
// 총소리·보스 쓰러짐·타격은 녹음 파일(짧은 mp3 → 디코드), 나머지 효과음과 배경음은 코드 합성 (audio/sfxBank.ts · audio/musicTracks.ts).
// 오디오가 처음 켜질 때(첫 사용자 입력) 한 번 버퍼로 만들어 두고 재생 때는 버퍼만 재사용한다.
import type { GunModel } from '../sim/guns.ts';

export type SoundId =
  | 'firePistol'
  | 'fireRifle'
  | 'fireShotgun'
  | 'fireSniper'
  | 'coin'
  | 'zoneLand'
  | 'upgrade'
  | 'gunBuy'
  | 'rebirth'
  | 'bossHit'
  | 'bossDown'
  | 'bossThrow'
  | 'playerHit'
  | 'win'
  | 'lose'
  | 'uiTick'
  | 'step'
  | 'travel'
  | 'cheer';

export type MusicId = 'hub' | 'battle';

export interface SoundSpec {
  /** 같은 채널 동시 재생 수 (넘치면 새 소리를 건너뜀) */
  voices: number;
  /** 같은 채널 최소 재생 간격 (s) */
  minInterval: number;
  /** 음량 (합성 버퍼는 최고점 0.9로 맞춰 둠 → 여기서 종류별 크기) */
  gain: number;
  /** 재생할 때마다 음 높이 ±비율 */
  jitter: number;
}

const s = (voices: number, minInterval: number, gain: number, jitter = 0): SoundSpec => ({ voices, minInterval, gain, jitter });

export const SOUNDS: Record<SoundId, SoundSpec> = {
  // 총소리: 한 프레임에 여러 발이어도 한 번 (minInterval), 동시에 최대 4
  firePistol: s(4, 0.05, 0.3, 0.05),
  fireRifle: s(4, 0.05, 0.34, 0.04),
  fireShotgun: s(4, 0.08, 0.42, 0.03),
  fireSniper: s(4, 0.1, 0.44, 0.02),
  coin: s(2, 0.25, 0.16, 0.05),
  zoneLand: s(1, 0.3, 0.34),
  upgrade: s(2, 0.08, 0.32, 0.03),
  gunBuy: s(1, 0.2, 0.36),
  rebirth: s(1, 0.5, 0.4),
  bossHit: s(2, 0.12, 0.2, 0.08),
  bossDown: s(1, 0.3, 0.4),
  bossThrow: s(2, 0.2, 0.16, 0.05),
  playerHit: s(2, 0.15, 0.3, 0.04),
  win: s(1, 1, 0.4),
  lose: s(1, 1, 0.36),
  uiTick: s(1, 0.05, 0.2),
  // 러닝머신 발소리 (초당 2번 이상, 작게), 월드 이동 "슈웅", 월드 클리어 만세 "빠바밤"
  step: s(2, 0.12, 0.12, 0.08),
  travel: s(1, 0.5, 0.38),
  cheer: s(1, 1, 0.4),
};

const base = import.meta.env.BASE_URL;

/**
 * 녹음 파일 효과음 (public/assets/audio/sfx/<id>.mp3, pop-battle에서 가져옴: Mixkit 원본을 자르고 정규화)과 음량 보정.
 * SOUNDS의 gain·동시 재생 제한은 그대로 곱해짐. 파일을 못 받으면 그 소리만 안 남
 */
const FILE_GAIN = {
  firePistol: 0.91,
  fireRifle: 0.51,
  fireShotgun: 0.61,
  fireSniper: 0.5,
  bossHit: 1.64,
  bossDown: 1.46,
} as const;
export type FileSoundId = keyof typeof FILE_GAIN;
export type SynthSoundId = Exclude<SoundId, FileSoundId>;

/** 파일 이름은 pop-battle 것을 그대로 (impact = 탄착, kill = 처치) */
const FILE_NAME: Record<FileSoundId, string> = {
  firePistol: 'firePistol',
  fireRifle: 'fireRifle',
  fireShotgun: 'fireShotgun',
  fireSniper: 'fireSniper',
  bossHit: 'impact',
  bossDown: 'kill',
};

export const SFX_FILES = Object.fromEntries(
  Object.entries(FILE_GAIN).map(([id, gain]) => [id, { url: `${base}assets/audio/sfx/${FILE_NAME[id as FileSoundId]}.mp3`, gain }]),
) as Record<FileSoundId, { url: string; gain: number }>;

/** 총 모델 → 발사음 */
export const FIRE_SOUND: Record<GunModel, SoundId> = {
  pistol: 'firePistol',
  rifle: 'fireRifle',
  shotgun: 'fireShotgun',
  sniper: 'fireSniper',
};

/** 배경음: 곡별 음량 (전투는 효과음을 가리지 않게 낮게) */
export const MUSIC: Record<MusicId, { gain: number }> = {
  hub: { gain: 0.5 },
  battle: { gain: 0.32 },
};

export const MIX = {
  /** 배경음 바꿀 때 페이드 (s) */
  musicFade: 0.8,
  /** 합성 효과음 샘플레이트 (작은 버퍼, 재생 때 자동 변환) */
  sfxRate: 32000,
  /** 배경음: 모노 24kHz (곡당 약 3MB — 짧은 합성 반복곡, 모바일 고려) */
  musicRate: 24000,
  musicChannels: 1,
};

/** 설정 저장 키 (localStorage) */
export const AUDIO_STORAGE_KEY = 'pop-shooter.audio';
