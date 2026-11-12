# VXShop 상품 등록 목록 (계획 3)

Verse8 대시보드 VXShop에 아래 **상품 ID 그대로** 등록한다. 지급은 서버 `$onItemPurchased`(`src/sim/premium.ts` `PRODUCTS`)가 하므로 ID가 다르면 지급되지 않는다. 가격은 대시보드 값이 게임에 그대로 보인다(못 받으면 구매 버튼 꺼짐).

| 상품 ID | 내용 | 종류 | 비고 |
|---|---|---|---|
| `pass_x2` | 공격력 패스 ×2 (영구) | 1회 (Lifetime 1) | 지금보다 높은 단계는 아무거나 바로 구매 가능 |
| `pass_x4` | 공격력 패스 ×4 | 1회 | 가장 높은 패스 하나만 적용 (높은 걸 사면 낮은 건 의미 없음 → 단계 사이 가격 차이를 너무 크지 않게) |
| `pass_x8` | 공격력 패스 ×8 | 1회 | |
| `pass_x16` | 공격력 패스 ×16 | 1회 | |
| `pass_x32` | 공격력 패스 ×32 | 1회 | |
| `pass_x64` | 공격력 패스 ×64 | 1회 | |
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
4. 공격력 패스 ×2 구매 → ×2는 '보유', 더 높은 단계는 계속 살 수 있는지, 피해가 2배인지.
5. 무료 탭 광고 → 골드 2배 시간이 HUD에 뜨는지, 하루 선물로 팝젬 +5.
6. 1분 넘게 끄고 다시 켜서 오프라인 창 [광고 보고 2배] → 골드·훈련이 2배로 들어오고 저장이 잘리지 않는지.

## 등록 양식 값 (복사해서 붙여 넣기)

공통: Product ID는 정확히 같게. Price는 제안값(사용자 확정, 100 VX ≈ $1). Stock Quantity는 넣을 수 있는 가장 큰 값(0이 되면 판매 중단). Metadata 비움(게임이 안 읽음). Period Limit·Time-Limited Sale은 쓰지 않음. 이미지: `art-src/vxshop/<Product ID>.png` (SHONI·BAM은 팝배틀 때 쓰던 이미지).

### pass_x2

- Price (VX): 300
- Purchase Constraints: Lifetime Limit 1

Product Name
```
공격력 패스 ×2 / Attack Pass ×2
```

Description
```
피해 영구 ×2
Permanent damage ×2
```

### pass_x4

- Price (VX): 500
- Purchase Constraints: Lifetime Limit 1

Product Name
```
공격력 패스 ×4 / Attack Pass ×4
```

Description
```
피해 영구 ×4
Permanent damage ×4
```

### pass_x8

- Price (VX): 900
- Purchase Constraints: Lifetime Limit 1

Product Name
```
공격력 패스 ×8 / Attack Pass ×8
```

Description
```
피해 영구 ×8
Permanent damage ×8
```

### pass_x16

- Price (VX): 1500
- Purchase Constraints: Lifetime Limit 1

Product Name
```
공격력 패스 ×16 / Attack Pass ×16
```

Description
```
피해 영구 ×16
Permanent damage ×16
```

### pass_x32

- Price (VX): 2500
- Purchase Constraints: Lifetime Limit 1

Product Name
```
공격력 패스 ×32 / Attack Pass ×32
```

Description
```
피해 영구 ×32
Permanent damage ×32
```

### pass_x64

- Price (VX): 4000
- Purchase Constraints: Lifetime Limit 1

Product Name
```
공격력 패스 ×64 / Attack Pass ×64
```

Description
```
피해 영구 ×64
Permanent damage ×64
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
