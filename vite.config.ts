import { defineConfig } from 'vite';

export default defineConfig({
  // Verse8 등 하위 경로 배포를 위해 상대 경로로 빌드
  base: './',
  server: { port: 5220, strictPort: true },
  build: { target: 'es2022' },
  // PostCSS 설정 파일을 찾지 않음 (Verse8 템플릿의 Tailwind/PostCSS를 쓰지 않음, 남은 파일 때문에 CSS가 깨지지 않게)
  css: { postcss: {} },
});
