# USER FLOWS — Balansa iOS

Har oqim uchun: qadamlar, **tegish soni**, nima noto'g'ri ketishi mumkin,
haptika va offline xatti-harakati.

**Haptika turlari** (FAZA 4 da rasmiylashtiriladi):
`.light` tanlov · `.medium` savatga qo'shildi · `.success` yakunlandi ·
`.warning` chegaraga yaqin · `.error` bajarilmadi.

**Offline belgisi:** 🟢 to'liq ishlaydi · 🟡 navbatga tushadi · 🔴 ishlamaydi.

---

## 1. Birinchi kirish

**Maqsad:** yuklab olgandan ishlay boshlagunicha ≤ 6 tegish.

```
App Store
   │
   ▼
BAL-000 Splash ──── sessiya bor? ──► BAL-020 Asosiy
   │ yo'q                                  (0 tegish)
   ▼
BAL-001 Kirish
   │ [1] Login maydoni (telefon klaviaturasi darhol ochiladi)
   │ [2] Parol
   │ [3] "Kirish"
   ▼
mustChangePassword? ──ha──► BAL-006 Parol almashtirish  [+3]
   │ yo'q
   ▼
bir nechta biznes? ──ha──► BAL-007 Biznes tanlash  [+1]
   │ yo'q
   ▼
BAL-020 Asosiy (OWNER) / BAL-070 Sotuv (CASHIER) / BAL-040 Yozuvlar (SELLER)
```

**Tegish: 3** (odatiy) · **6** (parol almashtirish + biznes tanlash bilan)

| Nima noto'g'ri ketadi | Ilova nima qiladi |
|---|---|
| Login/parol xato | Bir xil xabar ("Login yoki parol noto'g'ri") — qaysi biri xato ekani aytilmaydi. `.error` haptika. |
| 5 marta xato (`login/route.ts` rate limit) | "15 daqiqadan keyin urining" + qolgan vaqt. Tugma o'chiriladi. |
| Internet yo'q | BAL-304 + "Qayta urinish". Login **offline ishlamaydi** (sessiya serverdan). |
| Hisob o'chirilmoqda | BAL-291 ga yo'naltiriladi (kod allaqachon bor: `lib/auth/tenant.ts`). |

**Haptika:** [3] muvaffaqiyat → `.success`; xato → `.error`.
**Offline:** 🔴 — login serverni talab qiladi. Buni ochiq aytamiz.

> **Dizayn qarori:** login maydoni `textContentType: .telephoneNumber`,
> chunki login = telefon raqami (`+998901234567`). Klaviatura darhol
> raqamli ochiladi — bitta tegish tejaladi.

---

## 2. Tez kirim (SELLER) — maqsad 10 soniya

**Bu ilovaning ENG KO'P ishlatiladigan oqimi.** Sotuvchi kuniga 10–30 marta.

```
BAL-040 Yozuvlar   (ilova shu yerdan ochiladi)
   │ [1] FAB (+)  ─ uzoq bossa to'g'ridan-to'g'ri kirimga
   ▼
BAL-043 Summa  (.large sheet, raqam klaviaturasi DARHOL ochiq)
   │ segmented: [Kirim] Chiqim     ← standart "Kirim"
   │ [2] summa teriladi: 250000
   │ [3] Kategoriya chipi (oxirgi 4 tasi tayyor turadi)
   │ [4] "Saqlash"
   ▼
BAL-040 ga qaytadi, yangi qator yuqorida yashil chaqnaydi
```

**Tegish: 4** (summa terish tegishga sanalmaydi)

**Nega 4 ta:** kassa, sana va to'lov turi **standart** qiymatda qoladi
(bugun, standart kassa, naqd). Ular sheet'da ko'rinadi, lekin tegish
talab qilmaydi. O'zgartirish kerak bo'lsa — ixtiyoriy [+1].

| Nima noto'g'ri ketadi | Ilova nima qiladi |
|---|---|
| Summa 0 yoki bo'sh | "Saqlash" o'chiq turadi. Xato xabari yo'q — shovqin. |
| Kategoriya tanlanmagan | Standart "Boshqa" kategoriyasi (`ensureCategory`, `inventory.ts:57`). |
| Internet yo'q | 🟡 Navbatga tushadi, qator "yuborilmoqda" belgisi bilan chiqadi. |
| Obuna tugagan (READONLY) | Yozish bloklangan (402, `tenant.ts`). BAL-307 ko'rsatiladi. |

**Haptika:** kategoriya chipi → `.light` · saqlandi → `.success` ·
summa 0 bilan saqlashga urinish → yo'q (tugma o'chiq).

**Offline:** 🟡 — `POST /api/transactions` navbatga tushadi (idempotency
kaliti bilan). Foydalanuvchi qatorni darhol ko'radi.

---

## 3. Tez chiqim

2-oqim bilan **bir xil ekran**, faqat segmented control "Chiqim" da.

```
BAL-040 → [1] FAB → BAL-043 → [2] "Chiqim" segmenti → summa
        → [3] kategoriya → [4] Saqlash
```

**Tegish: 4** (kirimdan farqi — segmentni almashtirish, lekin kategoriya
chipi baribir kerak, shuning uchun jami bir xil).

> **Nega bitta ekran:** ikkita alohida ekran qilish — web'ni ko'chirish
> bo'lardi. Kirim va chiqim bir xil ma'lumot (summa, kategoriya, kassa,
> izoh) so'raydi; farq faqat ishorada. Segmented control eng aniq yechim.
> Rang ham almashadi: kirim yashil, chiqim qizil — segmented ostidagi
> summa maydoni ham shu rangga bo'yaladi.

---

## 4. To'liq POS sotuvi ⚠️ MISSING

> **DIQQAT:** bu oqim backend'da **YO'Q**. `Sale` bitta mahsulot saqlaydi
> (`schema.prisma:613-617`), savat, kasr miqdor, chegirma va aralash
> to'lov modellari yo'q. Quyida **maqsadli** oqim — FAZA 9 da backend
> ishi hisoblanadi. Bugungi ishlaydigan oqim — 4b.

### 4a. Maqsadli oqim (savat bilan) — MISSING

```
BAL-070 Sotuv
   │ [1] Qidiruv maydoni (yoki [1] skaner tugmasi → BAL-084 kamera)
   │     mahsulot yozildi/skanerlandi
   │ [2] mahsulotga tegish → savatga qo'shiladi (.medium haptika)
   ▼
BAL-080 Savat  (pastdan ko'tarilgan panel, doim ko'rinib turadi)
   │     har qator: nomi · miqdor stepper · summa
   │ [3] miqdorni o'zgartirish (stepper) — kasr ham: 1.5 kg
   │ [4] (ixtiyoriy) chegirma → BAL-082
   │ [5] "To'lovga" tugmasi
   ▼
BAL-083 To'lov
   │ [6] to'lov turi: Naqd | Karta | Qarz | Aralash
   │     "Aralash" tanlansa: har turga summa taqsimlanadi
   │ [7] "Yakunlash"
   ▼
BAL-074 Chek — .success haptika, katta ✓, "Yangi sotuv" tugmasi
```

**Tegish: 7** (bitta mahsulot) · **+2 har qo'shimcha mahsulot uchun**

### 4b. Bugungi ishlaydigan oqim (bitta mahsulot) — READY

```
BAL-070 → [1] qidiruv → [2] mahsulot tanlash
        → BAL-071 [3] miqdor (butun son!) → [4] "Davom"
        → BAL-072 [5] Naqd yoki Qarz
        → [6] "Yakunlash" → BAL-074 chek
```

**Tegish: 6**

| Nima noto'g'ri ketadi | Ilova nima qiladi |
|---|---|
| Omborda yetarli emas | BAL-085. Server atomik tekshiradi (`inventory.ts:167-173`) — klient ham oldindan ko'rsatadi, lekin **haqiqat serverniki**. `.error` haptika. |
| Sotuv narxi kiritilmagan | "Narx kiriting" — inline maydon ochiladi (`inventory.ts:150`). |
| Qarz limiti oshdi | BAL-086. `.warning` haptika. Direktordan ruxsat so'rash tugmasi (TASDIQLASH moduli bo'lsa). |
| Qarzda mijoz nomi yo'q | "Davom" o'chiq (`inventory.ts:153`). |
| Internet yo'q | 🔴 **Sotuv offline ishlamaydi** — ombor qoldig'i serverda atomik kamayadi. Ikki qurilma bir vaqtda sotsa qoldiq buziladi. BAL-302 da ochiq aytiladi: "Sotuv uchun internet kerak". |

**Haptika:** savatga qo'shildi → `.medium` · miqdor stepper → `.light` ·
qarz limitiga yaqin (80%+) → `.warning` · sotuv yakunlandi → `.success` ·
ombor yetarli emas → `.error`.

**Offline:** 🔴 sotuv · 🟢 mahsulot ro'yxatini ko'rish (keshdan).

---

## 5. Qarzga sotish

```
BAL-070 → [1][2] mahsulot → BAL-071 [3] miqdor → [4] Davom
   ▼
BAL-072 To'lov turi → [5] "Qarz"
   ▼
BAL-073 Mijoz tanlash
   │  qidiruv + "Yangi mijoz" bitta maydonda
   │  (web'dagi MijozTanlash naqshi — components/qarz/MijozTanlash.tsx)
   │ [6] mijozni tanlash
   │     ┌─ limit tekshiruvi (server: qarzLimitTekshirTx)
   │     │  ochiq qarz / limit progress bari DARHOL ko'rinadi
   │     └─ 80%+ bo'lsa sariq, oshsa qizil
   │ [7] (ixtiyoriy) muddat tanlash — standart +30 kun
   │ [8] "Qarzga berish"
   ▼
BAL-074 Chek — "Qarz: Karim aka · 25-avgustgacha"
```

**Tegish: 8**

> **Muhim server xatti-harakati:** qarzga sotuvda **kirim YOZILMAYDI**
> (`inventory.ts:227-244`). Sof foyda oshmaydi. Buni ekranda ham
> aytamiz: chekda "Bu summa hali kassaga tushmadi" izohi.

| Nima noto'g'ri ketadi | Ilova |
|---|---|
| Limit oshdi | `.warning` → "Karim akaning ochiq qarzi 4 200 000, limit 5 000 000. Yana 1 200 000 mumkin." Davom etish uchun direktor tasdig'i. |
| Mijoz yangi | Ism + telefon (telefon normallashtiriladi: `+998901234567`). |

**Offline:** 🔴 (ombor + limit serverda).

---

## 6. Qarz undirish

**Bu direktorning ertalabki ishi.** "Kimdan pul olishim kerak?"

```
BAL-150 Qarzlar dashboard
   │  ┌──────────────────────────────┐
   │  │ Ochiq qarz     18 400 000    │
   │  │ ▓▓▓▓▓░░░░░  kechikkan 6.2M   │  ← aging bari
   │  └──────────────────────────────┘
   │ [1] "Kechikkan" segmentiga tegish
   ▼
BAL-156 Aging ro'yxati  (PARTIAL — 4 pog'ona backend'da yo'q)
   │  60+ kun ▸ Dilshod aka   2 100 000   ← eng eski tepada
   │  30-60   ▸ Karim aka     1 850 000
   │ [2] mijozga tegish
   ▼
BAL-152 Qarz tafsiloti
   │  to'lov tarixi · qolgan summa · muddat
   │ [3] ☎️ qo'ng'iroq  (tel: havolasi — native qo'ng'iroq)
   │     ...gaplashdi, pul olib keldi...
   │ [4] "To'lov qabul qilish"
   ▼
BAL-153 To'lov
   │ [5] summa (standart: to'liq qoldiq)
   │ [6] kassa tanlash (standart: naqd)
   │ [7] "Qabul qilish"
   ▼
.success — qarz qatori yopiladi yoki kamayadi
```

**Tegish: 7** (qo'ng'iroq bilan) · **5** (qo'ng'iroqsiz)

| Nima noto'g'ri ketadi | Ilova |
|---|---|
| Ikki marta "Qabul qilish" bosildi | **Server himoyalangan**: `DebtPayment.idempotencyKey` (`schema.prisma:933`). Klient forma ochilganda kalit yaratadi. Ikkinchi bosishda mavjud to'lov qaytadi. |
| Qisman to'lov | Qo'llab-quvvatlanadi — qarz `PARTIALLY_PAID` ga o'tadi. |
| Internet yo'q | 🟡 navbatga — idempotentlik kaliti borligi uchun **xavfsiz**. |

**Haptika:** to'lov qabul qilindi → `.success` · qarz to'liq yopildi →
`.success` + qator yashil chaqnab yo'qoladi.

**Offline:** 🟡 to'lov qabul qilish (idempotentlik bor) · 🟢 ro'yxatni ko'rish.

---

## 7. Smena yopish

```
BAL-053 Mening kassam  (yoki Kassam tab)
   │ [1] "Smenani yopish"
   ▼
BAL-056 Naqd sanash
   │  Kutilgan naqd:  3 450 000     ← server hisoblaydi (smena.ts:146)
   │  ┌────────────────────────┐
   │  │ Sanalgan naqd          │    ← katta raqam klaviaturasi
   │  │        3 4 2 0 0 0 0   │
   │  └────────────────────────┘
   │ [2] summa teriladi
   │ [3] "Hisoblash"
   ▼
BAL-057 Farq
   │  Farq: −30 000   (kam chiqdi)     ← qizil, .warning haptika
   │  [4] izoh (majburiy, farq bo'lsa)
   │  [5] "Topshirish"
   ▼
.success — smena yopildi, direktorga Telegram xabari
```

**Tegish: 5**

> **Nega "kutilgan naqd" avval ko'rsatiladi:** kassir sanashdan oldin
> raqamni ko'rsa, unga moslab yozib qo'yishi mumkin. **Lekin** uni
> yashirish ham noto'g'ri — kassir nima kutilayotganini bilishi kerak.
> Yechim: kutilgan summa ko'rinadi, lekin sanalgan summa kiritilgunicha
> **farq ko'rsatilmaydi**. Bu FAZA 8 da qayta ko'rib chiqiladi.

| Nima noto'g'ri ketadi | Ilova |
|---|---|
| Farq katta (>5%) | `.warning` + qizil. Izoh majburiy. |
| Farq 0 | `.success` + yashil "To'g'ri chiqdi". |
| Internet yo'q | 🔴 — kutilgan naqd serverdan hisoblanadi (oyna bo'yicha agregat). |

**Offline:** 🔴.

---

## 8. Kunlik yakun (kassir → direktor)

**Ikki qurilma, ikki foydalanuvchi.** Push bo'lmasa oqim uziladi.

```
KASSIR (telefon 1)                    DIREKTOR (telefon 2)
─────────────────────                 ──────────────────────
BAL-059 Kunlik tushum
  [1] "+ Tushum"
  [2] summa · to'lov turi
  [3] "Qo'shish"
  ...kun davomida takrorlanadi...
      │
  [4] "Kunni topshirish"
      │  holat: OPEN → SUBMITTED
      │  (kunlik.ts:265, shartli updateMany)
      │
      └──────── push ────────────────►  🔔 "Chorsu Savdo: 12 400 000
         (MISSING — hozir Telegram)        so'm kun yakunini kutmoqda"
                                              │ [1] bildirishnomaga tegish
                                              ▼
                                          BAL-061 Direktor tasdig'i
                                            naqd / Click / qarz kesimi
                                            [2] "Tasdiqlash"
                                              │ SUBMITTED → CONFIRMED
                                              ▼
  🔔 "Kun tasdiqlandi" ◄──── push ────    .success
```

**Tegish:** kassir **4** · direktor **2**

| Nima noto'g'ri ketadi | Ilova |
|---|---|
| Kassir ikki marta topshirdi | Server shartli `updateMany` (`kunlik.ts:279`) — ikkinchisi "allaqachon topshirilgan" beradi. |
| Direktor tayinlanmagan | "Kun yakunini faqat tayinlangan direktor tasdiqlaydi" (`kunlik.ts:335`). BAL-060 da ogohlantirish + sozlamaga havola. |
| Push yo'q (bugungi holat) | Telegram xabari (`kunlik.ts:319`, best-effort). iOS'da **BAL-240 bildirishnoma ro'yxati** — direktor o'zi kirib ko'radi. Bu yomonroq, lekin ishlaydi. |
| Kelajak kun | Bloklangan (`kunlik.ts:272`). |

**Haptika:** topshirildi → `.success` · tasdiqlandi → `.success` (direktorda).
**Offline:** 🟡 tushum qo'shish · 🔴 topshirish/tasdiqlash (holat mashinasi).

---

## 9. Ombor kirimi (xarid qabul qilish)

```
BAL-130 Xarid buyurtmalari
   │ [1] "Yo'lda" holatidagi buyurtma
   ▼
BAL-131 Buyurtma tafsiloti
   │  satrlar: mahsulot · buyurtma miqdori · narx
   │ [2] "Qabul qilish"
   ▼
BAL-134 Miqdor tasdig'i
   │  har satr: buyurtma 100 → keldi [100]  ← tahrirlanadi
   │ [3] (kerak bo'lsa) miqdorni tuzatish
   │ [4] "Davom"
   ▼
BAL-135 To'lov
   │  Jami: 12 400 000
   │  To'landi: [12 400 000]   ← qisman ham mumkin (xarid.ts:272)
   │ [5] kassa tanlash
   │ [6] "Qabul qilish va to'lash"
   ▼
.success — ombor qoldig'i oshdi, tannarx yangilandi
```

**Tegish: 6**

| Nima noto'g'ri ketadi | Ilova |
|---|---|
| Allaqachon qabul qilingan | Server rad etadi (`xarid.ts:235`). Tugma oldindan o'chiq. |
| To'langan > jami | Server rad etadi (`xarid.ts:276`). Klient maydonni cheklaydi. |
| Ta'minotchi = xaridor | Server rad etadi (`xarid.ts:299`). |

**Offline:** 🔴 (ombor qoldig'i + kassa).

---

## 10. Tasdiqlash (approval)

```
🔔 push "Salima: 4 500 000 chiqimga ruxsat so'ramoqda"   (MISSING)
   │ [1]
   ▼
BAL-243 So'rov tafsiloti
   │  kim · qancha · qaysi kategoriya · izoh · filial
   │ [2] "Tasdiqlash"  yoki  "Rad etish"
   │     rad etilsa → sabab maydoni [+1]
   ▼
.success / .warning — so'rovchiga xabar
```

**Tegish: 2** (tasdiq) · **3** (rad)

> **Dizayn qarori:** tasdiqlash — bir tegishlik ish. Shuning uchun
> bildirishnomadan to'g'ridan-to'g'ri **BAL-243** ochiladi (ro'yxatdan
> o'tmaydi). iOS notification action bilan **ilovani ochmasdan** ham
> tasdiqlash mumkin (push kelganda) — bu MISSING, FAZA 9 da.

**Offline:** 🔴.

---

## 11. AI savol

```
BAL-260 AI (bo'sh holat)
   │  Takliflar chipi: "Bugun qancha foyda?" · "Kim ko'p qarzdor?"
   │                   "O'tgan oyga nisbatan qanday?"
   │ [1] chipga tegish (yoki yozish)
   ▼
BAL-261 Javob
   │  "Avgustda sof foyda 12 480 000 so'm — iyulga nisbatan 18,4% ko'p."
   │  [donut grafik: kategoriya taqsimoti]
   │  Davom chipi: "Nega oshdi?" · "Chiqimlarni ko'rsat"
   │ [2] chipga tegish
   ▼
BAL-262 Chuqurlashtirish — ...
```

**Tegish: 1** (birinchi javobgacha)

AI 6 ta tool ishlatadi (`lib/ai/tools.ts`): `oylik_xulosa`,
`kategoriya_taqsimoti`, `oylik_trend`, `qarzdorlik`, `crm_holati`,
`vazifalar_holati`. **Ekran shu 6 tadan tashqariga chiqmaydigan
takliflar ko'rsatadi** — foydalanuvchi javob bermaydigan savol
bermasin.

| Nima noto'g'ri ketadi | Ilova |
|---|---|
| AI javob bera olmadi | "Bu savolga hozircha javob bera olmayman" + 3 ta ishlaydigan taklif. |
| Sekin (>3s) | Skeleton emas — **oqim (streaming)** matn. Kutish sezilmaydi. |

**Offline:** 🔴.

---

## 12. Offline → sinxronizatsiya

**Bu O'zbekiston uchun eng muhim mobil oqim.** Peshtaxtada internet uziladi.

```
Tarmoq uzildi
   │
   ▼
BAL-302 Offline banner (yuqorida, doimiy, qizil emas — sariq)
   │  "Internet yo'q · 3 ta yozuv navbatda"
   │
   ├─ Ruxsat etilgan amallar (🟡 navbatga):
   │    · kirim / chiqim yozish
   │    · kunlik tushum qo'shish
   │    · qarz to'lovi qabul qilish  (idempotentlik kaliti bor)
   │
   ├─ Ko'rish (🟢 keshdan, "eskirgan" belgisi bilan):
   │    · yozuvlar ro'yxati · mahsulotlar · qarzlar · asosiy ekran
   │
   └─ Bloklangan (🔴, tugma o'chiq + sabab):
        · sotuv          "Ombor qoldig'i uchun internet kerak"
        · smena yopish   "Kutilgan naqd serverdan hisoblanadi"
        · kun tasdiqlash · xarid qabul · AI

Tarmoq qaytdi
   │
   ▼
BAL-303 Sinxronlanmoqda  (banner o'rnida progress)
   │  "3 tadan 2 tasi yuborildi"
   │
   ├─ hammasi o'tdi → banner yo'qoladi, .success haptika
   │
   └─ konflikt / xato → BAL-302 "1 ta yozuv yuborilmadi"
        │ [1] tegish → ro'yxat: nima, nega, "Qayta urinish" / "O'chirish"
```

**Konflikt qoidasi:**

| Holat | Yechim |
|---|---|
| Bir xil yozuv ikki marta yuborildi | Idempotentlik kaliti — server ikkinchisini rad etmaydi, mavjudini qaytaradi. |
| Yozuv yuborilgan, javob kelmagan | Kalit bilan qayta yuboriladi — **dublikat bo'lmaydi**. |
| Obuna tugagan (402) | Navbatdan chiqariladi, foydalanuvchiga aytiladi. Qayta urinilmaydi. |
| Huquq yo'q (403) | Navbatdan chiqariladi + sabab. |
| Server xatosi (500) | 3 marta qayta urinish (eksponensial), keyin qo'lda. |

**Haptika:** sinxronizatsiya tugadi → `.success` · yuborilmadi → `.warning`.

> **Halol ogohlantirish:** offline navbat backend'da **YO'Q** (bitta
> `DebtPayment.idempotencyKey` pretsedentidan tashqari). Har navbatga
> tushadigan endpoint idempotentlik kalitini qabul qilishi kerak —
> FAZA 9 da aniq ro'yxat beriladi.

---

## Tegish soni — yig'ma jadval

| # | Oqim | Maqsad | Erishildi | Holat |
|---|---|---:|---:|---|
| 1 | Birinchi kirish | ≤6 | 3–6 | ✅ |
| 2 | **Tez kirim** | **≤4** | **4** | ✅ |
| 3 | Tez chiqim | ≤4 | 4 | ✅ |
| 4a | POS savat bilan | ≤8 | 7 | ✅ (MISSING) |
| 4b | POS bugungi | ≤6 | 6 | ✅ |
| 5 | Qarzga sotish | ≤8 | 8 | ✅ |
| 6 | Qarz undirish | ≤6 | 5–7 | ✅ |
| 7 | Smena yopish | ≤5 | 5 | ✅ |
| 8 | Kunlik (kassir) | ≤4 | 4 | ✅ |
| 8 | Kunlik (direktor) | ≤2 | 2 | ✅ |
| 9 | Ombor kirimi | ≤6 | 6 | ✅ |
| 10 | Tasdiqlash | ≤2 | 2–3 | ✅ |
| 11 | AI savol | ≤1 | 1 | ✅ |
| 12 | Offline sync | 0 (avtomatik) | 0 | ✅ |

---

## Offline qamrovi — yig'ma

| Amal | Holat | Sabab |
|---|:-:|---|
| Yozuvlarni ko'rish | 🟢 | Kesh |
| Kirim / chiqim yozish | 🟡 | Navbat + idempotentlik |
| Kunlik tushum | 🟡 | Navbat |
| Qarz to'lovi | 🟡 | Idempotentlik kaliti mavjud |
| Mahsulot / qarz ro'yxati | 🟢 | Kesh |
| **Sotuv** | 🔴 | Ombor qoldig'i atomik kamayadi |
| **Smena yopish** | 🔴 | Kutilgan naqd server agregati |
| Kun topshirish/tasdiqlash | 🔴 | Holat mashinasi |
| Xarid qabul | 🔴 | Ombor + kassa |
| AI | 🔴 | Server |
| Login | 🔴 | Sessiya |

**Qoida:** 🔴 amal tugmasi **o'chiq** turadi va yonida **sabab** yoziladi.
Foydalanuvchi bosib, keyin xato ko'rmasin.
