# VXShop 상품 등록 목록 (계획 3)

Verse8 대시보드 VXShop에 아래 **상품 ID 그대로** 등록한다. 지급은 서버 `$onItemPurchased`(`src/sim/premium.ts` `PRODUCTS`)가 하므로 ID가 다르면 지급되지 않는다. 가격은 대시보드 값이 게임에 그대로 보인다(못 받으면 구매 버튼 꺼짐).

| 상품 ID | 내용 | 종류 | 비고 |
|---|---|---|---|
| `pass_x2` | 공격력 패스 1단계 (피해 ×2, 영구) | 1회 (Lifetime 1) | 순서대로만 구매 (상점은 바로 다음 단계만 구매 버튼) |
| `pass_x4` | 공격력 패스 2단계 (×2 추가, 합계 ×4) | 1회 | 단계마다 피해 ×2가 쌓임, 산 것이 버려지지 않음 |
| `pass_x8` | 공격력 패스 3단계 (합계 ×8) | 1회 | |
| `pass_x16` | 공격력 패스 4단계 (합계 ×16) | 1회 | |
| `pass_x32` | 공격력 패스 5단계 (합계 ×32) | 1회 | |
| `pass_x64` | 공격력 패스 6단계 (합계 ×64) | 1회 | 6단계 전부 4,600 VX |
| `gems_s` | 팝젬 100개 | 반복 구매 | 수량(quantity)만큼 곱해 지급 |
| `gems_m` | 팝젬 550개 | 반복 구매 | |
| `gems_l` | 팝젬 1200개 | 반복 구매 | |
| `char_shoni` | 캐릭터 SHONI (white) | 1회 | |
| `char_bam` | 캐릭터 BAM (black) | 1회 | |

## 리워드 광고 (placementId)

- `popshooter_boost`: 골드 2배 15분 (누적 최대 2시간, 하루 8회)
- `popshooter_offline`: 오프라인 보상 2배 (하루 10회)
- `popshooter_gift`: 하루 선물 팝젬 5개 (하루 5회)

광고 보상은 서버 `adClaim`이 Verse8 광고 검증 주소(`ads-verifier.verse8.io`)로 확인하고, 광고 id는 한 번만 인정한다.

## 수동 확인 (배포 후)

1. Verse8 에디터에서 서버 재배포 → 게임 새로고침.
2. HUD [상점] → 각 탭 가격이 대시보드 값으로 보이는지.
3. 팝젬 묶음 하나 구매 → 15초 안에 팝젬이 늘어나는지, 새로고침 뒤에도 유지되는지.
4. 공격력 패스 1단계 구매 → 1단계 '보유', 2단계만 구매 버튼, 3단계부터 '이전 단계 먼저', 피해가 2배인지.
5. 무료 탭 광고 → 골드 2배 시간이 HUD에 뜨는지, 하루 선물로 팝젬 +5.
6. 1분 넘게 끄고 다시 켜서 오프라인 창 [광고 보고 2배] → 골드·훈련이 2배로 들어오고 저장이 잘리지 않는지.

## 등록 양식 값 (복사해서 붙여 넣기)

공통: Product ID는 정확히 같게. Price는 제안값(100 VX ≈ $1, VXShop 최저 100). 공격력 패스는 키보드 탈출 Speed Multiplier Tier 방식(순서 구매, 싼 첫 단계)으로 1단계 100 VX부터. Stock Quantity는 넣을 수 있는 가장 큰 값(0이 되면 판매 중단). Metadata 비움(게임이 안 읽음). Period Limit·Time-Limited Sale은 쓰지 않음. 이미지: `art-src/vxshop/<Product ID>.png` (SHONI·BAM은 팝배틀 때 쓰던 이미지).

### pass_x2

- Price (VX): 100
- Purchase Constraints: Lifetime Limit 1

Product Name
```
공격력 패스 1단계 / Attack Pass Tier 1
```

Description
```
피해 영구 ×2
Permanent damage ×2
```

### pass_x4

- Price (VX): 200
- Purchase Constraints: Lifetime Limit 1

Product Name
```
공격력 패스 2단계 / Attack Pass Tier 2
```

Description
```
피해 ×2 추가 (합계 ×4), 1단계 보유 필요
Damage ×2 more (total ×4), needs Tier 1
```

### pass_x8

- Price (VX): 400
- Purchase Constraints: Lifetime Limit 1

Product Name
```
공격력 패스 3단계 / Attack Pass Tier 3
```

Description
```
피해 ×2 추가 (합계 ×8), 2단계 보유 필요
Damage ×2 more (total ×8), needs Tier 2
```

### pass_x16

- Price (VX): 700
- Purchase Constraints: Lifetime Limit 1

Product Name
```
공격력 패스 4단계 / Attack Pass Tier 4
```

Description
```
피해 ×2 추가 (합계 ×16), 3단계 보유 필요
Damage ×2 more (total ×16), needs Tier 3
```

### pass_x32

- Price (VX): 1200
- Purchase Constraints: Lifetime Limit 1

Product Name
```
공격력 패스 5단계 / Attack Pass Tier 5
```

Description
```
피해 ×2 추가 (합계 ×32), 4단계 보유 필요
Damage ×2 more (total ×32), needs Tier 4
```

### pass_x64

- Price (VX): 2000
- Purchase Constraints: Lifetime Limit 1

Product Name
```
공격력 패스 6단계 / Attack Pass Tier 6
```

Description
```
피해 ×2 추가 (합계 ×64), 5단계 보유 필요
Damage ×2 more (total ×64), needs Tier 5
```

### gems_s

- Price (VX): 100
- Purchase Constraints: 없음 (반복 구매)

Product Name
```
팝젬 100개 / 100 Pop Gems
```

Description
```
팝젬 100개
100 Pop Gems
```

### gems_m

- Price (VX): 500
- Purchase Constraints: 없음 (반복 구매)

Product Name
```
팝젬 550개 / 550 Pop Gems
```

Description
```
팝젬 550개 (+10%)
550 Pop Gems (+10%)
```

### gems_l

- Price (VX): 1000
- Purchase Constraints: 없음 (반복 구매)

Product Name
```
팝젬 1200개 / 1200 Pop Gems
```

Description
```
팝젬 1200개 (+20%)
1200 Pop Gems (+20%)
```

### char_shoni

- Price (VX): 300
- Purchase Constraints: Lifetime Limit 1

Product Name
```
캐릭터 SHONI / Hero SHONI
```

Description
```
보유 시 피해 +400%
Owned: +400% damage
```

### char_bam

- Price (VX): 500
- Purchase Constraints: Lifetime Limit 1

Product Name
```
캐릭터 BAM / Hero BAM
```

Description
```
보유 시 피해 +700%
Owned: +700% damage
```
