# VXShop 상품 등록 목록 (2026-11-12 팝젬 단일 화폐)

VX로 파는 것은 **팝젬 묶음 3개뿐**이다. 공격력 패스·유료 캐릭터는 게임 상점에서 팝젬으로 산다(서버 `gemBuy`, `src/sim/premium.ts` `GEM_ITEMS`). 대시보드에 예전 `pass_x*`·`char_*` 상품을 만들었다면 지우거나 판매 중지한다(서버가 지급하지 않음).

Verse8 대시보드 VXShop에 아래 **상품 ID 그대로** 등록한다. 지급은 서버 `$onItemPurchased`(`PRODUCTS`)가 하므로 ID가 다르면 지급되지 않는다. 가격은 대시보드 값이 게임에 그대로 보인다(못 받으면 구매 버튼 꺼짐). 묶음 할인 없음: 1 VX = 팝젬 1개.

| 상품 ID | 내용 | 가격 | 종류 |
|---|---|---|---|
| `gems_s` | 팝젬 100개 | 100 VX | 반복 구매 (수량만큼 곱해 지급) |
| `gems_m` | 팝젬 500개 | 500 VX | 반복 구매 |
| `gems_l` | 팝젬 1000개 | 1000 VX | 반복 구매 |

## 팝젬 가격표 (게임 안, 코드 `GEM_ITEMS`)

| 물건 | 팝젬 |
|---|---|
| 공격력 패스 1~6단계 (순서대로만, 단계마다 피해 ×2) | 100 / 200 / 400 / 700 / 1200 / 2000 (합계 4600) |
| 캐릭터 SHONI / BAM | 300 / 500 |
| 골드 2배 30분 | 20 |
| 환생 조건 건너뛰기 | 환생 횟수에 따라 (`skipRebirthGems`) |

무과금 팝젬은 거의 없다: 출석 7일째 10개, 월드 대장 첫 클리어 10개(월드 8개 = 80개). 환생·광고로는 팝젬을 주지 않는다.

## 리워드 광고 (placementId)

- `popshooter_boost`: 골드 2배 15분 (누적 최대 2시간, 하루 8회)
- `popshooter_offline`: 오프라인 보상 2배 (하루 10회)

광고 보상은 서버 `adClaim`이 Verse8 광고 검증 주소(`ads-verifier.verse8.io`)로 확인하고, 광고 id는 한 번만 인정한다. (예전 `popshooter_gift` 팝젬 선물 광고는 없앰)

## 수동 확인 (배포 후)

1. Verse8 에디터에서 서버 재배포 → 게임 새로고침.
2. HUD [상점] → 팝젬 탭 가격이 대시보드 값(100·500·1000 VX)으로 보이는지.
3. 팝젬 묶음 하나 구매 → 15초 안에 팝젬이 늘어나는지, 새로고침 뒤에도 유지되는지.
4. 공격력 패스 탭 → 1단계만 팝젬 가격 버튼, 사면 '보유' + 2단계 버튼, 피해가 2배인지. 팝젬이 모자라면 [팝젬 충전] → 팝젬 탭.
5. 캐릭터 탭 → SHONI 300 / BAM 500 팝젬으로 사면 캐릭터 발판에서 고를 수 있는지.
6. 무료 탭 광고 → 골드 2배 시간이 HUD에 뜨는지.
7. 1분 넘게 끄고 다시 켜서 오프라인 창 [광고 보고 2배] → 골드·훈련이 2배로 들어오고 저장이 잘리지 않는지.

## 등록 양식 값 (복사해서 붙여 넣기)

공통: Product ID는 정확히 같게. Stock Quantity는 넣을 수 있는 가장 큰 값(0이 되면 판매 중단). Purchase Constraints 없음(반복 구매). Metadata 비움(게임이 안 읽음). Period Limit·Time-Limited Sale은 쓰지 않음. 이미지: `art-src/vxshop/<Product ID>.png`.

### gems_s

- Price (VX): 100

Product Name
```
팝젬 100개 / 100 Pop Gems
```

Description
```
공격력 패스·캐릭터·골드 2배에 쓰는 팝젬 100개
100 Pop Gems for Attack Passes, heroes and Gold x2
```

### gems_m

- Price (VX): 500

Product Name
```
팝젬 500개 / 500 Pop Gems
```

Description
```
공격력 패스·캐릭터·골드 2배에 쓰는 팝젬 500개
500 Pop Gems for Attack Passes, heroes and Gold x2
```

### gems_l

- Price (VX): 1000

Product Name
```
팝젬 1000개 / 1000 Pop Gems
```

Description
```
공격력 패스·캐릭터·골드 2배에 쓰는 팝젬 1000개
1000 Pop Gems for Attack Passes, heroes and Gold x2
```
