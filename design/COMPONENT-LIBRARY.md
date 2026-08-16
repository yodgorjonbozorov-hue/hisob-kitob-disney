# COMPONENT LIBRARY — Balansa iOS

**Vizual manba:** `design/screens/BAL-900-komponentlar.png` (+ `-dark`)
**CSS:** `design/render/components.css` · **HTML generatori:** `design/render/lib.mjs`

> **SwiftUI ekvivalenti FAQAT nom sifatida ko'rsatiladi — kod emas.**
> Implementatsiya alohida sessiyada, ruxsat berilgandan keyin.

**Umumiy qoidalar (har komponentga tegishli):**

| Qoida | Tafsilot |
|---|---|
| Tegish maydoni | ≥ 44×44pt (XXXL da 52). Vizual o'lcham kichik bo'lishi mumkin, **tegish maydoni yo'q** |
| Rang | Faqat token. Inline rang **taqiqlanadi** |
| Dynamic Type | XS → XXXL da layout moslashadi, matn **kesilmaydi** |
| Rangga tayanmaslik | Moliyaviy ma'no rang + ikona + ishora bilan |
| Haptika | Natijada, harakatda emas |

---

## 1. Navigation bar

**Anatomiya:** balandlik ≥44pt · yon chekinish `--sp-4` · katta sarlavha
34/41pt (`--t-large-title`), skrollda inline 17pt (`--t-headline`).

| Variant | Qachon |
|---|---|
| `navLarge` | Ro'yxat ekranining tepasi (Yozuvlar, Ombor, Qarzlar) |
| `navInline` | Ierarxiyada pastda (tafsilot, forma) — orqaga tugmasi bilan |
| `navBiznes` | Bosh ekranlar — biznes almashtirgich + bildirishnoma |

**Holatlar:** default · scrolled (katta → inline, ajratkich paydo bo'ladi) ·
`icon-btn__dot` (o'qilmagan bildirishnoma).

**VoiceOver:** sarlavha `.isHeader`. Orqaga tugmasi: `"Orqaga, {oldingi ekran}"`.
Bildirishnoma: `"Bildirishnomalar, {n} ta yangi"`.

**XXXL:** katta sarlavha 44pt, 2 qatorga tushishi mumkin — navbar balandligi o'sadi.

→ SwiftUI: `NavigationStack` + `.navigationBarTitleDisplayMode(.large/.inline)` + `.toolbar`

---

## 2. Tab bar

**Anatomiya:** ikona 24pt · yorliq 10/12pt (`--t-caption-2` dan kichikroq,
iOS konvensiyasi) · FAB 52×52 · `margin-top: -14px`.

**Rolga qarab tarkib** (`SCREEN-MAP.md` A bo'limi): OWNER 4 tab + FAB ·
CASHIER 4 + FAB · SELLER 2–3 + FAB.

**Holatlar:** active (`--accent`) · inactive (`--label-3`) · badge (son) ·
FAB pressed.

**VoiceOver:** `"{nomi}, {i} dan {n}"`. FAB: `"Yangi yozuv"` + `.isButton`.

**XXXL:** yorliq **yashiriladi**, faqat ikona qoladi (yorliq sig'maydi).

→ SwiftUI: `TabView` + `.tabItem` · FAB — `ZStack` ustidagi `Button`

---

## 3. Bottom sheet

**Anatomiya:** radius `--r-xl` (28) · grabber 36×5 · detentlar:
`small` 34% · `medium` 52% · `large` 88%.

| Detent | Qachon |
|---|---|
| small | Tasdiq, 1 qatorli tanlov |
| medium | 1–3 maydonli forma (to'lov turi, sana) |
| large | Ro'yxatdan tanlash, ko'p maydonli forma |

**Holatlar:** ochiq · sudralmoqda · scrim (35% qora).

**VoiceOver:** ochilganda fokus sarlavhada. Yopish: `"Yopish"` tugmasi +
`.accessibilityAddTraits(.isModal)`.

→ SwiftUI: `.sheet(isPresented:)` + `.presentationDetents([.medium, .large])`
+ `.presentationDragIndicator(.visible)`

---

## 4. Karta

**Anatomiya:** radius `--r-lg` (20) · padding `--sp-4` · light'da soya
(`--shadow-card`), dark'da chegara (`--card-border`).

**Variantlar:** `card` · `card--flush` (ro'yxat uchun, padding 0) ·
`card--accent` (brend fon).

→ SwiftUI: `.background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20))`

---

## 5. Stat karta

**Anatomiya:** ikona 18×18 rangli fonda · yorliq 13pt · qiymat 20pt tabular.

**Rangga tayanmaslik:** ikona ichida ↓ (kirim) / ↑ (chiqim) — rang
ko'rmasa ham ma'no qoladi.

**XXXL:** yon-yon ikki karta **vertikal** stack'ga o'tadi.

**VoiceOver:** `"Kirdi: 47 million 250 ming soʻm"` — raqam so'z bilan.

→ SwiftUI: `GridRow` + `.accessibilityElement(children: .combine)`

---

## 6. List row

**Anatomiya:** min balandlik 56pt · ikona 38×38 (`--r-sm`) · sarlavha 16pt/550 ·
izoh 12pt · summa 20pt tabular o'ngda.

**Ajratkich matndan boshlanadi** (`left: 16 + 38 + 12 = 66px`) — iOS naqshi.
Ikonasiz ro'yxatda (`list--plain`) 16px dan.

**Swipe amallari** (o'ngdan chapga): Tahrir (`--label-3`) · O'chirish
(`--expense`) · To'lov qabul (`--income`, qarz ro'yxatida).

**Holatlar:** default · pressed (`--fill`) · swiped · disabled.

**XXXL:** summa **ikkinchi qatorga** tushadi, qator balandligi o'sadi.

**VoiceOver:** `"Karim aka qarz toʻlovi, kirim 2 400 000 soʻm, 14:20"`.
Swipe amallari `.accessibilityActions` sifatida.

→ SwiftUI: `List` + `.swipeActions(edge: .trailing)` + `.listRowSeparator`

---

## 7. Tugmalar

| Variant | Fon | Matn | Qachon |
|---|---|---|---|
| `primary` | `--accent` | `--accent-on` | Ekrandagi ASOSIY amal (bittadan ko'p emas) |
| `secondary` | `--fill` | `--label-1` | Ikkilamchi (Bekor) |
| `tertiary` | shaffof | `--accent` | Uchlamchi (Batafsil) |
| `destructive` | `--expense` | oq | O'chirish, bekor qilish |
| `destructive-soft` | `--expense-soft` | `--expense-on` | Xavfli, lekin qaytariladigan |

**Anatomiya:** min balandlik 44pt · radius `--r-md` (14) · matn 17pt/620.

**Holatlar:** default · pressed (`--accent-pressed`) · disabled (opacity .38) ·
loading (matn o'rnida spinner, **kenglik o'zgarmaydi** — sakrash bo'lmaydi).

**O'zbek tili:** matn uchun 1.2× joy. `"Qabul qilish va toʻlash"` = 24 belgi —
XXXL da 2 qatorga tushadi, tugma balandligi o'sadi.

→ SwiftUI: `Button` + `.buttonStyle(.borderedProminent / .bordered / .plain)`
+ `.controlSize(.large)`

---

## 8. Text field

**Anatomiya:** min balandlik 44pt · fon `--bg-sunk` · radius `--r-md` ·
fokusda `--accent` chegara + fon `--bg-elevated`.

**Xato:** chegara `--expense`, xabar **maydon ostida** 13pt.
Xato xabari — nima qilish kerakligini aytadi ("Summa 0 dan katta bo'lishi kerak"),
nima noto'g'ri ekanini emas.

**VoiceOver:** `"{yorliq}, matn maydoni, {qiymat}"`. Xato: `.accessibilityValue`.

→ SwiftUI: `TextField` + `.textFieldStyle(.plain)` + `.focused($fokus)`

---

## 9. Amount input

**Ilovaning ENG MUHIM komponenti** — kirim/chiqimning 90% shu yerdan o'tadi.

**Anatomiya:** 40pt display shrift · tabular · markazda · rang segmentga
bog'liq (kirim yashil, chiqim qizil) · birlik ("soʻm") 16pt kulrang ·
kursor 2×34px `--accent`.

**Xatti-harakat:** klaviatura **darhol ochiladi**, tegish talab qilmaydi.
Raqam terilganda uch xonadan probel bilan ajratiladi (`1 250 000`).

**XXXL:** 40 → 44pt (boshqalar kabi ×1.65 emas — ekranga sig'ishi kerak).
Sig'masa `minimumScaleFactor: 0.7`.

**VoiceOver:** `"Summa, 250 ming soʻm, kirim"`.

→ SwiftUI: `TextField` + `.keyboardType(.numberPad)` + `.font(.system(size:40, weight:.bold, design:.rounded))`

---

## 10. Quantity stepper — KASR QO'LLAB-QUVVATLAYDI

**Anatomiya:** − va + tugmalar 38×38 (tegish maydoni 44 bilan o'ralgan) ·
qiymat 68pt min kenglik, tabular · birlik kichik kulrang.

**Kasr:** `1.5 kg`, `0.75 litr` — qadam birlikka bog'liq:
`dona` → 1 · `kg`/`litr` → 0.5 · uzoq bosishda tez o'zgaradi.

> ⚠️ **Backend MISSING:** `Product.miqdor` va `Sale.miqdor` — `Int`
> (`schema.prisma:510,615`). Komponent tayyor, backend emas.

**VoiceOver:** `.accessibilityAdjustableAction` — yuqoriga/pastga surish bilan.

→ SwiftUI: `Stepper` yoki maxsus `HStack` + `.accessibilityAdjustableAction`

---

## 11. Segmented control

**Anatomiya:** balandlik 38pt (ichki element 34) · fon `--fill` · aktiv
element `--bg-elevated` + soya.

**Moliyaviy variant:** aktiv "Kirim" → yashil matn, "Chiqim" → qizil.
Ostidagi summa maydoni ham shu rangga o'tadi.

**Holatlar:** har element default / active / disabled.

→ SwiftUI: `Picker` + `.pickerStyle(.segmented)`

---

## 12. Search bar

**Anatomiya:** balandlik 44pt · fon `--fill` · radius `--r-sm` · ikona 18pt.

**Xatti-harakat:** 2 belgidan boshlab qidiradi (`/api/search` talabi),
300ms debounce, 20 so'rov/daqiqa limiti (server).

→ SwiftUI: `.searchable(text:)`

---

## 13. Chip / Badge / Avatar

| Komponent | Balandlik | Qachon |
|---|---|---|
| `chip` | 26pt | Yorliq (o'qish uchun): "Naqd", "Bu oy" |
| `chip--tap` | 44pt | **Tanlanadigan**: kategoriya, filtr |
| `badge` | 20pt | Son (o'qilmagan, kutilayotgan) |
| `avatar` | 38pt | Mijoz/xodim bosh harfi |

> **Muhim:** o'qish uchun chip 26pt bo'lishi mumkin, lekin **bosiladigan
> chip 44pt** bo'lishi SHART. Ikkita alohida klass shuning uchun.

→ SwiftUI: `Capsule()` + `.badge()` (List uchun)

---

## 14. Progress / Aging bar

**Anatomiya:** balandlik 8pt (thin 6) · radius to'liq · segmentlar yonma-yon.

**Aging (4 pog'ona):** 1–7 kun `--income` · 7–30 `--debt` ·
30–60 `--warning` · 60+ `--expense`. Ostida **legenda** — rang ko'rmaydigan
foydalanuvchi uchun matn bilan.

**Qarz limiti:** bitta segment, 80%+ da `--debt`, 100%+ da `--expense`.

**VoiceOver:** `"Qarz limiti, 84 foiz, 4 200 000 dan 5 000 000"`.

→ SwiftUI: `ProgressView` yoki `GeometryReader` + `Capsule`

---

## 15. Skeleton

**Spinner EMAS.** Ro'yxat shakli oldindan ko'rinadi — kontent kelganda
sahifa **sakramaydi**.

| Qachon | Nima |
|---|---|
| Ro'yxat yuklanmoqda | 3–5 skeleton qator |
| Karta yuklanmoqda | Sarlavha + qiymat bloklari |
| **Spinner** | Faqat **amal** natijasini kutganda (tugma ichida) |

**Reduce Motion:** pulsatsiya to'xtaydi, statik kulrang qoladi.

→ SwiftUI: `.redacted(reason: .placeholder)`

---

## 16. Empty state / Error state

**Anatomiya:** ikona 64×64 rangli fonda · sarlavha 20pt/620 ·
matn 15pt max 260px · CTA tugmasi.

**Qoida:** bo'sh holat **hech qachon** faqat "Ma'lumot yo'q" demaydi —
u **nima qilish kerakligini** aytadi va tugmani beradi.

| Holat | Ikona | Sarlavha | CTA |
|---|---|---|---|
| Yozuv yo'q | `list` | "Bu oyda hali yozuv yoʻq" | "Yozuv qoʻshish" |
| Ombor bo'sh | `box` | "Ombor boʻsh" | "Mahsulot qoʻshish" |
| Qarz yo'q | `qarz` | "Ochiq qarz yoʻq" | — (bu yaxshi xabar) |
| Qidiruv | `search` | "Hech narsa topilmadi" | — |
| Offline | `offline` | "Internet yoʻq" | "Qayta urinish" |
| Xato | `warning` | "Nimadir notoʻgʻri ketdi" | "Qayta urinish" |
| Huquq yo'q | `lock` | "Bu boʻlim sizga ochiq emas" | — |

→ SwiftUI: `ContentUnavailableView`

---

## 17. Toast / Banner

| Komponent | Joyi | Davomiylik |
|---|---|---|
| `toast` | Tab bar ustida | 2.5s, avtomatik yo'qoladi |
| `banner--offline` | Navbar ostida | **Doimiy** (holat o'tguncha) |
| `banner--sync` | Navbar ostida | Sinxronizatsiya davomida |
| `banner--readonly` | Navbar ostida | Obuna tugaguncha |

**Offline banner sariq, qizil EMAS** — bu xato emas, holat. Qizil
foydalanuvchini qo'rqitadi.

**VoiceOver:** toast — `.accessibilityAddTraits(.updatesFrequently)` +
e'lon (`UIAccessibility.post(.announcement)`).

→ SwiftUI: `.overlay(alignment: .bottom)` + `.transition(.move(edge: .bottom))`

---

## 18. Alert / Action sheet

**Alert** — qaytarib bo'lmaydigan tasdiq uchun: sotuvni bekor qilish,
hisobni o'chirish. Destruktiv amal **o'ngda** va qizil.

**Action sheet** — 2–5 variantdan tanlash: FAB menyusi, qator amallari.
"Bekor qilish" alohida guruhda, pastda.

→ SwiftUI: `.alert(_:isPresented:)` · `.confirmationDialog(_:isPresented:)`

---

## 19. Grafiklar

| Tur | Qachon | Balandlik |
|---|---|---|
| Ustunli (bar) | 6 oylik dinamika | 132pt |
| Donut | Kategoriya taqsimoti | 128×128 |
| Sparkline | Kartochka ichidagi trend | 56pt |

**Rang:** `--chart-1` … `--chart-5`, kategoriyaga **doimiy** biriktiriladi
(har ochilganda o'zgarmaydi). Matn emas — 3:1 kontrast yetarli.

**VoiceOver:** grafik `.accessibilityChartDescriptor` bilan — har ustun
o'qiladi ("Avgust, 47 million").

→ SwiftUI: **Swift Charts** (`BarMark`, `SectorMark`, `LineMark`)

---

## 20. POS komponentlari ⚠️ MISSING

| Komponent | Holat |
|---|---|
| `cart-row` | Backend MISSING — `SaleItem` modeli yo'q |
| `cart-total` | ⇡ |
| `pay-grid` (aralash to'lov) | Backend MISSING |
| Shtrix-kod skaner | Backend MISSING — `Product.barcode` yo'q |

Komponentlar **loyihalandi va renderlandi** (BAL-900, 15–16 guruh), lekin
ular ishlashi uchun backend ishi kerak — `BACKEND-GAPS.md` C bo'limi.

---

## 21. Pull to refresh

**Anatomiya:** 44pt zona · spinner + "Yangilanmoqda".

**Qayerda:** har ro'yxat ekranida. Offline'da — "Internet yo'q" toast'i.

→ SwiftUI: `.refreshable { }`

---

## Komponent → ekran xaritasi

| Komponent | Asosiy ekranlar |
|---|---|
| navLarge | BAL-040, 100, 150, 130, 200 |
| navBiznes | BAL-020, 070 |
| tabbar | barcha root ekran |
| stat | BAL-020, 150, 050 |
| list-row | BAL-040, 075, 100, 151, 160 |
| amount-input | BAL-043, 153, 056 |
| stepper | BAL-071, 081, 134 |
| segmented | BAL-043, 041, 200 |
| pay-grid | BAL-072, 083 |
| aging bar | BAL-150, 156 |
| donut | BAL-022, 202 |
| empty state | BAL-024, 067, 108, 138, 158, 301 |
| banner | BAL-302, 303, 307 |
| sheet | BAL-021, 025, 041, 045, 072 |
