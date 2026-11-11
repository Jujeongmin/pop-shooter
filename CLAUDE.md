# POP Shooter

방치형 성장 + 환생 슈팅 (three.js, 바닐라 TS). 설계: `docs/superpowers/specs/2026-11-11-pop-shooter-design.md`.

## 배포 (Verse8)

- 이 폴더가 Verse8 원본. 원격 `gitlab` = `gitlab.verse8.io/anjshdkdl99/game-shooter`. **`develop`에 푸시하면 자동 배포.** 작업이 끝날 때마다 푸시 (사용자 2026-11-11).
- 토큰은 `.git/config` 원격 주소에만. 문서·커밋·채팅에 쓰지 않음.
- 푸시 전: `npm test`, `npm run typecheck`, `npm run build` 후 `dist/index.html`에 `GAME_SIZE_RESPONSE` 있는지, 서버 바꿨으면 `cd server && npx -y @agent8/gameserver-node test`.
- 지우면 안 되는 것: `.agent8.lock`, `.env`(플랫폼 관리), `committedAt`, `index.html`의 `GAME_SIZE_RESPONSE` 스크립트, `vite.config.ts`의 `base: './'`·`css.postcss: {}`.
- Verse8 템플릿의 React/Tailwind/PostCSS 파일은 쓰지 않음 (다시 들어오면 지울 것).

## 저장

- 원본 = 서버 계정 저장 (`server/src/server.ts` `saveLoad`·`saveWrite`, 글로벌 사용자 상태 `save`). 사본 = localStorage 계정별 키 (`src/save/localSave.ts` `pickSave`).
- 위치·전투 중 상태는 저장 안 함: 다시 켜면 광장 시작 지점, 끝나지 않은 연속 도전은 버려짐.
- 개발 서버는 `<verse>-preview`에 붙음 (develop 배포 후 생김). 연결 안 되면 기기 저장으로 계속.

## 개발

- 개발 서버 포트 5220 (`.claude/launch.json` `dev`).
- 밸런스: `npm run sim`, `node tools/sim/check.ts` (목표 시간 범위). `--fit`은 연속 도전 규칙에서 값이 튀어 쓰지 않음.
- 웹 게임 메모리 체크리스트(`~/.claude/web-game-memory-checklist.md`) 따름.
