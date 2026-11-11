# POP Shooter 계획 2: 멀티 광장 + 3D 기록판

설계 문서: `docs/superpowers/specs/2026-11-11-pop-shooter-design.md` 7장(멀티플레이). 사용자 추가 요구(2026-11-11): 경쟁 심리가 결제로 이어지게, **광장에 눈에 보이는 3D 랭킹판**.

## 목표

같은 월드 광장에 다른 플레이어가 보이고(캐릭터·든 총·이름표·훈련 발사), 채팅을 하고, 광장 안 큰 판에서 순위를 본다. 전투·훈련은 혼자. 멀티 층은 꺼져도(서버 연결 실패, 이식) 게임 전체가 돈다.

## Global Constraints

- 재사용: pop-battle `src/net/NetClient.ts`·`LobbyHub.ts`·`LobbyPeers.ts`·`nickname.ts`·`ChatService.ts`·`shared/nickFilter.ts`·`shared/chatFilter.ts`·`shared/chat.ts`와 서버 hub*/nick*/chatSay. **복사해서 고침**(공유 패키지 아님).
- SDK 연결은 계정당 하나: `CloudSave`(계정 저장)와 멀티가 같은 `GameServer` 연결을 쓴다.
- 서버 규칙(verse8-upload 스킬 4장): 계정은 `$sender.account`만, 모든 인자 검사(형식·범위·빈도·속도), 같은 계정 동시 갱신은 `$lock`, `$`로 시작하는 함수는 클라이언트용 아님, 문서 1MB·인덱스 4만 한도(다건은 `$collection`).
- 룸: 월드별 로비 룸 `w1-N`(정원 8), 장부 방식은 pop-battle `hub_book`.
- 메모리 체크리스트: 남의 아바타는 SkinnedMesh 복제 → 나갈 때 `skeleton.dispose()`, 이름표 캔버스 텍스처 dispose, 기록판 텍스처는 바뀔 때만 다시 그림.
- 모든 새 문구 5개 언어(i18n.ts).
- 기록판은 클라이언트 저장 기반이라 화면 표기는 "기록판"(공식 랭킹 아님). 코인 증가 상한 검사는 계획 3.

## Tasks

### M1: 연결 하나로 합치기
`src/net/NetClient.ts`(pop-battle에서 복사, 로비에 필요한 것만) + `CloudSave`가 그 연결을 씀. 연결 실패 = 혼자 모드.

### M2: 서버 로비·닉네임·채팅
`server/src/server.ts`에 hubFind·hubHello·hubInfo·hubMove·hubState·hubBye·onRoomLeave, nickGet·nickSet, chatSay 이식. 보이는 정보: 캐릭터, 총 index, 닉네임, 환생 횟수, 공격력(표시용), 상태(광장/훈련/전투). 서버 하네스 테스트.

### M3: 남의 플레이어 표시
`LobbyHub`(세션) + `LobbyPeers`(보간·표시). 아바타 + 든 총 + 머리 위 이름표(닉네임 · 환생 N · 공격력). 훈련 중이면 사격장 판 위에서 발사 연출, 전투 중이면 포털 앞에 서서 이름표 "전투 중". 위치 전송 빈도·보간은 pop-battle 값. 플레이어끼리 충돌 없음, 겹쳐도 됨(사격장 착지 자리도 남을 피하지 않고 무작위 그대로, 사용자 2026-11-11).

### M4: 닉네임·채팅 UI
첫 접속 닉네임 정하기(필터), 채팅 입력·말풍선·채팅창(모바일 키보드 iframe 함정 주의).

### M5: 3D 기록판
서버: `saveWrite` 때 `$collection` 기록 한 줄 갱신(닉네임·환생·최고 스테이지·공격력·캐릭터), `rankTop()` = 환생 → 최고 스테이지 → 공격력 상위 10 + 내 순위. 클라이언트: 광장 북동쪽에 큰 판(장난감 블록 테두리, 캔버스 텍스처), 30초마다·내 기록이 바뀔 때 갱신, 1~3위 왕관·색, 내 줄 강조, 판 앞 구역에 들어가면 자세히 보기(선택).

### M6: 확인·배포
두 계정(`?account=a`/`b`, 개발 서버)으로 서로 보임·채팅·기록판 확인, 연결 끊김 → 혼자 모드 유지, 메모리(사람 10번 들어왔다 나감 → textures 원래대로), 푸시.
