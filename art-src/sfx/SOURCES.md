# 효과음 출처 (2026-11-12)

Pixabay Content License (무료, 상업적 사용 가능, 출처 표기 필요 없음). 곡 페이지에 "AI generated" 표시가 없는 것만 골랐다.
원본 = `<id>_pixabay-<번호>.mp3`, 주소 목록 = `list.txt` (id | 번호 | 페이지 | 받은 파일).
게임용 변환: `python tools/audio/sfx_to_game.py` → `public/assets/audio/sfx/<id>.mp3` (앞 무음·길이 정리, 최고점 -1 dBFS, 모노 96kbps).
총소리 4종·보스 맞음·쓰러짐(impact, kill)은 팝배틀에서 가져온 Mixkit·Pixabay 녹음 (pop-battle/art-src/sfx-mixkit, sfx-pixabay).

| id | 쓰는 곳 | 소리 |
|---|---|---|
| coin | 골드·동전 분수 | Collect Points – Liecio |
| zoneLand | 시설 착지 | Pop Cartoon – CreatorsHome |
| upgrade | 업그레이드 | Level Up 06 – Universfield |
| gunBuy | 총 구매 | Cash Register Kaching – DRAGON-STUDIO |
| rebirth | 환생 | Magic Spell 02 – Universfield |
| bossThrow | 보스가 던짐 | Movement Swipe Whoosh 3 – floraphonic |
| playerHit | 내가 맞음 | Cartoon Impact 02 – Universfield |
| win | 승리 | Victory Fanfare – Universfield |
| lose | 패배 | Funny Fail 02 – Universfield |
| uiTick | UI 누름 | Soft UI Pop – humordome (첫 클릭만) |
| step | 러닝머신 발소리 | walk for cartoon – freesound_community (첫 발자국만) |
| travel | 월드 이동 | Magic Teleport Whoosh – Universfield |
| cheer | 월드 클리어 만세 | Cartoon Yay – Shut_Up_Ghost |
