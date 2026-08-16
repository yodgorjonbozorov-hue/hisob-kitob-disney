# BALANSA iOS — EKRAN SPESIFIKATSIYALARI

**Ekranlar reyestri:** `SCREEN-MAP.md` · **Komponentlar:** `COMPONENT-LIBRARY.md`
**Backend dalillari:** `FEATURE-INVENTORY.md` · **Renderlar:** `design/screens/`

**BACKEND STATUS** — bu hujjatning eng muhim ustuni:
**READY** backend to'liq bor · **PARTIAL** shakl mos emas yoki qismi yetishmaydi ·
**MISSING** backend'da umuman yo'q.

---

## STATISTIKA

| Holat | Ekran | Ulush |
|---|---:|---:|
| **READY** | 78 | 75% |
| **PARTIAL** | 15 | 14% |
| **MISSING** | 11 | 11% |
| **Jami** | **104** | |

**Renderlangan:** 33 ekran (41 PNG, light + dark) — MVP va eng murakkab
oqimlar. Qolganlari spec darajasida (quyida), render FAZA 7 davomida.

---

# 000–019 · AUTH VA ONBOARDING

## BAL-001 · Kirish / Login

1. **ID** BAL-001
2. **Nomi** Kirish / Sign in
3. **Maqsad** Foydalanuvchini telefon raqami va parol bilan tizimga kiritadi.
4. **Oqim** Splash (BAL-000) → **BAL-001** → BAL-006 (parol majburiy) yoki BAL-007 (biznes tanlash) yoki bosh ekran.
5. **Komponentlar** Text field ×2 · Button (primary) · Button (tertiary).
6. **Amallar** `Kirish` → server tekshiradi → `.success` / `.error` haptika. `Roʻyxatdan oʻting` → BAL-002.
7. **Bo'sh holat** — (yo'q)
8. **Yuklanmoqda** Tugma ichida spinner, **kenglik o'zgarmaydi**. Maydonlar disabled.
9. **Xato** Tarmoq → BAL-304. Login/parol → maydon ostida "Login yoki parol notoʻgʻri" (**qaysi biri xato ekani aytilmaydi** — xavfsizlik). Rate limit → "15 daqiqadan keyin urining" + hisoblagich.
10. **Huquq** — (sessiyasiz ekran)
11. **Dark** Logo bloki bir xil; fon `--bg-base` → `#061413`.
12. **Render** `BAL-001-kirish.png`
13. **BACKEND** ⚠️ **PARTIAL** — `POST /api/auth/login` bor (`src/app/api/auth/login/route.ts:39`), lekin **cookie sessiya** qaytaradi (`iron-session`, `src/lib/auth/session.ts:29-38`). Mobil ilova uchun **JWT + refresh token** kerak. Rate limit (8/5min IP, 5/15min login) allaqachon bor va mobil uchun ham to'g'ri.

## BAL-004 · Onboarding — biznes turi

1–2. **BAL-004** · Biznes turi / Business type
3. **Maqsad** Yangi tenant uchun biznes turini aniqlaydi — bu `Business.omborli` va `Business.turi` ni belgilaydi, ya'ni butun keyingi navigatsiyani.
4. **Oqim** BAL-003 → **BAL-004** → BAL-005 (kassa va kategoriyalar) → BAL-020.
5. **Komponentlar** Nav (inline, "2 / 3") · List row (chevron bilan) · Button.
6. **Amallar** Qatorni tanlash → `.light` haptika, tanlangan qator `--accent-wash` foniga o'tadi; `Davom etish` faollashadi.
7–8. — (yangi hisob, bo'sh/loading yo'q)
9. **Xato** Saqlashda tarmoq xatosi → toast + qayta urinish.
10. **Huquq** Faqat OWNER (signup egasi).
11. **Dark** Tanlangan qator `--accent-wash` = `#134e4a`.
12. **Render** `BAL-004-onboarding-turi.png`
13. **BACKEND** ✅ **READY** — `createTenantWithOwner` (`src/lib/services/signup.ts:127`) `Business` yaratadi; `omborli` va `turi` maydonlari mavjud (`schema.prisma:139,142`).

---

# 020–039 · HOME DASHBOARD

## BAL-020 · Asosiy — direktor

1–2. **BAL-020** · Asosiy / Dashboard
3. **Maqsad** "Bugun/bu oy biznes qanday ketyapti?" — direktor ilovani shu savol bilan ochadi. Sof foyda ekranning eng katta elementi.
4. **Oqim** Login → **BAL-020**. Chiqish: KPI → BAL-201, yozuv → BAL-042, "Barchasi" → BAL-040, biznes nomi → BAL-025.
5. **Komponentlar** navBiznes · Chip · Stat card ×2 · Chart (bar) · Section header · List (4 qator) · Tab bar (OWNER).
6. **Amallar** Oy chipiga tegish → BAL-021 sheet (`.light`). Biznes → BAL-025 (`.light`). Yozuv → BAL-042. Pull-to-refresh → yangilanadi.
7. **Bo'sh** → BAL-024 (alohida ekran).
8. **Yuklanmoqda** KPI va grafik **skeleton**; tab bar va navbar darhol chiziladi (sakrash bo'lmaydi).
9. **Xato** Tarmoq → banner + keshdagi oxirgi ma'lumot "eskirgan" belgisi bilan.
10. **Huquq** OWNER/ADMIN. CASHIER va SELLER bu ekranni **ko'rmaydi** — ularning tab bari boshqa (`registry.ts:61` — `/app` faqat BOSHQARUVCHILAR).
11. **Dark** Grafik ustunlari `--accent` = mint. Kartalarda soya o'rniga chegara.
12. **Render** `BAL-020-asosiy.png` · `-dark.png`
13. **BACKEND** ✅ **READY** — `GET /api/dashboard/summary`, `/trend`, `/category-breakdown` (`src/lib/queries/dashboard.ts`). Barcha KPI mavjud.

> ⚠️ **Unumdorlik eslatmasi:** hozir 3 ta alohida so'rov. Mobil uchun bitta
> `/api/mobile/dashboard` afzal (bitta radio uyg'onishi) — `BACKEND-GAPS.md` D.

## BAL-024 · Asosiy — bo'sh holat

3. **Maqsad** Yangi biznesda "nima qilishim kerak?" savoliga javob.
7. **Bo'sh holat** Ikona `chart` · "Bu oyda hali yozuv yoʻq" · "Birinchi kirim yoki chiqimni qoʻshing — hisobot va grafiklar oʻzi shakllanadi." · CTA "Birinchi yozuvni qoʻshish".
12. **Render** `BAL-024-asosiy-empty.png`
13. **BACKEND** ✅ **READY**

## BAL-025 · Biznes almashtirgich

3. **Maqsad** Bir nechta biznesli tenantda aktiv biznesni almashtirish.
4. **Oqim** navBiznes → sheet (`.medium`) → tanlangach ekran yangilanadi.
5. **Komponentlar** Sheet (medium) · List (avatar bilan).
6. **Amallar** Tanlash → `.light` → `POST /api/me/active-business` → butun ilova yangilanadi.
10. **Huquq** Ko'rinadigan bizneslar `getAccessibleBusinesses` bilan cheklanadi. **CASHIER faqat o'ziga biriktirilgan biznesni ko'radi** (`User.businessId`, `schema.prisma:209`) — unda bu sheet umuman ochilmaydi.
12. **Render** `BAL-025-biznes-tanlash.png`
13. **BACKEND** ✅ **READY** — `POST /api/me/active-business`.

---

# 040–069 · MOLIYA

## BAL-040 · Yozuvlar ro'yxati

1–2. **BAL-040** · Yozuvlar / Transactions
3. **Maqsad** Barcha kirim/chiqimni ko'rish, filtrlash, tuzatish. Kuniga 3–15 marta ochiladi.
4. **Oqim** Tab 2 → **BAL-040**. Qator → BAL-042. Filtr → BAL-041. FAB → BAL-043.
5. **Komponentlar** navLarge · Segmented · Guruh sarlavhasi (kun) · List (swipe amallari bilan) · Tab bar.
6. **Amallar** Segment (`.light`) · qator → tafsilot · **swipe chapga** → Tahrir / O'chirish · pull-to-refresh.
7. **Bo'sh** → BAL-067.
8. **Yuklanmoqda** → `BAL-040-yozuvlar-loading.png` — 5 skeleton qator, guruh sarlavhalari darhol.
9. **Xato** Tarmoq → offline banner (BAL-302), kesh ko'rsatiladi.
10. **Huquq** `tranzaksiya.korish`. **SELLER faqat O'ZI kiritgan yozuvlarni ko'radi** (`src/lib/auth/visibility.ts` → `transactionScopeUserId`). O'chirish — faqat manager.
11. **Dark** Ajratkichlar `rgba(226,240,238,.14)`, soya yo'q.
12. **Render** `BAL-040-yozuvlar.png` · `-dark.png` · `-loading.png`
13. **BACKEND** ✅ **READY** — `GET /api/transactions` (`src/lib/queries/transactions.ts`), swipe amallari uchun `PATCH/DELETE /api/transactions/[id]`.

## BAL-043 · Yangi yozuv

1–2. **BAL-043** · Yangi yozuv / New transaction
3. **Maqsad** **Ilovaning eng ko'p ishlatiladigan ekrani.** 4 tegishda kirim/chiqim yozish.
4. **Oqim** FAB → sheet (`.large`) → saqlangach yopiladi va ro'yxat tepasida yangi qator chaqnaydi.
5. **Komponentlar** Sheet (large) · Segmented (moliyaviy) · **Amount input** · Chip (kategoriya, tap) · Chip (kassa, sana) · Button.
6. **Amallar** Segment almashtirish → summa **rangi o'zgaradi** (yashil↔qizil), `.light`. Kategoriya chipi → `.light`. Saqlash → `.success`, sheet yopiladi.
7. — 8. Saqlashda tugma spinner.
9. **Xato** Summa 0 → tugma **o'chiq** (xato xabari yo'q — shovqin). Tarmoq → navbatga, sheet baribir yopiladi va qator "yuborilmoqda" belgisi bilan chiqadi. 402 (obuna) → BAL-307.
10. **Huquq** `tranzaksiya.yaratish` — **SELLER'da bor** (3 ta huquqidan biri).
11. **Dark** Amount input rangi `--income` = `#4ade80`.
12. **Render** `BAL-043-yangi-yozuv.png`
13. **BACKEND** ✅ **READY** — `POST /api/transactions` (`src/lib/services/transactionService.ts`). Zod: `src/lib/validation/transaction.ts`.
    ⚠️ **Offline uchun** `idempotencyKey` qabul qilishi kerak — hozir yo'q (`BACKEND-GAPS.md` D).

## BAL-050 · Kassalar

3. **Maqsad** Har kassaning qoldig'i bir ekranda; pul qayerda ekanini ko'rish.
5. **Komponentlar** navInline · Card (jami) · List · Button (secondary).
10. **Huquq** `kassa.korish` — CASHIER'da bor. O'tkazma — `pul.berish`.
12. **Render** `BAL-050-kassalar.png`
13. **BACKEND** ✅ **READY** — `GET /api/accounts`, `POST /api/accounts/transfer` (`services/accounts.ts`).

## BAL-056 · Smena yopish — naqd sanash

3. **Maqsad** Kassir smena oxirida naqdni sanaydi; farq darhol ko'rinadi.
4. **Oqim** Kassam tab → "Smenani yopish" → **BAL-056** → BAL-057 (farq) → topshiriladi.
5. **Komponentlar** Card (kutilgan naqd + hisob-kitob izohi) · **Amount input** · Card (farq, ogohlantirish) · Text field (izoh) · Button.
6. **Amallar** Summa terish → farq **jonli** hisoblanadi. Farq ≠ 0 → `.warning` + izoh **majburiy**. Topshirish → `.success`.
9. **Xato** Internet yo'q → **tugma o'chiq**, sabab: "Kutilgan naqd serverdan hisoblanadi".
10. **Huquq** CASHIER va yuqori.
11. **Dark** Ogohlantirish kartasi `--debt-soft` = `#38280c`.
12. **Render** `BAL-056-smena-sanash.png`
13. **BACKEND** ✅ **READY** — `POST /api/kunlik/smena` → `smenaYop` (`src/lib/services/smena.ts:116`). Kutilgan naqd server tomonda oyna bo'yicha hisoblanadi (`:146`).

## BAL-067 · Yozuvlar — bo'sh

7. **Bo'sh holat** `list` ikonasi · "Bu oyda hali yozuv yoʻq" · CTA "Yozuv qoʻshish".
12. **Render** `BAL-067-yozuvlar-empty.png`
13. **BACKEND** ✅ **READY**

---

# 070–099 · SOTUV / POS

## BAL-070 · Sotuv — mahsulot tanlash

1–2. **BAL-070** · Sotuv / Sell
3. **Maqsad** Kassirning ish kunining 80% shu ekranda. Mahsulotni **2 tegishda** topish.
4. **Oqim** Tab 1 (kassir) → **BAL-070** → BAL-071 (miqdor).
5. **Komponentlar** navLarge + skaner tugmasi · Search bar · Chip (kategoriya filtri) · List · Tab bar (CASHIER).
6. **Amallar** Qidiruv (2 belgidan, 300ms debounce) · kategoriya chipi `.light` · mahsulot → BAL-071 · **skaner** → BAL-084.
7. **Bo'sh** → BAL-108 ("Ombor boʻsh" + "Mahsulot qoʻshish").
8. **Yuklanmoqda** Skeleton qatorlar.
9. **Xato** Internet yo'q → keshdagi ro'yxat + banner "Sotuv uchun internet kerak", qatorlar **o'chiq**.
10. **Huquq** `sotuv.yaratish` — CASHIER'da bor, **SELLER'da YO'Q**. SELLER'ning tab barida bu tab umuman yo'q.
11. **Dark** Kam qolgan mahsulot `--debt` = `#fbbf24`.
12. **Render** `BAL-070-sotuv.png` · `-dark.png`
13. **BACKEND** ✅ **READY** (ro'yxat) — `GET /api/products`.
    ⚠️ Skaner tugmasi → **MISSING** (`Product.barcode` yo'q).

## BAL-071 · Sotuv — miqdor va narx

3. **Maqsad** Miqdor va (kerak bo'lsa) kelishilgan narxni belgilash.
5. **Komponentlar** navInline · Card (qoldiq) · **Stepper** · Card (narx + "Oʻzgartirish") · Card (accent, jami) · Button.
6. **Amallar** Stepper `.light`; qoldiqdan oshsa `.warning` va "Maks 48" qizil bo'ladi.
9. **Xato** BAL-085 (ombor yetarli emas) — server rad etsa ham.
12. **Render** `BAL-071-sotuv-miqdor.png`
13. ⚠️ **PARTIAL** — `POST /api/sales` bor, lekin `miqdor` **`Int`** (`schema.prisma:615`). **Kasr miqdor (1.5 kg) ishlamaydi.** Stepper komponenti tayyor, backend emas.

## BAL-072 · To'lov turi

5. **Komponentlar** Card (accent, to'lanadi) · **pay-grid** (4 variant) · Button.
6. **Amallar** Variant tanlash `.light`. "Qarz" → BAL-073. "Yakunlash" → BAL-074, `.success`.
12. **Render** `BAL-072-sotuv-tolov.png`
13. ⚠️ **PARTIAL** — `Sale.tolovTuri` faqat `"naqd" | "qarz"` (`schema.prisma:618`). **Click/karta alohida turi sifatida yo'q** (kassa `accountId` orqali ajratiladi), **aralash to'lov MISSING** — ekranda o'chiq ko'rsatilgan va sababi yozilgan.

## BAL-073 · Qarzga sotish — mijoz tanlash

3. **Maqsad** Mijozni tanlash va **qarz limitini darhol ko'rsatish** — pul ko'chada qolmasin.
5. **Komponentlar** Search · List (avatar + ochiq qarz) · Card (limit progress bari) · Button.
6. **Amallar** Mijoz tanlash → limit kartasi **darhol** yangilanadi. Limit 80%+ → `.warning` + sariq. Limit oshsa → qizil, tugma "Direktordan ruxsat soʻrash" ga aylanadi.
9. **Xato** Limit oshdi → BAL-086.
12. **Render** `BAL-073-sotuv-mijoz.png`
13. ✅ **READY** — `GET /api/debts/mijozlar`; limit serverda `qarzLimitTekshirTx` (`services/inventory.ts:160`).

## BAL-074 · Chek

3. **Maqsad** Sotuv yakunlandi degan aniq tasdiq + chekni ulashish.
5. **Komponentlar** Katta ✓ doira · Amount · Card (satrlar + tafsilot) · Button ×2.
6. **Amallar** `.success` haptika ekran ochilganda. "Chekni ulashish" → **native share sheet**. "Yangi sotuv" → BAL-070.
12. **Render** `BAL-074-chek.png`
13. ⚠️ **PARTIAL** — `GET /api/sales/[id]/receipt` bor, lekin HTML/PDF qaytaradi. Mobil uchun **native ulashishga** mos format kerak (`lib/native/kopruk.ts` dagi `faylUlash` naqshi).

## BAL-080 · Savat (ko'p mahsulotli sotuv)

3. **Maqsad** Bir mijozga bir necha mahsulotni **bitta sotuvda** rasmiylashtirish.
5. **Komponentlar** cart-row ×N · Stepper (kasr) · cart-total · Button (tertiary, chegirma) · Button (primary).
12. **Render** `BAL-080-savat.png` — ekranda **ochiq ogohlantirish banneri**: "Backend'da yoʻq — bu maqsadli dizayn".
13. ❌ **MISSING** — `Sale` bitta mahsulot saqlaydi (`schema.prisma:613-617`), `SaleItem` modeli **yo'q**. Kerak: yangi model + `createSale` ni qayta yozish. Batafsil `BACKEND-GAPS.md` C-1.

## BAL-085 · Ombor yetarli emas

9. **Xato holati** Alert: "Omborda yetarli emas" + aniq raqamlar ("3 dona qoldi, siz 5 dona sotmoqchisiz") + ikkita chiqish: "Qoldiqni tekshirish" / "3 ta sotish".
12. **Render** `BAL-085-ombor-yetmadi.png`
13. ✅ **READY** — server atomik tekshiradi (`services/inventory.ts:167-173`), klient oldindan ko'rsatadi.

---

# 100–149 · OMBOR VA XARID

## BAL-100 · Ombor

5. **Komponentlar** navLarge · Stat ×2 · List (qoldiq bilan, kam qolganlar `--debt`).
10. **Huquq** `mahsulot.korish`. Qo'shish — `mahsulot.qoshish` (CASHIER'da **yo'q**).
12. **Render** `BAL-100-ombor.png`
13. ✅ **READY** — `GET /api/products`; `minQoldiq` (`schema.prisma:520`) kam qolganlarni belgilaydi.

## BAL-104 · Ombor kirimi

12. **Render** `BAL-104-ombor-kirim.png`
13. ✅ **READY** — `POST /api/stock` → `createStockEntry` (`services/inventory.ts:104`).

## BAL-130 · Xarid buyurtmalari

12. **Render** `BAL-130-xarid.png`
13. ✅ **READY** — `GET /api/xarid/orders` (PRO tarif, `XARID` moduli).

## BAL-115 / BAL-116 · Omborlar (multi-warehouse)

13. ❌ **MISSING** — `Warehouse` modeli yo'q, qoldiq bitta (`Product.miqdor`). Loyihalandi, render qilinmadi.

---

# 150–179 · QARZ VA MIJOZLAR

## BAL-150 · Qarzlar dashboard

1–2. **BAL-150** · Qarzlar / Debts
3. **Maqsad** "Kimdan pul olishim kerak?" — direktorning ertalabki savoli. **Aging bari** ekranning markazida.
5. **Komponentlar** navLarge · Card (jami + **aging bar** + legenda) · Stat ×2 · List (eng eski tepada).
6. **Amallar** Aging segmentiga tegish → BAL-156 filtrlangan. Mijoz → BAL-152.
7. **Bo'sh** "Ochiq qarz yoʻq" — **CTA yo'q**, bu yaxshi xabar.
10. **Huquq** `qarz.korish` — CASHIER'da bor.
11. **Dark** Aging segmentlari yorqinlashadi; legenda matni `--label-2`.
12. **Render** `BAL-150-qarzlar.png` · `-dark.png`
13. ⚠️ **PARTIAL** — `GET /api/debts` va jamlar bor (`queries/qarz.ts`), lekin **4 pog'onali aging agregati YO'Q**. Hozir faqat 30/90 kunlik guruhlash (`queries/notifications.ts:183-184`). Klient tomonda hisoblash mumkin, lekin sahifalash bilan noto'g'ri chiqadi.

## BAL-152 · Qarz tafsiloti

5. **Komponentlar** navInline + qo'ng'iroq tugmasi · Card (qolgan, expense fon) · Card (progress) · List (to'lov tarixi) · Button ×2.
6. **Amallar** Qo'ng'iroq → **native `tel:`**. To'lov → BAL-153.
12. **Render** `BAL-152-qarz-tafsilot.png`
13. ✅ **READY** — `GET /api/debts/[id]`.

## BAL-153 · To'lov qabul qilish

6. **Amallar** "Toʻliq/Yarim/Boshqa" chipi → summa avtomatik. Qabul qilish → `.success`.
9. **Xato** Ikki marta bosish → **server himoyalangan**: `DebtPayment.idempotencyKey` + `@@unique([debtId, idempotencyKey])` (`schema.prisma:933,936`).
12. **Render** `BAL-153-qarz-tolov.png`
13. ✅ **READY** — `POST /api/debts/[id]/payment` → `qarzTolov` (`services/qarz.ts:217`). **Idempotentlik bor** — offline navbat uchun tayyor.

---

# 200–219 · HISOBOTLAR

## BAL-201 · Oylik hisobot

5. **Komponentlar** navInline + ulashish · Card (sof foyda) · Stat ×2 · Card (**donut** + legenda) · Card (qarz harakati).
6. **Amallar** Ulashish → native share (PDF/Excel).
11. **Dark** Donut ranglari `--chart-*` yorqin variantga o'tadi.
12. **Render** `BAL-201-hisobot.png` · `-dark.png`
13. ⚠️ **PARTIAL** — `GET /api/reports/monthly` READY; eksport `/excel`, `/pdf` bor, lekin **native ulashish oqimi** yo'q (fayl base64 + `Filesystem.writeFile` + `Share.share`).

---

# 240–279 · TASDIQLASH VA AI

## BAL-242 · Tasdiqlash

12. **Render** `BAL-242-tasdiqlash.png`
13. ✅ **READY** — `GET /api/tasdiqlash/sorovlar`, `POST /api/tasdiqlash/sorovlar/[id]`.
    ⚠️ Push bildirishnoma **MISSING** — hozir Telegram.

## BAL-260 · AI yordamchi

3. **Maqsad** Raqamlarni gap bilan so'rash. **Takliflar faqat AI javob bera oladigan savollar** — foydalanuvchi javobsiz savol bermasin.
5. **Komponentlar** Ikona bloki · List (4 taklif) · Input (pastda).
12. **Render** `BAL-260-ai.png`
13. ✅ **READY** — `POST /api/ai/chat`, 6 tool (`src/lib/ai/tools.ts`): `oylik_xulosa`, `kategoriya_taqsimoti`, `oylik_trend`, `qarzdorlik`, `crm_holati`, `vazifalar_holati`. **Ekrandagi 4 taklif shu 6 tooldan chiqadi.**

---

# 280–319 · PROFIL VA GLOBAL

## BAL-280 · Profil (sotuvchi)

3. **Maqsad** SELLER uchun 2-tab — sozlamalar, qulf, chiqish.
10. **Huquq** Har rol ko'radi, lekin **tarkibi farq qiladi**: OWNER'da "Foydalanuvchilar", "Modullar", "Hisobni oʻchirish" ham bor.
12. **Render** `BAL-280-profil.png`
13. ✅ **READY**

## BAL-283 · Face ID qulf

3. **Maqsad** Telefon boshqa qo'lga o'tsa moliyaviy ma'lumot ochilmasin.
4. **Oqim** Ilova ochilganda yoki fondan 60s+ dan keyin qaytganda — `fullScreenCover`.
6. **Amallar** Avtomatik Face ID so'raladi. Bekor → "Tasdiqlash" tugmasi. Biometrika ishlamasa → **qulf o'zi ochiladi** (foydalanuvchi ilovaga kira olmay qolmasin).
12. **Render** `BAL-283-qulf.png` · `-dark.png`
13. ⚠️ **PARTIAL** — klient tomoni **allaqachon yozilgan** (`src/lib/native/qulf.ts`, `src/components/native/IlovaQulfi.tsx` — Capacitor o'rami uchun). Native ilovada Keychain + refresh token kerak (`BACKEND-GAPS.md` D-2).

## BAL-290 · Hisobni o'chirish

3. **Maqsad** App Store 5.1.1(v) talabi — o'chirish ilova ichidan boshlanishi shart.
6. **Amallar** Kompaniya nomi yozilmaguncha tugma **o'chiq**. Bosilganda alert (qaytarib bo'lmaydi).
10. **Huquq** **Faqat OWNER.**
12. **Render** `BAL-290-hisob-ochirish.png`
13. ✅ **READY** — `POST /api/me/hisob-ochirish` (shu sessiyada yozildi), `lib/db/hisobOchirish.ts`, 30 kunlik bekor qilish oynasi.

## BAL-300 · Global qidiruv

12. **Render** `BAL-300-qidiruv.png`
13. ✅ **READY** — `GET /api/search` (min 2 belgi, 20/daqiqa).

## BAL-302 · Offline

3. **Maqsad** Internet uzilganda **nima ishlaydi va nima ishlamaydi** — ochiq aytiladi.
5. **Komponentlar** Banner (offline, **sariq — qizil emas**) · List (navbatdagi yozuvlar `sync` ikonasi bilan) · Card (bloklangan amallar ro'yxati).
12. **Render** `BAL-302-offline.png`
13. ❌ **MISSING** — offline navbat mexanizmi yo'q. Bitta pretsedent: `DebtPayment.idempotencyKey`.

---

## RENDER QILINMAGAN EKRANLAR (spec darajasida)

Quyidagilar `SCREEN-MAP.md` C bo'limida ro'yxatga olingan va yuqoridagi
naqshlar bo'yicha loyihalangan, lekin PNG hali yo'q:

| Diapazon | Ekranlar | Backend |
|---|---|---|
| 000–019 | BAL-000, 002, 003, 005, 006, 007, 008 | READY |
| 020–039 | BAL-021, 022, 023 | READY |
| 040–069 | BAL-041, 042, 044–049, 051–055, 057–066 | READY |
| 070–099 | BAL-075–078, 081–084, 086 | PARTIAL/MISSING |
| 100–149 | BAL-101–103, 105–111, 115, 116, 131–138 | READY (115/116 MISSING) |
| 150–179 | BAL-151, 154–158, 160–162, 170–173 | READY (156 PARTIAL) |
| 180–219 | BAL-180–192, 200, 202–205 | READY |
| 220–279 | BAL-220, 221, 225, 226, 240, 241, 243–245, 261, 262 | READY (225/226/245 MISSING) |
| 280–319 | BAL-281, 282, 284–289, 291, 292, 301, 303–308 | READY |
