# DESIGN SYSTEM — Balansa iOS

**Yagona manba:** `design/render/tokens.css`. Bu hujjat uni tushuntiradi,
takrorlamaydi. Ekran HTML/CSS'ida qattiq yozilgan rang yoki px **taqiqlanadi**.

---

## 0. MAQSADLI iOS VERSIYASI

Tekshirildi (veb qidiruv, 2026-08): joriy versiya — **iOS 26**, u
**Liquid Glass** dizayn tilini olib keldi: shaffof "shisha" materiallar,
real vaqtda yorug'lik sinishi (lensing), harakatga javob beruvchi
aks-sadolar, moslashuvchan soyalar. Bu iOS 7 dan beri eng katta vizual
o'zgarish.

**Qaror: bitta dizayn, ikkita material.**

| Rejim | Kim uchun | Sirt |
|---|---|---|
| `glass` (standart) | iOS 26+ | Shaffof, `backdrop-filter: blur(24px) saturate(180%)`, ichki yorug'lik chizig'i |
| `solid` | iOS 18–25 | Qattiq sirt, blur 0, yorug'lik chizig'i yo'q |

**Layout ikkalasida BIR XIL** — faqat sirt materiali almashadi
(`tokens.css` → `[data-material="solid"]`). Shu sabab ilova bugun
zamonaviy ko'rinadi, lekin eski iPhone'dagi mijoz ham yo'qolmaydi.

> **Halol cheklov:** Liquid Glass'ning real vaqtdagi lensing va specular
> highlight effektlarini statik PNG'da to'liq ko'rsatib bo'lmaydi.
> Renderlar — shaffoflik va blur darajasida yaqinlashtirilgan.
> SwiftUI'da bu `.glassEffect()` bilan haqiqiy bo'ladi.

---

## A. BREND VA RANG

### A.1 Falsafa

Ranglar mavjud web ilovadan olindi (`src/app/globals.css`) — brend uzviyligi
buzilmasin. **Lekin ular ko'r-ko'rona ko'chirilmadi:** har juft
`design/render/kontrast.mjs` bilan o'lchandi va **uchtasi AA dan
o'tmagani aniqlandi**.

### A.2 ⚠️ TUZATILGAN RANGLAR

| Token | Web (eski) | Nisbat | iOS (yangi) | Nisbat | Nega |
|---|---|---:|---|---:|---|
| `--income` (light) | `#16a34a` | **3.30** ❌ | `#15803d` | **5.02** ✅ | Kirim summasi rangi. O'qilmasa ilova ishlamaydi. |
| `--debt` (light) | `#d97706` | **3.19** ❌ | `#b45309` | **5.02** ✅ | Qarz summasi. |
| `--label-4` (light) | `#94a3b8` | **2.56** ❌ | `#78899e` | **3.58** ✅ | Placeholder matn. |
| `--label-3` (dark) | `#688480` | **4.15** ❌ | `#7b9a95` | **5.50** ✅ | Uchlamchi matn. |
| `--label-4` (dark) | `#4a625e` | **2.55** ❌ | `#5b756f` | **3.36** ✅ | Placeholder. |

> Bu **veb ilovaga ham tegishli xato** — lekin brief bo'yicha mavjud kodga
> tegilmadi. `BACKEND-GAPS.md` da tavsiya sifatida qayd etilgan.

### A.3 Semantik tokenlar

| Guruh | Tokenlar |
|---|---|
| Fon qatlamlari | `--bg-base` · `--bg-elevated` · `--bg-elevated-2` · `--bg-sunk` |
| Matn (iOS label ierarxiyasi) | `--label-1` … `--label-4` |
| Ajratkich va to'ldirish | `--separator` · `--separator-strong` · `--fill` · `--fill-strong` |
| Brend | `--accent` · `--accent-pressed` · `--accent-wash` · `--accent-on` · `--accent-mint` |
| Moliyaviy | `--income` · `--expense` · `--debt` (+ `-soft`, `-on`) |
| Holat | `--warning` · `--info` |
| Material | `--mat-bg` · `--mat-blur` · `--mat-saturate` · `--mat-highlight` · `--mat-border` |
| Grafik | `--chart-1` … `--chart-5` |

### A.4 Kontrast jadvali (o'lchangan, qo'lda yozilmagan)

Manba: `node design/render/kontrast.mjs`. **28/28 juft AA dan o'tadi.**

#### LIGHT

| Matn | Fon | Nisbat | Talab | |
|---|---|---:|---:|:-:|
| `label-1` | `bg-base` | 16.01 | 4.5 | ✅ |
| `label-1` | `bg-elevated` | 17.85 | 4.5 | ✅ |
| `label-2` | `bg-elevated` | 7.58 | 4.5 | ✅ |
| `label-3` | `bg-elevated` | 4.76 | 4.5 | ✅ |
| `label-4` | `bg-elevated` | 3.58 | 3.0 | ✅ |
| `accent` | `bg-elevated` | 5.47 | 4.5 | ✅ |
| `accent-on` | `accent` | 5.47 | 4.5 | ✅ |
| `income` | `bg-elevated` | 5.02 | 4.5 | ✅ |
| `expense` | `bg-elevated` | 4.83 | 4.5 | ✅ |
| `debt` | `bg-elevated` | 5.02 | 4.5 | ✅ |
| `income-on` | `income-soft` | 4.57 | 4.5 | ✅ |
| `expense-on` | `expense-soft` | 5.30 | 4.5 | ✅ |
| `debt-on` | `debt-soft` | 4.51 | 4.5 | ✅ |
| `accent` | `accent-wash` | 4.86 | 4.5 | ✅ |

#### DARK

| Matn | Fon | Nisbat | Talab | |
|---|---|---:|---:|:-:|
| `label-1` | `bg-base` | 16.05 | 4.5 | ✅ |
| `label-1` | `bg-elevated` | 14.30 | 4.5 | ✅ |
| `label-2` | `bg-elevated` | 6.96 | 4.5 | ✅ |
| `label-3` | `bg-elevated` | 5.50 | 4.5 | ✅ |
| `label-4` | `bg-elevated` | 3.36 | 3.0 | ✅ |
| `accent` | `bg-elevated` | 8.99 | 4.5 | ✅ |
| `accent-on` | `accent` | 10.10 | 4.5 | ✅ |
| `income` | `bg-elevated` | 9.61 | 4.5 | ✅ |
| `expense` | `bg-elevated` | 6.05 | 4.5 | ✅ |
| `debt` | `bg-elevated` | 10.03 | 4.5 | ✅ |
| `income-on` | `income-soft` | 9.56 | 4.5 | ✅ |
| `expense-on` | `expense-soft` | 8.39 | 4.5 | ✅ |
| `debt-on` | `debt-soft` | 10.79 | 4.5 | ✅ |
| `accent` | `accent-wash` | 5.09 | 4.5 | ✅ |

### A.5 Dark rejim — INVERT EMAS

| Qoida | Light | Dark |
|---|---|---|
| Asosiy fon | `#eff3f7` | `#061413` — chuqur teal-qora, **`#000` emas** |
| Qatlam yo'nalishi | Karta oq (fondan **ochroq**) | Karta `#0d211f` (fondan **ochroq**) |
| Ajratish usuli | **Soya** (`--shadow-card`) | **Chegara** (`--card-border`), soya `none` |
| Brend rangi | `#0f766e` (to'q teal) | `#2dd4bf` (mint) — qorong'ida to'q teal ko'rinmaydi |

> `#000` ATAYLAB ishlatilmaydi: OLED'da chuqur qora "teshik" hissini beradi
> va brenddan uzoqlashadi. `#061413` — teal oilasining eng to'q pog'onasi.

### A.6 Moliyaviy semantika — rangga TAYANMASLIK qoidasi

Rang ko'rmaydigan foydalanuvchi (erkaklarning ~8%) uchun **har moliyaviy
qiymat ikkinchi belgiga ega**:

| Ma'no | Rang | Ikona | Ishora | Matn |
|---|---|---|---|---|
| Kirim | yashil | ↓ (ichkariga) | `+` | "Kirdi" |
| Chiqim | qizil | ↑ (tashqariga) | `−` | "Chiqdi" |
| Qarz | amber | ⚠ doira | (ishorasiz) | "Qarz" |

**Test:** ekranni kulrangga aylantirganda ma'no yo'qolmasligi kerak
(FAZA 8 da tekshiriladi).

---

## B. TIPOGRAFIKA

### B.1 Shrift

| Kontekst | Shrift |
|---|---|
| Qurilmada | `-apple-system` → **SF Pro Text / Display** |
| Renderda | **Inter Var** (SF Pro'ning ochiq muqobili, `design/render/fonts/`) |

O'zbek lotinidagi `ʻ` (U+02BB) va `ʼ` (U+02BC) — `latin` to'plamida,
`@font-face` `unicode-range` da aniq ko'rsatilgan.

### B.2 iOS Text Styles (standart "Large")

| Style | O'lcham / satr | Og'irlik | Qayerda |
|---|---|---|---|
| largeTitle | 34 / 41 | 700 | Ekran sarlavhasi (scroll bilan inline'ga o'tadi) |
| title1 | 28 / 34 | 700 | Bo'lim sarlavhasi |
| title2 | 22 / 28 | 700 | Karta sarlavhasi |
| title3 | 20 / 25 | 620 | Ichki sarlavha |
| **headline** | 17 / 22 | 620 | Ro'yxat qatori nomi, bo'lim boshi |
| **body** | 17 / 22 | 400 | Asosiy matn |
| callout | 16 / 21 | 400 | Ro'yxat qatori ikkilamchi |
| subheadline | 15 / 20 | 400 | Yordamchi |
| footnote | 13 / 18 | 400 | Izoh, sana |
| caption1 | 12 / 16 | 400 | Chip, badge |
| caption2 | 11 / 13 | 400 | Tab yorlig'i |

### B.3 Pul summasi — alohida shkala

| Token | O'lcham | Qayerda |
|---|---|---|
| `--t-amount-xl` | 40 / 44 | Asosiy ekrandagi sof foyda, savat jami |
| `--t-amount-lg` | 28 / 32 | Kassa qoldig'i, qarz jami |
| `--t-amount-md` | 20 / 24 | Ro'yxat qatoridagi summa |

**Har uchtasi `tnum` (tabular figures) bilan** — ustunlar sakramaydi.
`base.css` da `.tnum`, `.amount`, `[data-numeric]` avtomatik oladi.

### B.4 Dynamic Type — XS va XXXL

`tokens.css` da `[data-type="xs"]` va `[data-type="xxxl"]`.

| Style | XS | Large | XXXL |
|---|---:|---:|---:|
| largeTitle | 31 | 34 | 44 |
| title1 | 25 | 28 | 38 |
| headline / body | 14 | 17 | 28 |
| footnote | 12 | 13 | 23 |
| caption2 | 11 | 11 | 20 |
| amount-xl | 32 | 40 | 44 |
| **tap-min** | 44 | 44 | **52** |

**Pul summasi XXXL da boshqalar bilan bir xil nisbatda O'SMAYDI**
(40 → 44, ×1.1; body esa 17 → 28, ×1.65). Sabab: "12 480 000 soʻm"
393px ekranga sig'ishi kerak. Sig'masa — raqam kichrayadi
(`minimumScaleFactor`), **hech qachon kesilmaydi**.

### B.5 Pul formati

```
1 250 000 soʻm        ← probel ajratkich (U+00A0, uzilmas)
−4 500 000            ← minus U+2212, defis EMAS
+2 400 000            ← kirim uchun ochiq plus
```

Pul har doim `Int` (so'm) — kasr yo'q (`CLAUDE.md` invarianti).
Tiyin ko'rsatilmaydi.

---

## C. MASOFA VA GEOMETRIYA

### C.1 4pt grid

`--sp-1: 4` · `--sp-2: 8` · `--sp-3: 12` · `--sp-4: 16` · `--sp-5: 20` ·
`--sp-6: 24` · `--sp-8: 32` · `--sp-10: 40` · `--sp-12: 48`

**Standart yon chekinish: `--sp-4` (16px)** — iOS konvensiyasi.

### C.2 Tegish maydoni — 44×44pt, BUZILMAYDI

Har interaktiv element `.tap` klassini oladi yoki `min-height: var(--tap-min)`.
XXXL rejimida avtomatik 52px ga o'sadi.

**Bosh barmoq zonasi** (bir qo'l bilan ishlash): 393×852 ekranda pastki
**~55%** qulay. Shuning uchun:

| Element | Joyi | Nega |
|---|---|---|
| Asosiy amal tugmasi | **Past**, safe area ustida | Bosh barmoq yetadi |
| FAB | Tab bar markazi | Eng qulay nuqta |
| Destruktiv amal | **Yuqori o'ng** yoki swipe | Tasodifan bosilmasin |
| Sarlavha, KPI | Yuqori | Faqat o'qish uchun |

### C.3 Corner radius

`--r-xs: 6` (ikonka foni) · `--r-sm: 10` (kichik) · `--r-md: 14` (ro'yxat
qatori) · `--r-lg: 20` (karta) · `--r-xl: 28` (sheet) · `--r-full` (chip, FAB)

### C.4 Safe area

| Zona | Balandlik | Qoida |
|---|---|---|
| Yuqori (Dynamic Island) | 59px | Kontent kirmaydi. Faqat fon rangi o'tadi. |
| Past (home indicator) | 34px | Tugma joylashmaydi. Tab bar ustidan turadi. |

Skroll qiladigan kontent safe area **ostidan o'tadi** (Liquid Glass
ostida ko'rinib turadi) — bu iOS 26 uslubi.

---

## D. HARAKAT VA HAPTIKA

### D.1 Animatsiya

| Nomi | Davomiylik | Egri | Qayerda |
|---|---:|---|---|
| Tez | 200ms | `--ease-ios` | Tugma bosilishi, chip tanlash |
| Asosiy | 350ms | `--ease-ios` | Sheet ochilishi, navigatsiya |
| Spring | — | `spring(response: .35, damping: .8)` | Savatga qo'shish, qator yo'qolishi |

`--ease-ios: cubic-bezier(0.32, 0.72, 0, 1)` — iOS'ning standart egri chizig'i.

**Reduce Motion** yoqilganda: barcha harakat `opacity` fade ga aylanadi
(150ms), spring va slide yo'qoladi. Ma'no yo'qolmaydi.

### D.2 Haptika xaritasi

| Turi | Qachon | Ekranlar |
|---|---|---|
| `.light` | Tanlov, chip, stepper, segmented | BAL-043 (kategoriya), BAL-071 (miqdor), BAL-041 (filtr), BAL-072 (to'lov turi) |
| `.medium` | Savatga qo'shildi, qator ko'chirildi | BAL-080, BAL-049 |
| `.success` | Yozuv saqlandi, sotuv yakunlandi, to'lov qabul qilindi, kun tasdiqlandi, smena to'g'ri chiqdi, sinxronizatsiya tugadi | BAL-043, BAL-074, BAL-153, BAL-061, BAL-057, BAL-303 |
| `.warning` | Qarz limitiga yaqin (80%+), smenada farq, budjet oshdi | BAL-073, BAL-057, BAL-063 |
| `.error` | Ombor yetarli emas, tarmoq xatosi, login xato, huquq yo'q | BAL-085, BAL-304, BAL-001, BAL-306 |

**Qoida:** haptika **natijani** bildiradi, harakatni emas. Har tegishda
tebranish — shovqin. Skroll, sahifa o'tish, oddiy tugma — haptikasiz.

---

## E. ACCESSIBILITY

### E.1 VoiceOver — label naqshlari

| Komponent | Naqsh | Misol |
|---|---|---|
| Pul summasi | `"{ma'no}, {summa} soʻm"` | "Kirim, 2 million 400 ming soʻm" |
| Yozuv qatori | `"{nomi}, {ma'no} {summa}, {vaqt}"` | "Karim aka qarz toʻlovi, kirim 2 400 000 soʻm, 14:20" |
| Stat karta | `"{yorliq}: {qiymat}"` | "Kirdi: 47 250 000 soʻm" |
| Tab | `"{nomi}, {n} dan {m}"` | "Sotuv, 1 dan 4" |
| Chip (filtr) | `"{nomi}, {tanlangan/tanlanmagan}"` | "Bu oy, tanlangan" |
| Progress / aging | `"{yorliq}, {foiz} foiz"` | "Qarz limiti, 84 foiz" |
| Destruktiv tugma | `"{amal}, ehtiyot boʻling"` + `.isButton` | "Sotuvni bekor qilish" |

**Summa o'qilishi:** raqam `tnum` bilan yozilsa ham VoiceOver uni
**so'z bilan** o'qishi kerak — `accessibilityLabel` alohida beriladi
("2 400 000" emas, "ikki million to'rt yuz ming").

### E.2 Dynamic Type XXXL — layout qoidalari

| Muammo | Yechim |
|---|---|
| Yon-yon ikki karta sig'maydi | XXXL da **vertikal** stack (`.stat` lar ustma-ust) |
| Tugma matni kesiladi | Tugma balandligi o'sadi, matn 2 qatorga tushadi |
| Tab yorlig'i sig'maydi | Yorliq yashiriladi, **faqat ikona** qoladi |
| Ro'yxat qatorida summa sig'maydi | Summa **ikkinchi qatorga** tushadi |
| Pul summasi sig'maydi | `minimumScaleFactor: 0.7` — kichrayadi, kesilmaydi |

**Qoida: matn HECH QACHON kesilmaydi (`truncation`), layout moslashadi.**
Istisno — mahsulot/mijoz nomi (uzun bo'lishi mumkin, `...` bilan).

### E.3 Reduce Motion / Reduce Transparency

| Sozlama | Ta'sir |
|---|---|
| Reduce Motion | Spring va slide → 150ms fade. Parallax yo'q. |
| **Reduce Transparency** | Liquid Glass → `solid` materialga o'tadi (`[data-material="solid"]`). Bu bizda allaqachon bor. |
| Increase Contrast | `--separator` → `--separator-strong`, `label-3` → `label-2` |

### E.4 Rang ko'rlik

A.6 bo'limiga qarang: har moliyaviy qiymatda rang + ikona + ishora.

---

## F. O'ZBEK TILI XUSUSIYATLARI

### F.1 Matn uzunligi

O'zbekcha inglizchadan **~15–20% uzun**. Shuning uchun:

| Element | Qoida |
|---|---|
| Tugma | Matn uchun **1.2×** joy. `"Qabul qilish va toʻlash"` — 24 belgi. |
| Tab yorlig'i | Maks **8 belgi** (`Yozuvlar`, `Qarzlar`, `Kassam`). Uzunroq bo'lsa qisqartiriladi, kesilmaydi. |
| Ro'yxat sarlavhasi | 1 qator, `...` bilan |
| Bo'sh holat matni | 2 qatordan oshmasin |

**Test:** har tugma matni **XXXL** da 2 qatorga sig'ishi kerak.

### F.2 Terminologiya — `src/lib/copy.ts` YAGONA MANBA

| To'g'ri | Noto'g'ri |
|---|---|
| Yozuv | Tranzaksiya |
| Pul kirdi / Pul chiqdi | Daromad / Xarajat |
| Kirdi / Chiqdi / Qoldi | Debet / Kredit |
| Sof foyda | Foyda-zarar |
| Qarzdorlik | Debitorlik |
| Kassa | Hisob-raqam |

> **"Debet/Kredit" ISHLATILMAYDI** — bu loyihaning ataylab qilingan UX
> ustunligi. Do'kon egasi buxgalter emas. Bu qoida `copy.ts` da
> mustahkamlangan va iOS'da ham saqlanadi.

### F.3 Apostrof

Uzbek lotinida `ʻ` (U+02BB, modifier letter turned comma) — **`'` emas**:

```
✅  soʻm · oʻtgan · Chorsu Savdo · toʻlov · Doʻkon
❌  so'm · o'tgan · to'lov
```

Renderlarda U+02BB ishlatiladi; Inter latin to'plami uni qamraydi.

### F.4 Sana va vaqt

| Format | Misol |
|---|---|
| Qisqa | `16-avg` |
| To'liq | `16-avgust 2026` |
| Bugun / Kecha | so'z bilan |
| Vaqt | `14:20` (24 soat) |
| **Hafta boshi** | **Dushanba** |

Oy nomlari o'zbekcha: yanvar, fevral, mart, aprel, may, iyun, iyul,
avgust, sentabr, oktabr, noyabr, dekabr.

---

## G. TOKENLARNI TEKSHIRISH

```bash
node design/render/kontrast.mjs      # 28 juft, hammasi AA
node design/render/shot.mjs --all --mode both
node design/render/shot.mjs --id BAL-020 --material solid   # iOS 18-25
```

Token o'zgarsa — `kontrast.mjs` dagi ro'yxat ham yangilanadi va qayta
ishga tushiriladi. **Jadval qo'lda yozilmaydi.**
