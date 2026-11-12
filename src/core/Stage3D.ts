import * as THREE from 'three';

/** 폰·태블릿 (터치가 주 입력) */
const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
/**
 * 폰 화질 (사용자 2026-11-12): 해상도 배율 단계. 기기 픽셀 밀도보다 큰 단계는 건너뜀.
 * PC는 예전 그대로 (최대 2배, 자동 조절 없음)
 */
const TOUCH_LEVELS = [1.5, 1.25, 1, 0.85];
/** 자동 조절: 이 초 동안 평균 fps가 아래면 한 단계 낮춤. 낮춰도 안 오르면(기기가 30fps로 묶인 절전 모드 등) 되돌리고 조절 멈춤 */
const ADAPT_SEC = 3;
const ADAPT_FPS = 40;
const ADAPT_GAIN = 4;
/** 첫 셰이더 준비·로딩 동안은 재지 않음 */
const ADAPT_WARMUP_SEC = 6;

/** 렌더러·장면·카메라·조명·RAF 루프 하나 */
export class Stage3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
  private readonly frames: ((dt: number) => void)[] = [];
  private last = 0;
  private raf = 0;
  private readonly onResize = (): void => this.resize();
  /** 터치 기기 해상도 단계 (TOUCH_LEVELS 안 번호), PC는 -1 */
  private level = -1;
  private readonly levels: number[];
  private adaptOn = TOUCH;
  private adaptT = -ADAPT_WARMUP_SEC;
  private adaptFrames = 0;
  /** 마지막으로 낮춘 단계와 그 전 fps (낮춰도 안 오르면 되돌림) */
  private tried: { from: number; fps: number } | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    const dpr = window.devicePixelRatio || 1;
    // 기기 밀도보다 높은 단계는 의미 없음 → 기기 밀도로 자르고 같은 값은 하나로 (밀도 1이면 1 → 0.85)
    this.levels = TOUCH ? TOUCH_LEVELS.map((v) => Math.min(v, dpr)).filter((v, i, a) => a.indexOf(v) === i) : [];
    if (TOUCH) {
      this.level = 0;
      this.renderer.setPixelRatio(this.levels[0]!);
    } else {
      this.renderer.setPixelRatio(Math.min(dpr, 2));
    }
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    // 폰: 부드러운 그림자(여러 번 샘플) 대신 일반 그림자, 그림자 지도도 절반
    this.renderer.shadowMap.type = TOUCH ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color('#bfe3ff');
    this.scene.fog = new THREE.Fog('#bfe3ff', 45, 120);

    const hemi = new THREE.HemisphereLight('#ffffff', '#a8c7a0', 1.6);
    const sun = new THREE.DirectionalLight('#fff4dc', 2.2);
    sun.position.set(18, 30, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(TOUCH ? 1024 : 2048);
    const sc = sun.shadow.camera;
    sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 90;
    sun.shadow.bias = -0.0004;
    this.scene.add(hemi, sun, sun.target);

    window.addEventListener('resize', this.onResize);
    // 입력칸에서 나오면(모바일 키보드 내려감) 고정했던 크기를 다시 맞춤
    window.addEventListener('focusout', () => window.setTimeout(this.onResize, 300));
    this.resize();
  }

  onFrame(cb: (dt: number) => void): void {
    this.frames.push(cb);
  }

  start(): void {
    const loop = (t: number): void => {
      const dt = this.last ? Math.min(0.1, (t - this.last) / 1000) : 0;
      this.last = t;
      for (const f of this.frames) f(dt);
      this.renderer.render(this.scene, this.camera);
      if (this.adaptOn) this.adapt(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** 지금 해상도 배율 (디버그·확인용) */
  get pixelRatio(): number {
    return this.renderer.getPixelRatio();
  }

  /** 폰 해상도 자동 조절 (프레임마다) */
  private adapt(dt: number): void {
    // 탭이 숨거나 오래 멈췄던 프레임(dt 상한)은 버리고 다시 잼
    if (document.hidden || dt >= 0.1 || dt <= 0) { this.adaptT = Math.min(this.adaptT, 0); this.adaptFrames = 0; return; }
    this.adaptT += dt;
    if (this.adaptT <= 0) return;
    this.adaptFrames++;
    if (this.adaptT < ADAPT_SEC) return;
    const fps = this.adaptFrames / this.adaptT;
    this.adaptT = 0;
    this.adaptFrames = 0;
    if (this.tried) {
      const tried = this.tried;
      this.tried = null;
      if (fps < tried.fps + ADAPT_GAIN) {
        // 낮춰도 그대로 = 그래픽 탓이 아님 (화면 주사율·절전 제한) → 되돌리고 그만
        this.setLevel(tried.from);
        this.adaptOn = false;
        return;
      }
    }
    if (fps >= ADAPT_FPS || this.level >= this.levels.length - 1) return;
    this.tried = { from: this.level, fps };
    this.setLevel(this.level + 1);
  }

  private setLevel(i: number): void {
    this.level = i;
    this.renderer.setPixelRatio(this.levels[i]!);
    this.resize();
  }

  private resize(): void {
    // 모바일 키보드가 올라와 화면이 줄어드는 동안(입력칸 포커스)은 크기를 고정 (iframe 화면이 출렁이지 않게)
    if (document.activeElement instanceof HTMLInputElement) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
  }
}
