import { AUDIO_STORAGE_KEY, MIX, MUSIC, MUSIC_FILE, SFX_FILES, SOUNDS, type MusicId, type SoundId, type TrackId } from '../config/audio';

/**
 * 소리 관리 (pop-battle의 AudioManager에서 공간음을 뺀 것). 게임 코드는 play(id) · setMusic(id)만 부른다.
 * - 효과음은 모두 짧은 녹음 파일(mp3 → 디코드, Pixabay·Mixkit): 오디오가 켜질 때 버퍼로 한 번 만들고 재생은 버퍼 재사용
 * - 배경음은 실제 곡 파일(월드별 광장 8곡 + 전투, Pixabay)을 <audio> + MediaElementAudioSourceNode로 스트리밍 (디코드해 메모리에 올리지 않음,
 *   웹게임 메모리 체크리스트). 곡마다 엘리먼트 하나를 재사용(소스 노드는 엘리먼트당 한 번만), 안 쓰는 월드 곡은 src를 비워 버퍼를 놓음.
 *   iOS는 입력 없이 element.play()를 거부 → 첫 입력 때 전투 곡을 소리 0으로 한 번 재생·멈춰 미리 열어 둠 (포털 착지로 전투가 시작돼 입력이 없음)
 * - 버스: 효과음(압축기) · 배경음 → 마스터(음소거) → 출력
 * - 브라우저 자동 재생 정책: 첫 사용자 입력(클릭·터치·키)에서 attachUnlock이 오디오를 켬. 탭이 숨으면 멈춤
 * - 종류(채널)별 동시 재생 수·최소 간격 제한 → 연사해도 겹쳐 커지지 않음
 */
export interface PlayOpts {
  /** 추가 음량 배율 */
  gain?: number;
  /** 동시 재생 제한 채널 (기본 = 소리 id) */
  channel?: string;
  /** 음 높이 배율 */
  pitch?: number;
}


export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private readonly bank = new Map<SoundId, AudioBuffer>();
  /** 곡마다 엘리먼트 하나 (처음 필요할 때 만듦) */
  private readonly tracks = new Map<TrackId, { el: HTMLAudioElement; gain: GainNode; stopT: number }>();
  private current: { id: MusicId; track: TrackId } | null = null;
  private wanted: MusicId | null = null;
  /** 광장 곡 월드 (1~8) */
  private world = 1;
  private readonly active = new Map<string, number>();
  private readonly last = new Map<string, number>();
  private unlockOff: (() => void) | null = null;
  private hidden = false;

  /** 설정값: 마스터 · 효과음 · 배경음 0..1, 음소거 (localStorage에 저장) */
  masterVolume = 0.8;
  volume = 0.6;
  musicVolume = 0.5;
  muted = false;

  constructor() {
    this.loadSettings();
  }

  /** 오디오가 켜져 소리가 나는 상태 */
  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  /** 효과음 버퍼가 준비됨 (테스트·디버그) */
  get ready(): boolean {
    return this.bank.size > 0;
  }

  /** 지금 배경음 */
  get currentMusic(): MusicId | null {
    return this.current?.id ?? null;
  }

  /** 광장 곡 월드 바꾸기 (광장 곡이 나오는 중이면 그 월드 곡으로 넘어감) */
  setWorld(w: number): void {
    const n = Math.max(1, Math.min(8, Math.floor(w)));
    if (n === this.world) return;
    this.world = n;
    if (this.wanted === 'hub' && this.ctx) this.startMusic('hub');
  }

  private trackOf(id: MusicId): TrackId {
    return id === 'battle' ? 'battle' : (`w${this.world}` as TrackId);
  }

  setMaster(v: number): void {
    this.masterVolume = clamp01(v);
    this.applyMaster();
  }

  setMuted(on: boolean): void {
    this.muted = on;
    this.applyMaster();
  }

  /** 효과음 크기 */
  setVolume(v: number): void {
    this.volume = clamp01(v);
    if (this.sfxBus) this.sfxBus.gain.value = this.volume;
  }

  /** 배경음 크기 */
  setMusicVolume(v: number): void {
    this.musicVolume = clamp01(v);
    if (this.musicBus) this.musicBus.gain.value = this.musicVolume;
  }

  saveSettings(): void {
    try {
      localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify({ master: this.masterVolume, sfx: this.volume, music: this.musicVolume, muted: this.muted }));
    } catch {
      // 저장 못 해도 이번 접속에서는 그대로
    }
  }

  private loadSettings(): void {
    try {
      const raw = localStorage.getItem(AUDIO_STORAGE_KEY);
      if (!raw) return;
      const o = JSON.parse(raw) as Partial<Record<'master' | 'sfx' | 'music', unknown>> & { muted?: unknown };
      const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp01(v) : d);
      this.masterVolume = num(o.master, this.masterVolume);
      this.volume = num(o.sfx, this.volume);
      this.musicVolume = num(o.music, this.musicVolume);
      this.muted = o.muted === true;
    } catch {
      // 없거나 깨졌으면 기본값
    }
  }

  /**
   * 첫 사용자 입력에서 오디오를 켬 (모바일 자동 재생 제한). 입력마다 멈춘 오디오를 다시 깨움 (iOS 전화·다른 앱 뒤)
   * + 탭이 숨으면 멈추고 돌아오면 다시 켬
   */
  attachUnlock(target: Window): void {
    if (this.unlockOff) return;
    const on = () => this.unlock();
    const opts = { capture: true, passive: true } as const;
    const types = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'] as const;
    for (const t of types) target.addEventListener(t, on, opts);
    const vis = () => {
      this.hidden = document.hidden;
      if (!this.ctx) return;
      if (this.hidden) {
        void this.ctx.suspend();
        for (const t of this.tracks.values()) t.el.pause();
      } else {
        void this.ctx.resume();
        if (this.current) void this.tracks.get(this.current.track)?.el.play().catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', vis);
    this.unlockOff = () => {
      for (const t of types) target.removeEventListener(t, on, opts);
      document.removeEventListener('visibilitychange', vis);
    };
  }

  /** 사용자 입력 안에서 호출해야 브라우저가 소리를 허용한다 */
  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.connect(ctx.destination);
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 5;
      comp.attack.value = 0.003;
      comp.release.value = 0.15;
      comp.connect(this.master);
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = this.volume;
      this.sfxBus.connect(comp);
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = this.musicVolume;
      this.musicBus.connect(this.master);
      this.applyMaster();
      void this.buildBank();
      // 오디오가 켜지기 전에 정해 둔 곡 시작 + 전투 곡 미리 열기 (iOS: 입력 안에서 한 번 재생해 둬야 나중에 입력 없이 재생됨)
      if (this.wanted) this.startMusic(this.wanted);
      if (this.wanted !== 'battle') this.prime('battle');
    }
    if (this.ctx.state === 'suspended' && !this.hidden) void this.ctx.resume();
  }

  /** 효과음 재생 */
  play(id: SoundId, opts?: PlayOpts): void {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    const buffer = this.bank.get(id);
    if (!ctx || !bus || !buffer || ctx.state !== 'running') return;
    const spec = SOUNDS[id];
    const gain = spec.gain * SFX_FILES[id].gain * (opts?.gain ?? 1);
    if (gain <= 0.004) return;
    const channel = opts?.channel ?? id;
    const now = ctx.currentTime;
    const active = this.active.get(channel) ?? 0;
    if (active >= spec.voices || now - (this.last.get(channel) ?? -1) < spec.minInterval) return;
    this.last.set(channel, now);
    this.active.set(channel, active + 1);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = (opts?.pitch ?? 1) * (1 + (Math.random() * 2 - 1) * spec.jitter);
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(bus);
    src.onended = () => {
      this.active.set(channel, Math.max(0, (this.active.get(channel) ?? 1) - 1));
      src.disconnect();
      g.disconnect();
    };
    src.start(now);
  }

  /**
   * 배경음 바꾸기 (null = 끄기). 같은 곡이면 그대로 이어서. 이전 곡은 페이드아웃, 새 곡은 페이드인.
   * 오디오가 켜지기 전에 불러도 기억해 뒀다가 켜질 때 시작
   */
  setMusic(id: MusicId | null): void {
    if (id === this.wanted) return;
    this.wanted = id;
    if (!id) { this.fadeOutCurrent(); return; }
    if (this.ctx) this.startMusic(id);
  }

  /** 곡 엘리먼트 (없으면 만들어 음악 버스에 연결) */
  private trackEl(track: TrackId): { el: HTMLAudioElement; gain: GainNode; stopT: number } | null {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return null;
    let t = this.tracks.get(track);
    if (!t) {
      const el = new Audio();
      el.crossOrigin = 'anonymous';
      el.loop = true;
      el.preload = 'auto';
      el.setAttribute('playsinline', '');
      el.src = MUSIC_FILE(track);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      ctx.createMediaElementSource(el).connect(gain).connect(this.musicBus);
      t = { el, gain, stopT: 0 };
      this.tracks.set(track, t);
    } else if (!t.el.getAttribute('src')) {
      t.el.src = MUSIC_FILE(track);
    }
    return t;
  }

  /** 입력 안에서 소리 0으로 한 번 재생했다 멈춤 (iOS가 나중에 입력 없이도 재생하게) */
  private prime(id: MusicId): void {
    const track = this.trackOf(id);
    const t = this.trackEl(track);
    if (!t || !t.el.paused) return;
    void t.el.play().then(() => { if (this.current?.track !== track) t.el.pause(); }).catch(() => undefined);
  }

  private startMusic(id: MusicId): void {
    const ctx = this.ctx;
    const track = this.trackOf(id);
    if (!ctx) return;
    if (this.current?.track === track) {
      this.current.id = id;
      return;
    }
    this.fadeOutCurrent();
    const t = this.trackEl(track);
    if (!t) return;
    clearTimeout(t.stopT);
    const now = ctx.currentTime;
    t.gain.gain.cancelScheduledValues(now);
    t.gain.gain.setValueAtTime(t.gain.gain.value, now);
    t.gain.gain.linearRampToValueAtTime(MUSIC[id].gain, now + MIX.musicFade);
    if (!this.hidden) void t.el.play().catch((err) => console.warn(`[audio] 배경음 ${track} 재생 실패`, err));
    this.current = { id, track };
  }

  private fadeOutCurrent(): void {
    const cur = this.current;
    const ctx = this.ctx;
    if (!cur || !ctx) return;
    this.current = null;
    const t = this.tracks.get(cur.track);
    if (!t) return;
    const now = ctx.currentTime;
    t.gain.gain.cancelScheduledValues(now);
    t.gain.gain.setValueAtTime(t.gain.gain.value, now);
    t.gain.gain.linearRampToValueAtTime(0, now + MIX.musicFade);
    // 페이드가 끝나면 멈춤. 월드 광장 곡은 src를 비워 내려받은 버퍼를 놓음 (전투 곡은 자주 쓰니 둠)
    t.stopT = window.setTimeout(() => {
      if (this.current?.track === cur.track) return;
      t.el.pause();
      if (cur.track !== 'battle') {
        t.el.removeAttribute('src');
        t.el.load();
      }
    }, (MIX.musicFade + 0.1) * 1000);
  }

  /** 효과음 전부 준비: 녹음 파일은 받아서 디코드, 나머지는 굽기 (수십 ms) */
  private async buildBank(): Promise<void> {
    const ctx = this.ctx!;
    const ids = Object.keys(SOUNDS) as SoundId[];
    await Promise.all(
      ids.map(async (id) => {
        try {
          const r = await fetch(SFX_FILES[id].url);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          this.bank.set(id, await ctx.decodeAudioData(await r.arrayBuffer()));
        } catch (err) {
          console.warn(`[audio] 효과음 ${id}을 준비하지 못함`, err);
        }
      }),
    );
  }

  private applyMaster(): void {
    if (this.master) this.master.gain.value = this.muted ? 0 : this.masterVolume;
  }

  dispose(): void {
    this.unlockOff?.();
    this.unlockOff = null;
    void this.ctx?.close();
    this.ctx = null;
    this.bank.clear();
    for (const t of this.tracks.values()) { t.el.pause(); t.el.removeAttribute('src'); t.el.load(); }
    this.tracks.clear();
    this.current = null;
  }
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
