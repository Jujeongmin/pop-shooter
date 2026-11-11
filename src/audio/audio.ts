import { AudioManager } from './AudioManager';

/** 게임 전체가 쓰는 소리 관리자 하나 (첫 입력 때 main.ts의 attachUnlock이 켬) */
export const audio = new AudioManager();
