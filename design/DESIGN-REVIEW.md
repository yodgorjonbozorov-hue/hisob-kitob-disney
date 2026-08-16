# DESIGN REVIEW — Balansa iOS

**Maqsad:** o'z ishimni tanqidiy ko'rib chiqish. Ma'qullash emas — kamchilik topish.

**Usul:** renderlangan 33 ekran + spec + tokenlar. Har topilma uchun
**ekran ID · muammo · tavsiya · jiddiylik**.

**Jiddiylik:** 🔴 KRITIK (tuzatilishi shart) · 🟡 MUHIM (V1 gacha) ·
🔵 YAXSHILASH (keyin).

---

## 0. TOPILMALAR — YIG'MA

| # | Topilma | Ekran | Jiddiylik | Holat |
|---|---|---|---|---|
| 1 | Kontrast: 3 rang AA dan o'tmadi | butun tizim | 🔴 | ✅ **TUZATILDI** |
| 2 | XXXL: stat kartalar stack'ga o'tmadi | BAL-020, 150, 201 | 🔴 | ✅ **TUZATILDI** |
| 3 | XXXL: tab yorliqlari yashirilmadi | barcha root | 🔴 | ✅ **TUZATILDI** |
| 4 | Sheet home indicator zonasiga yetmadi | BAL-025, 043, 153 | 🟡 | ✅ **TUZATILDI** |
| 5 | Viewport tegi yo'q → render jimgina buzilardi | quvur | 🔴 | ✅ **TUZATILDI** |
| 6 | Smena: farq sanashdan OLDIN ko'rinadi | BAL-056 | 🟡 | ⚠️ **OCHIQ** |
| 7 | "Yana" tab — chuqurlik yashiringan | BAL-020 | 🟡 | ⚠️ **OCHIQ** |
| 8 | Aging klientda hisoblanadi → sahifalashda buziladi | BAL-150, 156 | 🟡 | ⚠️ **OCHIQ** |
| 9 | BAL-201 hisobot — hali web sahifasiga o'xshaydi | BAL-201 | 🟡 | ⚠️ **OCHIQ** |
| 10 | Chek ekrani ortiqcha uzun | BAL-074 | 🔵 | ⚠️ **OCHIQ** |
| 11 | Bo'sh holat ikonalari bir-biriga o'xshash | BAL-024, 067 | 🔵 | ⚠️ **OCHIQ** |
| 12 | Offline: qaysi amal bloklangani ro'yxatda, tugmada emas | BAL-302 | 🟡 | ⚠️ **OCHIQ** |

**5 ta KRITIK topildi va tuzatildi. 6 ta ochiq qoldi** (V1 gacha).

---

## 1. IZCHILLIK — bir xil amal hamma joyda bir xilmi?

| Amal | Tekshirildi | Natija |
|---|---|---|
| Summa kiritish | BAL-043, 056, 153 | ✅ Uchalasida bir xil `amount-input`, bir xil klaviatura, bir xil format |
| Orqaga qaytish | BAL-071, 072, 073, 104, 152 | ✅ Har joyda `navInline` + chap yuqorida, matn bilan |
| Ro'yxat qatori | BAL-040, 070, 100, 150, 130 | ✅ Bir xil anatomiya (38pt ikona, 56pt balandlik, ajratkich matndan) |
| Asosiy tugma joyi | BAL-071, 072, 104, 152, 290 | ✅ Har doim **pastda**, safe area ustida |
| Destruktiv amal | BAL-085, 290 | ✅ Alert bilan, qizil, o'ngda |
| Bo'sh holat | BAL-024, 067 | ⚠️ **Topilma 11** — ikonalar juda o'xshash |

**Xulosa:** izchillik yaxshi. Sabab — ekranlar qo'lda emas, `lib.mjs`
komponent funksiyalaridan yig'ilgan. Bu ataylab qilingan qaror edi va
o'zini oqladi.

---

## 2. TEGISH SONI — FAZA 3 maqsadlariga erishildimi?

Renderlangan ekranlar bo'yicha **qayta o'lchandi**:

| Oqim | Maqsad | O'lchandi | |
|---|---:|---:|:-:|
| Tez kirim (SELLER) | ≤4 | **4** | ✅ |
| Tez chiqim | ≤4 | **4** | ✅ |
| POS sotuv (bugungi) | ≤6 | **6** | ✅ |
| POS savat bilan | ≤8 | **7** | ✅ |
| Qarzga sotish | ≤8 | **8** | ✅ |
| Qarz undirish | ≤6 | **5** | ✅ |
| Smena yopish | ≤5 | **5** | ✅ |
| Kunlik (direktor) | ≤2 | **2** | ✅ |
| Ombor kirimi | ≤6 | **6** | ✅ |
| AI savol | ≤1 | **1** | ✅ |

**Hammasi maqsadga tushdi.** Lekin bitta ogohlantirish: bu **ideal
holat** — birinchi urinishda, xatosiz. Real hayotda kassir noto'g'ri
mahsulot bosadi, orqaga qaytadi. Shuning uchun **orqaga qaytish yo'li
har ekranda ochiq** (`navInline` + swipe-back).

---

## 3. BIR QO'L BILAN ISHLASH

393×852 ekranda bosh barmoq zonasi — pastki ~55% (≈y 380–818).

| Element | Joyi (y) | Zonada? |
|---|---:|:-:|
| FAB | 765–817 | ✅ markazda |
| Asosiy tugma (BAL-071, 072, 104) | 744–788 | ✅ |
| Tab bar | 765–818 | ✅ |
| Ro'yxat qatorlari (birinchi 5 ta) | 180–460 | ⚠️ yuqori qism cho'ziladi |
| navbar amallar (search, filtr) | 60–104 | ❌ **yetib bo'lmaydi** |
| Biznes almashtirgich | 60–104 | ❌ |

**Baho:** asosiy amallar to'g'ri joyda. Yuqoridagi elementlar —
**kam ishlatiladigan** (qidiruv, filtr, biznes almashtirish), shuning
uchun qabul qilinadi. iOS'ning **Reachability** (pastki qirg'oqni pastga
surish) ham bor.

⚠️ **Topilma 7 (🟡):** "Yana" tab OWNER uchun **6 ta bo'limni** yashiradi
(Ombor, Xarid, Hisobot, CRM, Xodimlar, Sozlamalar). Direktor ombor
qoldig'ini ko'rish uchun 2 tegish qiladi. **Tavsiya:** "Yana" ekranida
eng ko'p ishlatiladigan 2 tasini yuqoriga chiqarish yoki tab barni
konfiguratsiya qilinadigan qilish (iOS'da `TabView` `.customizationBehavior`).

---

## 4. DYNAMIC TYPE XXXL

**Haqiqiy render bilan sinaldi** (`--type xxxl`), taxmin qilinmadi.

### Topilma 2 (🔴 → tuzatildi)
BAL-020 da ikkita stat karta XXXL da yon-yon qoldi — `DESIGN-SYSTEM.md`
E.2 da "vertikal stack" deb yozilgan edi, lekin **CSS'da amalga
oshirilmagan edi**. Hujjat bilan kod o'rtasidagi bo'shliq.
→ `[data-type="xxxl"] .row:has(> .stat) { flex-direction: column }` qo'shildi.

### Topilma 3 (🔴 → tuzatildi)
Tab yorliqlari XXXL da 20px bo'lib sig'masdi.
→ `[data-type="xxxl"] .tab__label { display: none }` — faqat ikona qoladi.

### Qolgan tekshiruv

| Ekran | XXXL holati |
|---|---|
| BAL-020 | ✅ stack, yorliqsiz tab, summa sig'adi |
| BAL-070 | ✅ ro'yxat qatorlari o'sadi, skroll qisqaradi |
| BAL-043 | ⚠️ sheet `.large` (88%) — XXXL da klaviatura bilan tor. **Tavsiya:** XXXL da `fullScreenCover` ga o'tish |
| BAL-150 | ✅ aging legendasi 2 qatorga tushadi |

---

## 5. DARK MODE

| Tekshiruv | Natija |
|---|---|
| Fon `#000` emasmi | ✅ `#061413` — chuqur teal, brendga bog'liq |
| Qatlamlar yuqoriga ochroqmi | ✅ base `#061413` → elevated `#0d211f` → elevated-2 `#132d2b` |
| Soya o'rniga chegara | ✅ `--shadow-card: none`, `--card-border` faol |
| Kontrast | ✅ 14/14 juft AA (o'lchandi) |
| Brend rangi ko'rinadimi | ✅ `#0f766e` → `#2dd4bf` (mint) ga siljidi |
| Moliyaviy ranglar | ✅ hammasi 6:1 dan yuqori |

⚠️ **Kichik kamchilik (🔵):** BAL-201 dagi donut ranglari dark'da
yorqinlashadi, lekin `--chart-3` (`#e5a184`) va `--chart-5` (`#bfa3c7`)
bir-biriga yaqinroq bo'lib qoladi. Rang ko'rmaydigan foydalanuvchi uchun
**legenda majburiy** — u bor, shuning uchun bloklovchi emas.

---

## 6. BO'SH VA XATO HOLATLAR

| Holat turi | Qamrab olindimi |
|---|---|
| Bo'sh (empty) | ✅ BAL-024, 067, 108, 138, 158, 301 |
| Yuklanmoqda | ✅ BAL-040-loading (skeleton) |
| Tarmoq xatosi | ✅ BAL-302, 304 |
| Server xatosi | ✅ BAL-305 (spec) |
| Validatsiya xatosi | ✅ BAL-043 (tugma o'chiq), BAL-085 (alert) |
| Huquq yo'q | ✅ BAL-306 (spec) |
| Obuna tugagan | ✅ BAL-307 (spec) |
| Biznes qoidasi xatosi | ✅ BAL-085 (ombor), BAL-086 (limit) |

⚠️ **Topilma 11 (🔵):** BAL-024 va BAL-067 bo'sh holatlarida `chart` va
`list` ikonalari kichik o'lchamda o'xshash ko'rinadi. **Tavsiya:** BAL-024
uchun boshqacha metafora (masalan, ochiq daftar yoki "boshlash" ishorasi).

---

## 7. ROL HOLATLARI — SELLER va OWNER haqiqatan farq qiladimi?

**Bu eng muhim tekshiruvlardan biri** — chunki men "bu uchta ilova"
degan qaror qabul qilgandim.

| | SELLER | CASHIER | OWNER |
|---|---|---|---|
| Tab soni | 2 + FAB | 4 + FAB | 4 + FAB |
| Birinchi ekran | Yozuvlar | **Sotuv** | **Asosiy** |
| Sotuv ko'radimi | ❌ | ✅ | ✅ |
| Dashboard/KPI | ❌ | ❌ | ✅ |
| Qarzlar | ❌ | ✅ | ✅ |
| Kassalar | ❌ | ✅ (o'ziniki) | ✅ (hammasi) |
| Yozuvlar ko'rish | **faqat o'ziniki** | biznesniki | hammasi |
| Hisobot | ❌ | ❌ | ✅ |

**Xulosa: ✅ ha, haqiqatan farq qiladi.** SELLER ilovasi 2 tabli,
CASHIER 4 tabli sotuv-markazli, OWNER 4 tabli hisobot-markazli.
Bu `katalog.ts:56-74` dagi haqiqiy huquqlarga asoslangan, o'ylab
topilmagan.

⚠️ **Ochiq savol:** SELLER ilovasi shu qadar kichikki, u ilovani
umuman o'rnatishga arziydimi? **Javob: ha** — chunki uning muqobili
qog'oz daftar. Lekin App Store sahifasida buni aytish kerak
(tavsifda "sotuvchi uchun ham" degan urg'u).

---

## 8. OFFLINE

| Tekshiruv | Natija |
|---|---|
| Offline banner bormi | ✅ BAL-302 |
| Rangi to'g'rimi | ✅ **sariq**, qizil emas (bu xato emas, holat) |
| Navbatdagi yozuv ko'rinadimi | ✅ `sync` ikonasi + "Navbatda" |
| Nima ishlamasligi aytiladimi | ⚠️ **Topilma 12** |

⚠️ **Topilma 12 (🟡):** BAL-302 da bloklangan amallar **kartada ro'yxat
sifatida** yozilgan ("sotuv, smena yopish, kun tasdiqlash"). Lekin
foydalanuvchi Sotuv tabiga bosganda nima bo'ladi? **Tavsiya:** tugmaning
O'ZIDA sabab bo'lsin — tab bosilganda ekran ochiladi, lekin markazda
"Sotuv uchun internet kerak — ombor qoldigʻi serverda tekshiriladi"
degan holat ekrani chiqsin. Ro'yxat kifoya emas.

---

## 9. "WEB KO'CHIRMASI" TESTI

Har ekranga savol: *"bu hali ham web sahifasiga o'xshaydimi?"*

| Ekran | Baho | Izoh |
|---|---|---|
| BAL-020 Asosiy | ✅ native | KPI + grafik + ro'yxat — iOS naqshi |
| BAL-040 Yozuvlar | ✅ native | Kun guruhlari + swipe — web'da jadval edi |
| BAL-043 Yangi yozuv | ✅ native | Sheet + katta summa — web'da uzun forma edi |
| BAL-070 Sotuv | ✅ native | Qidiruv + ro'yxat — web'da select edi |
| BAL-071–074 | ✅ native | **5 qadamli oqim** — web'da bitta forma edi |
| BAL-150 Qarzlar | ✅ native | Aging bar — web'da yo'q edi |
| BAL-152 Qarz tafsiloti | ✅ native | Qo'ng'iroq tugmasi — mobil imkoniyat |
| BAL-283 Qulf | ✅ native | Web'da umuman yo'q |
| BAL-302 Offline | ✅ native | Web'da yo'q |
| **BAL-201 Hisobot** | ⚠️ **web'ga o'xshaydi** | **Topilma 9** |

⚠️ **Topilma 9 (🟡):** BAL-201 — to'rtta karta ustma-ust, skroll bilan.
Bu **web sahifaning telefondagi ko'rinishi**, iOS ekrani emas.

**Tavsiya:** hisobotni **sahifalanadigan** (paged) qilish — chapga surish
bilan "Xulosa → Kategoriyalar → Qarz → Xodimlar" bo'limlari almashsin.
Yoki yuqorida segmented control. Skroll o'rniga **tanlash**.
Bu qayta loyihalashni talab qiladi — V1 ga qoldirildi.

---

## 10. "PREMIUM" TESTI — halol javob

*Savol: bu ekranlar Odoo / Excel / generic dashboard'ga o'xshaydimi?*

**Halol javob: yo'q, lekin sabablari aniq bo'lishi kerak.**

**Premium hissini beradigan narsalar:**

1. **Bitta savol — bitta ekran.** BAL-071 faqat miqdor so'raydi. Odoo
   bitta ekranda 20 ta maydon ko'rsatadi.
2. **Pul birinchi o'rinda.** BAL-020 da 40px sof foyda — ekranning
   markazi. Generic dashboard'da 12 ta bir xil kartochka bo'lardi.
3. **Kontekstga oid ogohlantirish.** BAL-073 da mijoz tanlanishi bilan
   qarz limiti **darhol** ko'rinadi. Bu Excel'da yo'q.
4. **Real terminologiya.** "Pul kirdi" / "Pul chiqdi", "Debet/Kredit" emas.
5. **Tabular raqamlar.** Ustunlar sakramaydi — bu sezilmaydi, lekin
   sezilmagani uchun premium.
6. **Dark rejim brendga bog'liq** (`#061413`, `#000` emas).

**Hali premium EMAS bo'lgan joylar:**

1. **BAL-201** (Topilma 9) — hisobot hali "sahifa".
2. **Harakat yo'q.** Statik PNG'da spring animatsiyalar, savatga qo'shish
   effekti, Liquid Glass lensing ko'rinmaydi. Premium hissining ~30%
   shu harakatda — u faqat SwiftUI'da paydo bo'ladi.
3. **Ikonalar o'zimizniki.** SF Symbols ishlatilsa (native ilovada)
   ancha yaxshi bo'ladi — ular Dynamic Type bilan avtomatik moslashadi.
4. **Bo'sh holat illyustratsiyalari yo'q** — hozir oddiy ikonalar.
   Premium ilovalarda maxsus chizilgan rasm bo'ladi.

**Umumiy baho: 7/10.** Yaxshi loyihalangan ish ilovasi, lekin "hayratda
qoldiradigan" emas. Bu **to'g'ri** — Balansa foydalanuvchisi
peshtaxtada turgan kassir, u hayratlanishni emas, tezlikni xohlaydi.

---

## 11. TUZATILGAN KRITIK TOPILMALAR (tafsilot)

### Topilma 1 🔴 — Kontrast (tizim darajasida)
`kontrast.mjs` bilan 28 juft o'lchandi. Uchtasi AA dan o'tmadi:
`income` **3.30:1**, `debt` **3.19:1**, `label-4` **2.56:1**.
`income` — **kirim summasining rangi**, ya'ni ilovaning eng muhim raqami.
→ Tuzatildi (5.02 / 5.02 / 3.58). Dark'da yana ikkitasi tuzatildi.

> Bu **veb ilovada ham bor** (`src/app/globals.css`). Brief bo'yicha
> mavjud kodga tegilmadi — `BACKEND-GAPS.md` da tavsiya sifatida.

### Topilma 5 🔴 — Render quvuri jimgina buzilardi
`isMobile` emulyatsiyasida `<meta name="viewport">` bo'lmasa Chromium
sahifani 980px kenglikda hisoblab kichraytiradi. **PNG chiqadi, lekin
noto'g'ri.** Birinchi render aynan shunday buzilgan edi.
→ `shot.mjs` endi teg yo'qligida **ochiq xato** beradi (fail-closed).

### Topilma 4 🟡 — Sheet home indicator zonasiga yetmasdi
`.sheet` `position: absolute` bo'lgani uchun `.screen` ichida qolardi va
ekran pastida oq chiziq ko'rinardi.
→ `position: fixed` + `.homebar { z-index: 70 }`.

---

## 12. OCHIQ TOPILMALAR — V1 gacha

| # | Topilma | Tavsiya | Kim |
|---|---|---|---|
| 6 | BAL-056: kutilgan naqd sanashdan oldin ko'rinadi — kassir unga moslab yozishi mumkin | Kutilgan summa ko'rinsin, lekin **farq** faqat sanalgan summa kiritilgandan keyin chiqsin. Yoki "yopiq sanash" rejimi (kutilgan summa yashiriladi) — sozlamada | Dizayn |
| 7 | "Yana" 6 bo'limni yashiradi | Eng ko'p ishlatiladigan 2 tasini yuqoriga; yoki moslashuvchan tab bar | Dizayn |
| 8 | Aging klientda hisoblansa sahifalashda buziladi | Server agregati kerak (`BACKEND-GAPS.md` B-3) | Backend |
| 9 | BAL-201 hisobot web'ga o'xshaydi | Sahifalanadigan (paged) qilib qayta loyihalash | Dizayn |
| 10 | BAL-074 chek uzun | Tafsilotni yig'iladigan (collapsible) qilish | Dizayn |
| 11 | Bo'sh holat ikonalari o'xshash | BAL-024 uchun boshqa metafora | Dizayn |
| 12 | Offline: sabab tugmada emas | Bloklangan ekranda holat ekrani + sabab | Dizayn |

---

## 13. XULOSA

**Kuchli tomonlar:**
- Izchillik yuqori — komponentdan yig'ilgani uchun
- Tegish soni maqsadlarga tushdi (10/10 oqim)
- Rol farqi haqiqiy, o'ylab topilmagan
- Kontrast **o'lchangan**, taxmin qilinmagan
- XXXL **haqiqiy render bilan** sinaldi

**Zaif tomonlar:**
- BAL-201 hali "web sahifa"
- Harakat va SF Symbols yo'q (statik renderning cheklovi)
- Bo'sh holatlar oddiy
- 71 ekran hali render qilinmagan (spec darajasida)

**Eng katta xavf dizaynda emas:** 11 ekran **MISSING** backend bilan.
Ular chiroyli loyihalangan, lekin ishlamaydi. Batafsil — `BACKEND-GAPS.md`.
