# POP Shooter

방치형 성장 + 환생 슈팅 (three.js, 바닐라 TS). 설계: `docs/superpowers/specs/2026-11-11-pop-shooter-design.md`.

## 배포 (Verse8)

- 이 폴더가 Verse8 원본. 원격 `gitlab` = `gitlab.verse8.io/anjshdkdl99/game-shooter`. **`develop`에 푸시하면 자동 배포.** 작업이 끝날 때마다 푸시 (사용자 2026-11-11).
- 토큰은 `.git/config` 원격 주소에만. 문서·커밋·채팅에 쓰지 않음.
- 푸시 전: `npm test`, `npm run typecheck`, `npm run build` 후 `dist/index.html`에 `GAME_SIZE_RESPONSE` 있는지, 서버 바꿨으면 `cd server && npx -y @agent8/gameserver-node test`.
- 지우면 안 되는 것: `.agent8.lock`, `.env`(플랫폼 관리), `committedAt`, `index.html`의 `GAME_SIZE_RESPONSE` 스크립트, `vite.config.ts`의 `base: './'`·`css.postcss: {}`, `src/storageFallback.ts`와 `src/main.ts` 맨 첫 줄 `import './storageFallback'`(localStorage 막힌 iframe에서 SDK가 죽어 검은 화면 나는 것 방지).
- Verse8 템플릿의 React/Tailwind/PostCSS 파일은 쓰지 않음 (다시 들어오면 지울 것).

## 저장

- 원본 = 서버 계정 저장 (`server/src/server.ts` `saveLoad`·`saveWrite`, 글로벌 사용자 상태 `save`). 사본 = localStorage 계정별 키 (`src/save/localSave.ts` `pickSave`).
- 위치·전투 중 상태는 저장 안 함: 다시 켜면 광장 시작 지점, 끝나지 않은 연속 도전은 버려짐.
- 개발 서버는 `<verse>-preview`에 붙음 (develop 배포 후 생김). 연결 안 되면 기기 저장으로 계속.

## 개발

- 개발 서버 포트 5220 (`.claude/launch.json` `dev`).
- 밸런스: `npm run sim`, `node tools/sim/check.ts` (월드 8 대장까지 막힘 없는지만, 플레이 시간 목표로 맞추지 않음 — 사용자 2026-11-12). `node tools/sim/try.ts <월드 체력 배수 8개>`로 값 시험.
- 월드 8개 (2026-11-12): 월드마다 광장 따로 = 시설 자리는 같고 바깥 꾸미기·하늘만 다름 (`world/worldThemes.ts`, `world/HubDecor.ts`, `Game.setWorld`), 월드 이동 정류장 `ui/TravelPanel.ts`, 대장 첫 클리어 시 다음 월드 광장으로. 훈련장 등급 = 지금 광장 월드, 광장 멀티 방도 월드별. 몹: 월드 1 = 장난감 셋 + 곰 왕, 월드 2~8 = 홀수 스테이지 전용 몹 + 대장 전용(`battle/ToyBoss.ts` WORLD_MOBS, 코드 도형).
- 웹 게임 메모리 체크리스트(`~/.claude/web-game-memory-checklist.md`) 따름.
