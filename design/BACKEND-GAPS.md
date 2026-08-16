# BACKEND GAPS — Balansa iOS

**Manba:** `FEATURE-INVENTORY.md` (audit) · `BALANSA-IOS-DESIGN.md` (spec)

**Qoida:** bu hujjatda **kod yozilmaydi** — faqat qaysi faylga tegish
kerakligi ko'rsatiladi.

---

## A. BACKEND'DA BOR — O'ZGARISH KERAK EMAS

Bu ekranlar bugun ulansa ishlaydi.

| Ekran | API endpoint | Fayl:satr |
|---|---|---|
| BAL-002/003 Ro'yxatdan o'tish | `POST /api/auth/signup` | `src/lib/services/signup.ts:127` |
| BAL-004/005 Onboarding | ⇡ (`Business.omborli`, `.turi`) | `prisma/schema.prisma:139,142` |
| BAL-020 Asosiy | `GET /api/dashboard/summary`, `/trend`, `/category-breakdown` | `src/lib/queries/dashboard.ts` |
| BAL-025 Biznes tanlash | `POST /api/me/active-business` | `src/lib/business.ts` |
| BAL-040 Yozuvlar | `GET /api/transactions` | `src/lib/queries/transactions.ts` |
| BAL-043 Yangi yozuv | `POST /api/transactions` | `src/lib/services/transactionService.ts` |
| BAL-046–049 Tahrir/o'chirish/tiklash | `PATCH/DELETE /api/transactions/[id]`, `/restore` | ⇡ |
| BAL-050–052 Kassalar | `GET/POST /api/accounts`, `/transfer` | `src/lib/services/accounts.ts` |
| BAL-053 Shaxsiy kassa | — (sahifa) | `src/lib/services/userKassa.ts` |
| BAL-054/055 Kassa topshirish | `GET/POST /api/kassa-topshirish` | `src/lib/services/kassirKassa.ts` |
| BAL-056–058 Smena | `POST /api/kunlik/smena` | `src/lib/services/smena.ts:116` |
| BAL-059–062 Kunlik | `POST /api/kunlik/tushum`, `/topshirish`, `/tasdiqlash` | `src/lib/services/kunlik.ts:119,265,332` |
| BAL-063–066 Budjet/takroriy/kategoriya | `/api/budgets`, `/recurring`, `/categories` | — |
| BAL-070 Sotuv ro'yxati | `GET /api/products` | `src/lib/queries/inventory.ts` |
| BAL-073 Mijoz + limit | `GET /api/debts/mijozlar` · `qarzLimitTekshirTx` | `src/lib/services/inventory.ts:160` |
| BAL-075–077 Sotuvlar / bekor | `GET /api/sales`, `DELETE /api/sales/[id]` | `src/lib/services/inventory.ts:281` |
| BAL-085/086 Xato holatlari | (server tekshiruvi) | `inventory.ts:167,160` |
| BAL-100–108 Ombor | `/api/products`, `/api/stock`, `/stock/adjust` | `src/lib/services/inventory.ts:104`, `stockAdjust.ts` |
| BAL-109–111 Avtopark | `/api/avto`, `/avto/xarajat` | `inventory.ts:431,538` |
| BAL-130–138 Xarid | `/api/xarid/orders`, `/suppliers` | `src/lib/services/xarid.ts:124,216` |
| BAL-150–155 Qarz | `/api/debts`, `/[id]/payment`, `/bekor` | `src/lib/services/qarz.ts:217` |
| BAL-160–162 Mijozlar | `/api/mijozlar` | `src/lib/services/mijoz.ts` |
| BAL-170–173 CRM | `/api/crm/board`, `/deals`, `/contacts` | `src/lib/crm/service.ts` |
| BAL-180–186 HR / vazifalar | `/api/hr/*`, `/api/tasks` | `src/lib/services/hr.ts` |
| BAL-190–191 Hujjatlar | `/api/hujjatlar/shartnomalar` | `src/lib/services/hujjat.ts` |
| BAL-200–203 Hisobot | `GET /api/reports/monthly` | `src/lib/reports/` |
| BAL-240 Bildirishnomalar | `GET /api/me/notif-count` | `src/lib/queries/notifications.ts` |
| BAL-242–244 Tasdiqlash | `/api/tasdiqlash/*` | `src/lib/services/approval.ts` |
| BAL-260–262 AI | `POST /api/ai/chat` (6 tool) | `src/lib/ai/tools.ts` |
| BAL-284–287 Foydalanuvchi/rol/modul | `/api/users`, `/rollar`, `/modules` | `src/lib/services/rollar.ts` |
| BAL-290/291 Hisobni o'chirish | `POST/DELETE /api/me/hisob-ochirish` | `src/lib/db/hisobOchirish.ts` |
| BAL-300 Qidiruv | `GET /api/search` | `src/app/api/search/route.ts` |

**Jami: 78 ekran (75%).**

---

## B. API O'ZGARISHI KERAK — funksiya bor, shakl mos emas

| # | Ekran | Mavjud API | Muammo | Kerakli o'zgarish | Buzuvchimi |
|---|---|---|---|---|---|
| **B-1** | BAL-001 Kirish | `POST /api/auth/login` (`route.ts:39`) | **Cookie sessiya** (`iron-session`, `session.ts:29`). Native ilova cookie'ni ishonchli saqlay olmaydi; muddat 7 kun, yangilanmaydi | **JWT (15 daq) + refresh token (30 kun, rotatsiya bilan)**. Yangi: `POST /api/mobile/auth/login`, `/refresh`, `/logout`. Mavjud cookie yo'li **o'zgarmaydi** (web ishlashda davom etadi) | ❌ yo'q (yangi endpoint) |
| **B-2** | Barcha yozish amallari | `POST /api/transactions` va h.k. | Offline navbat uchun **idempotentlik kaliti yo'q**. Tarmoq uzilib qayta yuborilsa **dublikat** yoziladi | Har yozish endpointi ixtiyoriy `Idempotency-Key` header qabul qilsin. Naqsh **allaqachon bor**: `DebtPayment.idempotencyKey` (`schema.prisma:933,936`) | ❌ yo'q (ixtiyoriy header) |
| **B-3** | BAL-150, 156 Aging | `GET /api/debts` (`queries/qarz.ts`) | Aging **klientda** hisoblanishi kerak. Sahifalashda (`take`/`skip`) jamlar noto'g'ri chiqadi | `GET /api/debts/aging` — server agregati: `{ "1-7": n, "7-30": n, "30-60": n, "60+": n }` + summalar. `Debt.sana` va `muddat` bor (`schema.prisma:689`) | ❌ yo'q (yangi endpoint) |
| **B-4** | BAL-020 Asosiy | 3 ta alohida so'rov | Mobil radioni 3 marta uyg'otadi — batareya va kechikish | `GET /api/mobile/dashboard` — bitta javobda summary + trend + breakdown + notif count | ❌ yo'q |
| **B-5** | BAL-074, 078 Chek | `GET /api/sales/[id]/receipt` | HTML/PDF qaytaradi; native ulashish uchun **base64 + MIME** kerak | `?format=base64` parametri yoki `/receipt.pdf` → `{ nom, mime, data }` | ❌ yo'q |
| **B-6** | BAL-204 Eksport | `/api/reports/monthly/excel`, `/pdf` | ⇡ bir xil muammo | ⇡ bir xil yechim | ❌ yo'q |
| **B-7** | BAL-192 Fayl ilova | `POST /api/hujjatlar/ilova` | Mobil kameradan rasm yuklash oqimi yo'q (hajm, siqish, format) | Multipart yoki base64 qabul qilish + server tomonda siqish. Maks 5 MB, JPEG/PNG/PDF | ❌ yo'q |
| **B-8** | BAL-072 To'lov turi | `Sale.tolovTuri` = `"naqd" \| "qarz"` (`schema.prisma:618`) | Karta/Click alohida tur emas — faqat `accountId` orqali bilvosita | `tolovTuri` ga `"karta"` qo'shish **yoki** UI'da kassa turidan chiqarish (afzal — sxema o'zgarmaydi) | ⚠️ sxema tegilsa ha |
| **B-9** | BAL-040 Yozuvlar | `GET /api/transactions` | Kursorli sahifalash yo'q (offset bilan mobil ro'yxat sakraydi) | `?cursor=` qo'shish | ❌ yo'q |

---

## C. BACKEND'DA YO'Q — YANGI ISH KERAK

| # | Ekran | Kerak narsa | Prisma o'zgarishi | Yangi endpoint | Hajm | Bloklovchimi |
|---|---|---|---|---|---|---|
| **C-1** | BAL-080–082 **Savat** | Bitta sotuvda bir necha mahsulot | **`SaleItem`** modeli: `saleId`, `productId`, `miqdor`, `birlikNarx`, `tannarx`, `chegirma`. `Sale` dagi `productId/miqdor/birlikNarx` **eskiradi** (migratsiya kerak: mavjud har `Sale` uchun 1 ta `SaleItem`) | `POST /api/sales` qayta yoziladi | **L** (2–3 kun) | ⚠️ Ekran cheklangan holda ishlaydi (bitta mahsulot, BAL-071) |
| **C-2** | BAL-081 **Kasr miqdor** | 1.5 kg sotish | `Product.miqdor`, `Sale.miqdor`, `StockEntry.miqdor`, `PurchaseOrderItem.miqdor`: `Int` → **`Decimal`** yoki **gramm bilan `Int`** (afzal — pul kabi butun son invarianti saqlanadi) | Barcha ombor yozuvlari | **L** (2–3 kun + migratsiya) | ⚠️ Butun miqdor bilan ishlaydi |
| **C-3** | BAL-084 **Shtrix-kod** | Kamera bilan skanerlash | `Product.barcode String?` + `@@unique([businessId, barcode])` | `GET /api/products?barcode=` | **S** (2–4 soat) | ❌ yo'q — qidiruv qoladi |
| **C-4** | BAL-115/116 **Omborlar** | Bir necha ombor, ular aro ko'chirish | **`Warehouse`** modeli + `StockEntry.warehouseId` + qoldiq `Product.miqdor` dan **`Stock(productId, warehouseId, miqdor)`** ga ko'chadi. **Eng katta o'zgarish** — sotuv, xarid, inventarizatsiya hammasi tegiladi | Ko'p | **XL** (1–2 hafta) | ❌ yo'q — bitta ombor bilan ishlaydi |
| **C-5** | BAL-225/226 **Filiallar** | Filial entity + filial kesimidagi hisobot | **`Filial`** modeli; `Transaction.filial String?` (`schema.prisma:400`) → `filialId`. Mavjud matn qiymatlarini ko'chirish kerak | `/api/filiallar`, hisobotga `?filialId=` | **M** (3–5 kun) | ❌ yo'q |
| **C-6** | BAL-083 **Aralash to'lov** | Naqd + karta + qarz bitta sotuvda | **`SalePayment`** modeli (`saleId`, `tur`, `summa`, `accountId`) | `POST /api/sales` | **M** | ❌ yo'q |
| **C-7** | BAL-082 **Chegirma** | Qator va sotuv darajasida | `SaleItem.chegirma`, `Sale.chegirma` (C-1 bilan birga) | ⇡ | **S** (C-1 ichida) | ❌ yo'q |
| **C-8** | — **Qisman qaytarish** | 3 donadan 1 tasini qaytarish | `SaleReturn` modeli yoki `SaleItem.qaytarilgan` | `POST /api/sales/[id]/return` | **M** | ❌ yo'q — to'liq bekor bor |
| **C-9** | — **Narx darajalari** | Ulgurji / VIP narx | `ProductPrice(productId, daraja, narx)` + `Contact.narxDarajasi` | — | **M** | ❌ yo'q |
| **C-10** | BAL-245 **Push** | APNs bildirishnoma | **`DeviceToken`** modeli (`userId`, `token`, `platform`, `createdAt`, `lastSeenAt`) | `POST /api/mobile/device-token` + APNs yuboruvchi | **M** (3–5 kun) | ⚠️ **Kunlik yakun oqimini buzadi** — direktor xabarsiz qoladi (hozir Telegram) |
| **C-11** | BAL-302/303 **Offline navbat** | Klient navbati + server idempotentligi | (B-2 bilan bir xil) | — | **M** | ⚠️ Offline'siz ilova peshtaxtada ishonchsiz |

---

## D. MOBIL UCHUN MAXSUS KERAK

### D-1 · Autentifikatsiya (JWT + refresh rotatsiyasi)

**Bugungi holat:** `iron-session` cookie, 7 kun, yangilanmaydi
(`src/lib/auth/session.ts:29-38`).

**Kerak:**

| Element | Tavsif |
|---|---|
| Access token | JWT, **15 daqiqa**, `userId` + `tenantId` + `rol` |
| Refresh token | Opaque, **30 kun**, bazada saqlanadi (`RefreshToken` modeli: `tokenHash`, `userId`, `deviceId`, `expiresAt`, `revokedAt`) |
| Rotatsiya | Har `/refresh` da yangi refresh beriladi, eskisi bekor qilinadi. **Qayta ishlatilsa — o'sha qurilmaning barcha tokenlari bekor** (o'g'irlik belgisi) |
| Chiqish | `POST /api/mobile/auth/logout` → refresh bekor qilinadi |

**Qaysi faylga tegiladi:** `src/lib/auth/session.ts` (yangi yo'l qo'shiladi,
mavjudi **o'zgarmaydi**), `src/lib/auth/tenant.ts` (guard ikkala usulni
qabul qilsin), yangi `src/app/api/mobile/auth/`.

### D-2 · Face ID va Keychain

| Nima saqlanadi | Qayerda | Nega |
|---|---|---|
| **Refresh token** | iOS **Keychain**, `.whenUnlockedThisDeviceOnly` + `biometryCurrentSet` | Face ID o'zgarsa (yangi yuz qo'shilsa) token **avtomatik bekor** bo'ladi |
| Access token | Faqat xotirada | Diskda saqlanmaydi |
| **Parol** | ❌ **HECH QACHON** | Parol saqlansa — o'g'irlansa hisob butunlay yo'qoladi |

**Oqim:** Face ID muvaffaqiyatli → Keychain'dan refresh token olinadi →
`/refresh` → yangi access token. Face ID rad etilsa → parol bilan kirish.

**Klient tomoni allaqachon yozilgan** (Capacitor o'rami uchun):
`src/lib/native/qulf.ts`, `src/components/native/IlovaQulfi.tsx` —
native ilovada shu mantiq Swift'ga ko'chadi.

### D-3 · Push (APNs)

| Element | Tafsilot |
|---|---|
| Ro'yxatga olish | `POST /api/mobile/device-token` — `{ token, platform: "ios", deviceId }` |
| Model | `DeviceToken` (C-10) |
| Yuboruvchi | APNs HTTP/2, `.p8` kalit (App Store Connect API kalitidan **alohida**) |

**Qaysi hodisalarga push:**

| Hodisa | Kimga | Manba fayl |
|---|---|---|
| Kun yakuni topshirildi | Tayinlangan direktor | `services/kunlik.ts:319` (hozir Telegram) |
| Kun tasdiqlandi | Topshirgan kassir | `services/kunlik.ts` |
| Tasdiq so'rovi keldi | Manager | `services/approval.ts` |
| Qarz muddati bugun tugaydi | Mas'ul | `queries/notifications.ts` |
| Kassa topshirig'i keldi | Direktor | `services/kassirKassa.ts` |
| Ombor kam qoldi | Manager | `queries/notifications.ts` |
| Obuna 3 kunda tugaydi | OWNER | `lib/cron/ishlar.ts` |

**Muhim:** Telegram xabarlari **o'chirilmaydi** — push qo'shimcha bo'ladi.
Telegram ishlatadigan mijozlar bor.

### D-4 · Offline

| Ma'lumot | Keshlanadimi | Muddat |
|---|---|---|
| Yozuvlar (oxirgi 30 kun) | ✅ | 24 soat |
| Mahsulotlar | ✅ | 6 soat (qoldiq eskiradi — "taxminiy" belgisi bilan) |
| Qarzlar | ✅ | 6 soat |
| Kassalar | ✅ | 1 soat |
| Dashboard | ✅ | 1 soat |
| Mijozlar | ✅ | 24 soat |

| Amal | Navbatga tushadimi | Sabab |
|---|:-:|---|
| Kirim / chiqim | ✅ | Serverda konflikt yo'q |
| Kunlik tushum | ✅ | ⇡ |
| Qarz to'lovi | ✅ | Idempotentlik kaliti **allaqachon bor** |
| **Sotuv** | ❌ | `Product.miqdor` atomik kamayadi (`inventory.ts:167`). Ikki qurilma offline sotsa qoldiq manfiy bo'ladi |
| **Smena yopish** | ❌ | Kutilgan naqd server agregati (`smena.ts:146`) |
| Kun topshirish/tasdiqlash | ❌ | Holat mashinasi |

**Konflikt hal qilish:**

| Holat | Yechim |
|---|---|
| Dublikat yuborish | `Idempotency-Key` — server mavjudini qaytaradi |
| 402 (obuna tugagan) | Navbatdan chiqariladi, foydalanuvchiga aytiladi |
| 403 (huquq yo'q) | ⇡ |
| 409 (konflikt) | Foydalanuvchiga ko'rsatiladi, qo'lda hal qilinadi |
| 500 | 3 marta eksponensial qayta urinish, keyin qo'lda |

**Idempotency-Key formati:** `{deviceId}:{uuid}` — klient yaratadi,
navbatda saqlanadi, qayta yuborishda **o'zgarmaydi**.

### D-5 · `/bootstrap` — bitta so'rov

Ilova ochilganda hozir kerak bo'ladigan so'rovlar: sessiya, tenant,
access mode, modullar, nav, huquqlar, bizneslar, aktiv biznes,
bildirishnoma soni — **9 ta**.

**Taklif:** `GET /api/mobile/bootstrap` → bitta javob:

```
{ user, tenant, access, modullar[], huquqlar[], bizneslar[],
  aktivBiznes, notifCount, serverVaqti, minIlovaVersiyasi }
```

`minIlovaVersiyasi` — BAL-308 ("Ilovani yangilash kerak") uchun.

**Qaysi fayllardan yig'iladi:** `lib/auth/tenant.ts` (tenant + access),
`lib/modules/guard.ts` (modullar), `lib/permissions/tekshir.ts` (huquqlar),
`lib/business.ts` (bizneslar), `queries/notifications.ts`.

### D-6 · Rasm yuklash

| Parametr | Qiymat |
|---|---|
| Format | JPEG (foto), PNG, PDF |
| Maks hajm | 5 MB (klient siqadi: uzun tomoni 2048px, sifat 0.7) |
| Yuklash | Multipart yoki base64 |
| Qayerda | BAL-192 (hujjat ilovasi), kelajakda chek fotosi |

---

## E. VEB ILOVAGA TAVSIYA (brief bo'yicha tegilmadi)

| Topilma | Fayl | Tavsiya |
|---|---|---|
| `--income` `#16a34a` oq fonda **3.30:1** — WCAG AA dan o'tmaydi | `src/app/globals.css:44` | `#15803d` (5.02:1) |
| `--debt` `#d97706` — **3.19:1** | `src/app/globals.css:49` | `#b45309` (5.02:1) |
| `--fg-faint` `#94a3b8` — **2.56:1** | `src/app/globals.css:21` | `#78899e` (3.58:1) |
| dark `--fg-faint`, `--fg-muted` | `globals.css:66-68` | Yorqinlashtirish |

Bu **kirim summasining rangi** — ilovaning eng muhim raqami. Yorqin
quyoshda telefon ekranida o'qish qiyin bo'ladi.

---

## F. HAJM YIG'INDISI

| Bo'lim | Ish hajmi |
|---|---|
| B (API moslash) | ~5–7 kun |
| C-1 Savat + C-7 chegirma | 2–3 kun |
| C-2 Kasr miqdor | 2–3 kun |
| C-3 Shtrix-kod | 2–4 soat |
| C-10 Push | 3–5 kun |
| C-11 Offline (server tomoni) | B-2 ichida |
| D-1 JWT + refresh | 2–3 kun |
| D-5 Bootstrap | 1 kun |
| **MVP uchun jami** | **~3 hafta** |
| C-4 Omborlar | +1–2 hafta |
| C-5 Filiallar | +3–5 kun |
| C-6 Aralash to'lov | +3 kun |
| C-9 Narx darajalari | +3 kun |
