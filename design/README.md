# BALANSA iOS — DIZAYN

Native iOS ilovasining to'liq dizayni. **SwiftUI kodi yozilmagan** —
implementatsiya alohida sessiyada, ruxsat berilgandan keyin.

---

## YAKUNIY XULOSA

| Savol | Javob |
|---|---|
| **Nechta ekran loyihalandi** | **104** (34 sohaning hammasi qamrab olindi) |
| **Nechtasi renderlandi** | **33 ekran · 44 PNG** (light, dark, XXXL, solid variantlari bilan) |
| **READY** | **78 ekran (75%)** — backend to'liq bor |
| **PARTIAL** | **15 ekran (14%)** — API shakli mos emas |
| **MISSING** | **11 ekran (11%)** — backend'da umuman yo'q |
| **MVP uchun yetarli** | **~58 ekran** — faqat READY bo'lganlar |
| **Eng katta backend to'sig'i** | **Mobil autentifikatsiya (JWT + refresh)** — busiz ilova umuman ishlamaydi |

### Eng katta to'siq — batafsil

Bugungi tizim `iron-session` **cookie** ishlatadi (`src/lib/auth/session.ts:29-38`).
Native ilova cookie'ni ishonchli saqlay olmaydi va Face ID bilan bog'lay
olmaydi. Kerak: **JWT (15 daq) + refresh token (30 kun, rotatsiya bilan)**,
refresh token iOS **Keychain**'da `biometryCurrentSet` bayrog'i bilan.

Bu **bloklovchi** — MVP'ning birinchi kunidagi ish. Batafsil:
`BACKEND-GAPS.md` D-1.

**Ikkinchi to'siq:** offline navbat uchun idempotentlik kalitlari
(`BACKEND-GAPS.md` B-2). Pul bilan ishlaydigan ilovada dublikat yozuv —
eng xavfli xato.

---

## HUJJATLAR

| Fayl | Nima |
|---|---|
| [`FEATURE-INVENTORY.md`](FEATURE-INVENTORY.md) | Backend auditi — 46 model, 117 route. Har xulosa `fayl:satr` dalili bilan. **14 majburiy tekshiruv** |
| [`SCREEN-MAP.md`](SCREEN-MAP.md) | Informatsion arxitektura — tab bar, rol navigatsiyasi, 104 ekran ID, qamrov jadvali |
| [`USER-FLOWS.md`](USER-FLOWS.md) | 12 oqim, tegish soni, haptika, offline holati |
| [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) | Rang (o'lchangan kontrast), tipografika, Dynamic Type, haptika, accessibility, o'zbek tili |
| [`COMPONENT-LIBRARY.md`](COMPONENT-LIBRARY.md) | 32 komponent, holatlari va SwiftUI ekvivalenti (nom sifatida) |
| [`BALANSA-IOS-DESIGN.md`](BALANSA-IOS-DESIGN.md) | Ekran spesifikatsiyalari — har biri 13 punkt, **BACKEND STATUS** bilan |
| [`DESIGN-REVIEW.md`](DESIGN-REVIEW.md) | Tanqidiy review — 12 topilma, 5 tasi kritik va tuzatilgan |
| [`BACKEND-GAPS.md`](BACKEND-GAPS.md) | Backend ishi: bor / o'zgarishi kerak / yo'q / mobil uchun maxsus |
| [`IOS-IMPLEMENTATION-PLAN.md`](IOS-IMPLEMENTATION-PLAN.md) | Texnologiya, MVP→V1→V2, risklar, testlar, App Store talablari |

---

## RENDER QUVURI

```bash
node design/render/build.mjs                        # HTML generatsiya
node design/render/shot.mjs --all --mode both       # barcha ekran, light+dark
node design/render/shot.mjs --id BAL-020 --type xxxl   # Dynamic Type sinovi
node design/render/shot.mjs --id BAL-020 --material solid  # iOS 18-25
node design/render/shot.mjs --all --index           # kontakt varaq ham
node design/render/kontrast.mjs                     # WCAG auditi (28 juft)
```

| Fayl | Nima |
|---|---|
| `render/tokens.css` | **Yagona manba** — rang, shrift, masofa, Dynamic Type |
| `render/base.css` | Qurilma ramkasi, xavfsiz zona, tipografiya |
| `render/components.css` | 32 komponent |
| `render/lib.mjs` | HTML generator — ekranlar shundan yig'iladi |
| `render/ekranlar/*.mjs` | Ekran ta'riflari (ma'lumot sifatida) |
| `render/shot.mjs` | Playwright renderi |
| `render/kontrast.mjs` | WCAG tekshiruvi |
| `screens/index.html` | Kontakt varaq (PNG grid) |
| `render/index.html` | Jonli indeks (HTML iframe — render kutilmaydi) |

**O'lcham:** 393×852 CSS px @3x → **1179×2556 PNG**.

---

## ASOSIY QARORLAR

**1. Bu bitta ilova emas, uchta.** `katalog.ts:56-74` bo'yicha SELLER'da
3/18 huquq, CASHIER'da 11/18, OWNER'da 18/18. Tab bar rolga qarab
quriladi: SELLER 2 tab, CASHIER sotuv-markazli 4 tab, OWNER
hisobot-markazli 4 tab.

**2. Web ko'chirilmadi.** 35 web sahifa → 104 iOS ekran. Ko'proq, lekin
har biri kichikroq: web'da bitta sahifa 5 ta ishni qiladi, iOS'da har
ekran bitta savolga javob beradi. Sotuv formasi → 5 qadamli oqim.

**3. iOS 26 (Liquid Glass), lekin bitta dizayn.** Material tokenlar
darajasida ajratilgan: `glass` (iOS 26+) va `solid` (iOS 18–25).
Layout ikkalasida bir xil — eski iPhone'dagi mijoz yo'qolmaydi.

**4. Kontrast o'lchandi, taxmin qilinmadi.** 28 juft `kontrast.mjs` bilan
tekshirildi. **Uchtasi AA dan o'tmadi** — jumladan `income` (kirim
summasining rangi, 3.30:1). Hammasi tuzatildi; endi 28/28 o'tadi.

**5. Real mijoz ma'lumoti ishlatilmadi.** "Chorsu Savdo", "Karim aka" —
o'ylab topilgan, lekin realistik. Dizayn fayllari ulashilishi mumkin.

---

## FAZA 8 DA TOPILGAN VA TUZATILGAN

| Topilma | Jiddiylik |
|---|---|
| 3 rang WCAG AA dan o'tmadi (web'dan meros) | 🔴 |
| XXXL da stat kartalar stack'ga o'tmadi (hujjatda bor, CSS'da yo'q edi) | 🔴 |
| XXXL da tab yorliqlari yashirilmadi | 🔴 |
| `<meta viewport>` yo'q bo'lsa render **jimgina** buzilardi | 🔴 |
| Sheet home indicator zonasiga yetmasdi | 🟡 |

**Ochiq qolgan 6 ta** (V1 gacha) — `DESIGN-REVIEW.md` 12-bo'lim.
Eng muhimi: BAL-201 hisobot hali "web sahifa"ga o'xshaydi.

---

## KEYINGI QADAM

1. `BACKEND-GAPS.md` D-1 (JWT + refresh) — **birinchi ish**
2. Qolgan 71 ekranni render qilish
3. `DESIGN-REVIEW.md` dagi 6 ochiq topilmani tuzatish
4. **Shundan keyin** SwiftUI implementatsiyasi (alohida ruxsat bilan)
