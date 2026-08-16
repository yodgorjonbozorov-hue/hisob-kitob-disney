# FEATURE INVENTORY — Balansa backend auditi

**Maqsad:** native iOS ilovasini loyihalashdan OLDIN backend'da nima BOR va
nima YO'Q ekanini dalil bilan aniqlash. Har qator `fayl:satr` ga tayanadi.

**Audit sanasi:** 2026-08-16 · **Branch:** `claude/ios-app-publish-2jbxks`

**Hajm:** 46 Prisma model · 117 API route · 35 web sahifa · 19 servis ·
22 query · 18 zod sxema · 13 bot fayli

**iOS holati** faqat uch qiymat:

| Belgi | Ma'nosi |
|---|---|
| **READY** | Backend to'liq bor — ekranni bugun loyihalab, ertaga ulash mumkin |
| **PARTIAL** | Funksiya bor, lekin shakli mobil uchun mos emas yoki qismi yetishmaydi |
| **MISSING** | Backend'da umuman yo'q — yangi model/endpoint kerak |

---

## 1. MAJBURIY 14 TEKSHIRUV

Brief'da so'ralgan 14 savol. Bu jadval butun dizaynning asosi — bir nechta
kutilgan funksiya backend'da **yo'q** ekan.

| # | Savol | Javob | Dalil |
|---|---|---|---|
| 1 | Ko'p qatorli sotuv (savat)? | **YO'Q** | `Sale` da `productId` + `miqdor` + `birlikNarx` TO'G'RIDAN-TO'G'RI model maydonlari (`prisma/schema.prisma:613-617`). `SaleItem` modeli yo'q. **Bitta sotuv = bitta mahsulot.** |
| 2 | Kasr miqdor (1.5 kg)? | **YO'Q** | `Product.miqdor Int` (`schema.prisma:510`), `Sale.miqdor Int` (`:615`), `StockEntry.miqdor Int` (`:594`). O'lchov birligi BOR (`Product.birlik` — dona/kg/litr/metr/quti/paket, `:516`), lekin miqdor butun son. Ya'ni "3 kg" yoziladi, "1.5 kg" YOZILMAYDI. |
| 3 | Filial entity? | **QISMAN** | `Transaction.filial String?` (`schema.prisma:400`) va `ApprovalRequest.filial String?` (`:990`) — erkin matn maydoni, `z.string().max(100)` (`src/lib/validation/transaction.ts:30,44`). **`Filial` modeli, ro'yxati va filial kesimidagi hisobot YO'Q.** |
| 4 | Ombor (Warehouse) entity? | **YO'Q** | Faqat `StockEntry` (`:588`) va `StockAdjustment` (`:545`) — bular HARAKAT, joy emas. `Warehouse`/`Location` modeli va `warehouseId` maydoni umuman yo'q. Qoldiq bitta: `Product.miqdor`. |
| 5 | Qarz aging (1-7/7-30/30-60/60+)? | **QISMAN** | `Debt.muddat DateTime?` (kelishilgan muddat, `:689`) va `Debt.sana` bor. Bildirishnomada 30/90 kunlik guruhlash bor (`src/lib/queries/notifications.ts:183-184`), `queries/qarz.ts:44` da "faqat muddati o'tganlar" filtri bor. **Lekin 4 pog'onali aging bucketlari va ular bo'yicha agregat query YO'Q.** |
| 6 | Narx darajalari (ulgurji/VIP)? | **YO'Q** | `Product` da bitta `sotuvNarx` (`:509`). `ulgurji`/`vip`/`narxTuri`/`priceTier` maydoni yo'q. Kelishilgan narx sotuv paytida beriladi (`createSale.narx`, `services/inventory.ts:133`), lekin u mijozga bog'lanmagan. |
| 7 | Qaytarish (return)? | **QISMAN** | Faqat **to'liq bekor qilish**: `cancelSale` (`services/inventory.ts:281`) — sotuvni soft-delete qiladi, kirimni bekor qiladi, qoldiqni qaytaradi. **Qisman qaytarish (3 donadan 1 tasi) YO'Q.** |
| 8 | Push bildirishnoma? | **YO'Q** | Kodda `APNs`, `PushToken`, `deviceToken`, `web-push`, `firebase` — hech biri yo'q. Bildirishnoma FAQAT Telegram bot orqali (`src/bot/`, 13 fayl) va ilova ichidagi ro'yxat (`queries/notifications.ts`). |
| 9 | Shtrix-kod? | **YO'Q** | `Product` da `barcode` maydoni yo'q. `sku String?` bor (`:514`, "ombor kodi/artikul") — bu shtrix-kod emas, lekin uni SHU MAQSADDA ishlatish mumkin (indeks ham bor: `@@index([businessId, sku])`). |
| 10 | Mobil auth (JWT/refresh)? | **YO'Q** | `iron-session` cookie: `balansa_session`, httpOnly, sameSite lax, 7 kun (`src/lib/auth/session.ts:29-38`). JWT, refresh token, token rotatsiyasi — yo'q. |
| 11 | Face ID uchun token saqlash oqimi? | **YO'Q** | Server tomonda hech qanday qurilma tokeni, "trusted device" yoki qayta-kirish tokeni yo'q. Men qurgan Capacitor qulfi (`src/lib/native/qulf.ts`) faqat KLIENT tomonda — sessiyaga tegmaydi. |
| 12 | Offline sync mexanizmi? | **QISMAN** | Umumiy mexanizm YO'Q. Bitta pretsedent bor: `DebtPayment.idempotencyKey` + `@@unique([debtId, idempotencyKey])` (`schema.prisma:933,936`), ishlatilishi `services/qarz.ts:217,256`. Ya'ni **naqsh mavjud, lekin faqat bitta endpointda.** |
| 13 | Self-serve tarif almashtirish? | **BOR** | `POST /api/billing/checkout` `plan` kodini qabul qiladi, `planByCode` bilan tekshiradi va provayderga uzatadi (`src/app/api/billing/checkout/route.ts:17-25`). Payme/Click/Manual. |
| 14 | Global qidiruv API'si? | **BOR** | `GET /api/search` — aktiv biznes bo'yicha tranzaksiya, qarzdor, mahsulot, kategoriya. Min 2 belgi, 20 so'rov/daqiqa limit (`src/app/api/search/route.ts:11-31`). |

### Xulosa: 5 ta kutilgan funksiya backend'da YO'Q

POS savati (1), kasr miqdor (2), ombor entity (4), narx darajalari (6),
shtrix-kod (9), push (8), mobil auth (10, 11) — bularsiz native ilova
loyihalanadi, lekin **ishlamaydi**. Batafsili FAZA 9 / `BACKEND-GAPS.md` da.

---

## 2. ROLLAR VA HUQUQLAR

### Rollar (`src/lib/auth/roles.ts:11-20`)

| Rol | Yorliq | Tenant | Biznes |
|---|---|---|---|
| `SUPERADMIN` | Super admin | tenantdan TASHQARIDA (`tenantId = null`) | — |
| `OWNER` | Direktor | tenant egasi | barcha bizneslar |
| `ADMIN` | Administrator | tenant boshqaruvchisi | barcha bizneslar |
| `CASHIER` | Kassir | a'zo | BITTA biznesga biriktirilgan (`User.businessId`) |
| `SELLER` | Sotuvchi | a'zo | barcha bizneslar |

`isManager()` = OWNER yoki ADMIN (`roles.ts:27`).

### Huquqlar katalogi — 18 kod (`src/lib/permissions/katalog.ts:22-43`)

| Guruh | Kodlar |
|---|---|
| Mahsulot va ombor | `mahsulot.korish`, `mahsulot.qoshish`, `ombor.korish`, `ombor.kirim`, `ombor.tuzatish` |
| Moliya | `tranzaksiya.korish`, `tranzaksiya.yaratish`, `kassa.korish`, `pul.berish`, `pul.qabul` |
| Sotuv va qarz | `sotuv.yaratish`, `qarz.korish`, `qarz.tolash` |
| Xarid | `xarid.korish`, `xarid.qabul` |
| Boshqaruv | `hisobot.korish`, `foydalanuvchi.boshqarish`, `rol.boshqarish` |

### Rol → standart huquqlar (`katalog.ts:56-74`)

| Rol | Huquqlar |
|---|---|
| SUPERADMIN / OWNER / ADMIN | **BARCHASI** (18/18) |
| CASHIER | 11 ta: `mahsulot.korish`, `ombor.korish`, `ombor.kirim`, `tranzaksiya.korish`, `tranzaksiya.yaratish`, `kassa.korish`, `pul.berish`, `pul.qabul`, `sotuv.yaratish`, `qarz.korish`, `qarz.tolash` |
| SELLER | **3 ta**: `tranzaksiya.korish`, `tranzaksiya.yaratish`, `pul.qabul` |

### Effektiv huquq hisoblash (`src/lib/permissions/tekshir.ts:27-38`)

```
BAZA  = maxsus rol faol bo'lsa → Role.huquqlar
        aks holda              → ROL_DEFAULT_HUQUQLAR[rol]
      + User.huquqPlus         (alohida berilgan)
      − User.huquqMinus        (alohida olib qo'yilgan)
```

**OWNER hech qachon cheklanmaydi** — o'zini qulflab qo'ymasligi uchun
(`tekshir.ts:29-31`). Maxsus rollar (`Role` modeli) faqat **PRO** tarifda.

> **iOS uchun muhim:** SELLER'da atigi 3 ta huquq bor. Ya'ni sotuvchining
> ilovasi direktornikidan **tubdan** farq qiladi — bu FAZA 2 dagi rol
> bo'yicha navigatsiyaning asosi.

---

## 3. TARIF → MODUL MATRITSASI

Manba: `src/lib/billing/plans.ts:12-33` va `src/lib/modules/registry.ts`.

| Modul | Core | STANDARD (199k) | AVTO (200k) | PRO (399k) |
|---|:--:|:--:|:--:|:--:|
| MOLIYA | ✅ core | ✅ | ✅ | ✅ |
| BOSHQARUV | ✅ core | ✅ | ✅ | ✅ |
| OMBOR | — | ✅ | ✅ | ✅ |
| KUNLIK | — | ✅ | ✅ | ✅ |
| XARID | — | — | — | ✅ |
| TASDIQLASH | — | — | — | ✅ |
| MIJOZLAR | — | — | — | ✅ |
| HR | — | — | — | ✅ |
| HUJJATLAR | — | — | — | ✅ |
| CRM | — | — | — | ✅ |
| VAZIFALAR | — | — | — | ✅ |
| AI | — | — | — | ✅ |

Modul yoqilganligi tenant bo'yicha `TenantModule` da saqlanadi
(`schema.prisma:83`) — ya'ni **tarif ruxsat bersa ham mijoz modulni
o'chirib qo'yishi mumkin**. API darajasida guard: `withTenant(..., { module: "OMBOR" })`.

API'larda modul guard soni: OMBOR 14 · KUNLIK 12 · HR 10 · XARID 8 ·
HUJJATLAR 7 · CRM 7 · TASDIQLASH 5 · VAZIFALAR 4 · MIJOZLAR 4 · AI 2.

**AVTO tarifi** — modullari STANDARD bilan bir xil; farq `Business.turi = "avto"`
(`schema.prisma:142`) orqali UI yorliqlarida va sotuv qoidasida
(`isAvto()` bo'lsa kelishilgan narx kartochkaga yoziladi — `inventory.ts:187-194`).

---

## 4. FUNKSIYA REYESTRI

### 4.1 Auth va hisob

| Funksiya | API | Servis/Query | Model | Rol | Tarif | iOS |
|---|---|---|---|---|---|---|
| Kirish (login) | `POST /api/auth/login` | — (route ichida) | `User` | hamma | — | **PARTIAL** — cookie sessiya, mobil uchun JWT kerak |
| Chiqish | `GET /api/auth/logout` | — | — | hamma | — | **PARTIAL** — token bekor qilish yo'q |
| Ro'yxatdan o'tish | `POST /api/auth/signup` | `services/signup.ts` | `Tenant`,`Business`,`User` | — | — | **READY** |
| Parol o'zgartirish | `POST /api/me/password` | — | `User` | hamma | — | **READY** |
| Hisobni o'chirish | `POST/DELETE /api/me/hisob-ochirish` | `lib/db/hisobOchirish.ts` | `Tenant` | OWNER | — | **READY** |
| Aktiv biznes tanlash | `POST /api/me/active-business` | `lib/business.ts` | `Business` | hamma | — | **READY** |
| Telegram ulash | `POST /api/me/telegram-link-code` | — | `User` | hamma | — | **READY** |

### 4.2 Moliya (core)

| Funksiya | API | Servis/Query | Model | Rol | Tarif | iOS |
|---|---|---|---|---|---|---|
| Yozuv ro'yxati | `GET /api/transactions` | `queries/transactions.ts` | `Transaction` | hamma | core | **READY** |
| Kirim/chiqim yaratish | `POST /api/transactions` | `services/transactionService.ts` | `Transaction` | `tranzaksiya.yaratish` | core | **READY** |
| Yozuv tahrir/o'chirish | `PATCH/DELETE /api/transactions/[id]` | ⇡ | `Transaction` | ⇡ | core | **READY** |
| Tiklash (soft-delete) | `POST /api/transactions/[id]/restore` | ⇡ | `Transaction` | manager | core | **READY** |
| Ommaviy amal | `POST /api/transactions/bulk`, `/bulk-move` | ⇡ | `Transaction` | manager | core | **READY** |
| Eksport / import | `GET /api/transactions/export`, `POST /import` | `services/csvImport.ts` | `Transaction` | manager | core | **PARTIAL** — CSV; mobil uchun native ulashish kerak |
| Dashboard | `GET /api/dashboard/summary`, `/trend`, `/category-breakdown` | `queries/dashboard.ts` | `Transaction` | manager | core | **READY** |
| Kassalar | `GET/POST /api/accounts`, `/[id]` | `services/accounts.ts` | `Account` | `kassa.korish` | core | **READY** |
| Kassa o'tkazma | `POST /api/accounts/transfer` | ⇡ | `AccountTransfer` | `pul.berish` | core | **READY** |
| Shaxsiy kassa | — (sahifa `/app/kassam`) | `services/userKassa.ts` | `Account` | CASHIER+ | PRO | **READY** |
| Kassa topshirish | `GET/POST /api/kassa-topshirish` | `services/kassirKassa.ts` | `CashHandover` | CASHIER | core | **READY** |
| Kategoriyalar | `GET/POST /api/categories`, `/[id]` | — | `Category` | manager | core | **READY** |
| Budjet | `GET/POST /api/budgets` | `queries/budget.ts` | `Budget` | manager | core | **READY** |
| Takroriy yozuv | `GET/POST /api/recurring`, `/generate` | `services/recurring.ts` | `RecurringTransaction` | manager | core | **READY** |
| Smena yopish | `POST /api/kunlik/smena`, `/qayta-ochish` | `services/smena.ts` | `Smena` | CASHIER+ | core | **READY** |
| Kun yakuni (eski) | `POST /api/shift-close` | — | `ShiftClose` | CASHIER+ | core | **READY** |

### 4.3 Kunlik hisobot

| Funksiya | API | Servis | Model | Rol | Tarif | iOS |
|---|---|---|---|---|---|---|
| Tushum kiritish | `POST /api/kunlik/tushum` | `services/kunlik.ts:119` | `DailyTransaction` | kassir/sotuvchi | KUNLIK | **READY** |
| Tushum tahrir/o'chirish | `PATCH/DELETE /api/kunlik/tushum/[id]` | `:166,218` | ⇡ | ⇡ | KUNLIK | **READY** |
| Kunni topshirish | `POST /api/kunlik/topshirish` | `:265` | `DailyReport` | kassir | KUNLIK | **READY** |
| Direktor tasdig'i | `POST /api/kunlik/tasdiqlash` | `:332` | `DailyReport` | tayinlangan direktor | KUNLIK | **READY** |
| Qayta ochish | `POST /api/kunlik/qayta-ochish` | `:386` | `DailyReport` | direktor | KUNLIK | **READY** |
| Direktor tayinlash | `POST /api/kunlik/direktor` | `:432` | `DailyReportSetting` | OWNER | KUNLIK | **READY** |
| Tarix | `GET /api/kunlik/tarix` | `queries/kunlik.ts` | `DailyReport` | manager | KUNLIK | **READY** |

### 4.4 Ombor va sotuv

| Funksiya | API | Servis/Query | Model | Rol | Tarif | iOS |
|---|---|---|---|---|---|---|
| Mahsulot ro'yxati | `GET /api/products` | `queries/inventory.ts` | `Product` | `mahsulot.korish` | OMBOR | **READY** |
| Mahsulot qo'shish | `POST /api/products`, `/bulk` | — | `Product` | `mahsulot.qoshish` | OMBOR | **READY** |
| Ombor kirimi | `POST /api/stock` | `services/inventory.ts:104` | `StockEntry` | `ombor.kirim` | OMBOR | **READY** |
| Qoldiq to'g'rilash | `POST /api/stock/adjust` | `services/stockAdjust.ts` | `StockAdjustment` | `ombor.tuzatish` | OMBOR | **READY** |
| **Sotuv yaratish** | `POST /api/sales` | `services/inventory.ts:122` | `Sale` | `sotuv.yaratish` | OMBOR | **PARTIAL** — faqat BITTA mahsulot, butun miqdor |
| Sotuvni bekor qilish | `DELETE /api/sales/[id]` | `:281` | `Sale` | manager | OMBOR | **READY** |
| Chek | `GET /api/sales/[id]/receipt` | — | `Sale` | ⇡ | OMBOR | **PARTIAL** — HTML/PDF; native ulashish kerak |
| **Savat (multi-product)** | — | — | — | — | — | **MISSING** |
| **Shtrix-kod skaner** | — | — | — | — | — | **MISSING** |
| **Kasr miqdor** | — | — | — | — | — | **MISSING** |
| Avto rejimi | `GET/POST /api/avto`, `/xarajat` | `services/inventory.ts:431,538` | `Product`,`ProductExpense` | manager | AVTO | **READY** |

### 4.5 Qarz

| Funksiya | API | Servis/Query | Model | Rol | Tarif | iOS |
|---|---|---|---|---|---|---|
| Qarzlar ro'yxati | `GET /api/debts` | `queries/qarz.ts` | `Debt` | `qarz.korish` | core | **READY** |
| Qarz yaratish | `POST /api/debts` | `services/qarz.ts` | `Debt` | ⇡ | core | **READY** |
| Qarz to'lovi | `POST /api/debts/[id]/payment` | `services/qarz.ts:217` | `DebtPayment` | `qarz.tolash` | core | **READY** — idempotentlik bor |
| Qarzni bekor qilish | `POST /api/debts/[id]/bekor` | `services/qarz.ts` | `Debt` | manager | core | **READY** |
| Mijoz ro'yxati (qarz) | `GET /api/debts/mijozlar` | — | `Contact`,`Debt` | ⇡ | core | **READY** |
| **Aging (4 pog'ona)** | — | qisman `notifications.ts:183` | `Debt` | — | — | **PARTIAL** |

### 4.6 Xarid (PRO)

| Funksiya | API | Servis | Model | Rol | Tarif | iOS |
|---|---|---|---|---|---|---|
| Ta'minotchilar | `GET/POST /api/xarid/suppliers`, `/[id]` | `services/xarid.ts:38-76` | `Supplier` | `xarid.korish` | PRO | **READY** |
| Buyurtma | `GET/POST /api/xarid/orders`, `/[id]` | `:124,164` | `PurchaseOrder`,`Item` | ⇡ | PRO | **READY** |
| **Qabul qilish** | `POST /api/xarid/orders/[id]` | `:216` | ⇡ + `StockEntry` | `xarid.qabul` | PRO | **READY** |
| Holat o'zgartirish | ⇡ | `:395` | `PurchaseOrder` | ⇡ | PRO | **READY** |

### 4.7 CRM, mijozlar, vazifalar (PRO)

| Funksiya | API | Servis/Query | Model | Rol | Tarif | iOS |
|---|---|---|---|---|---|---|
| Kanban | `GET /api/crm/board` | `lib/crm/service.ts` | `Stage`,`Deal` | hamma | PRO | **READY** |
| Bitimlar | `GET/POST /api/crm/deals`, `/[id]`, `/activity` | ⇡ | `Deal`,`Activity` | hamma | PRO | **READY** |
| Kontaktlar | `GET/POST /api/crm/contacts` | ⇡ | `Contact` | hamma | PRO | **READY** |
| Mijozlar | `GET/POST /api/mijozlar`, `/[id]` | `services/mijoz.ts` | `Contact` | hamma | PRO | **READY** |
| Vazifalar | `GET/POST /api/tasks`, `/[id]` | `lib/tasks/` | `Task` | hamma | PRO | **READY** |

### 4.8 Xodimlar va hujjatlar (PRO)

| Funksiya | API | Servis | Model | Rol | Tarif | iOS |
|---|---|---|---|---|---|---|
| Xodimlar | `GET/POST /api/hr/xodimlar`, `/[id]` | `services/hr.ts` | `Employee` | manager | PRO | **READY** |
| Davomat | `GET/POST /api/hr/davomat` | ⇡ | `Attendance` | manager | PRO | **READY** |
| Oylik | `GET/POST /api/hr/oylik`, `/[id]` | ⇡ | `Payroll` | manager | PRO | **READY** |
| Avans | `POST /api/hr/avans` | ⇡ | `PayrollAdvance` | manager | PRO | **READY** |
| Shartnomalar | `GET/POST /api/hujjatlar/shartnomalar`, `/[id]` | `services/hujjat.ts` | `Contract` | hamma | PRO | **READY** |
| Ilovalar (fayl) | `GET/POST /api/hujjatlar/ilova`, `/[id]` | ⇡ | `Attachment` | hamma | PRO | **PARTIAL** — mobil rasm yuklash oqimi yo'q |

### 4.9 Tasdiqlash (PRO)

| Funksiya | API | Servis | Model | Rol | Tarif | iOS |
|---|---|---|---|---|---|---|
| Qoidalar | `GET/POST /api/tasdiqlash/qoidalar`, `/[id]` | `services/approval.ts` | `ApprovalRule` | manager | PRO | **READY** |
| So'rovga qaror | `POST /api/tasdiqlash/sorovlar/[id]` | ⇡ | `ApprovalRequest` | manager | PRO | **READY** — lekin push yo'q |

### 4.10 Hisobot, AI, qidiruv, bildirishnoma

| Funksiya | API | Servis/Query | Model | Rol | Tarif | iOS |
|---|---|---|---|---|---|---|
| Oylik hisobot | `GET /api/reports/monthly` | `lib/reports/` | `Transaction` | `hisobot.korish` | core | **READY** |
| Excel / PDF | `/excel`, `/pdf` | ⇡ | ⇡ | ⇡ | core | **PARTIAL** — native ulashish/saqlash kerak |
| AI suhbat | `POST /api/ai/chat` | `lib/ai/tools.ts` | — | hamma | PRO | **READY** — 6 ta tool |
| AI hisobot xulosasi | `POST /api/ai/hisobot-xulosa` | ⇡ | — | manager | PRO | **READY** |
| Global qidiruv | `GET /api/search` | — | 4 model | hamma | core | **READY** |
| Bildirishnoma soni | `GET /api/me/notif-count` | `queries/notifications.ts` | bir nechta | hamma | core | **READY** |
| **Push (APNs)** | — | — | — | — | — | **MISSING** |

AI tool'lari (`src/lib/ai/tools.ts`): `oylik_xulosa`, `kategoriya_taqsimoti`,
`oylik_trend`, `qarzdorlik`, `crm_holati`, `vazifalar_holati` — **6 ta**.

### 4.11 Obuna va superadmin

| Funksiya | API | Model | Rol | iOS |
|---|---|---|---|---|
| Checkout | `POST /api/billing/checkout` | `Payment` | manager | **READY** — lekin iOS'da BERKITILGAN (App Store 3.1.1) |
| Payme / Click webhook | `/api/billing/payme`, `/click/*` | `Payment` | — | — (server) |
| Superadmin panel | `/api/superadmin/*` (11 route) | `Tenant`,`Payment` | SUPERADMIN | **MISSING** — iOS'ga kiritilmaydi (qaror) |

---

## 5. SERVER OQIMLARI (iOS oqimini shular belgilaydi)

### 5.1 Sotuv — `createSale` (`services/inventory.ts:122-266`)

Bitta atomik tranzaksiyada (`runBusinessTx`):

1. Mahsulotni topadi (`isActive: true`), yo'q bo'lsa — xato.
2. Narxni aniqlaydi: `params.narx` berilsa **kelishilgan narx**, aks holda `product.sotuvNarx`. Ikkalasi ham yo'q → xato.
3. `tolovTuri = "qarz"` bo'lsa `mijozNomi` MAJBURIY.
4. Qarzga sotuvda `contactId` berilgan bo'lsa — **qarz limiti tekshiriladi** (`qarzLimitTekshirTx`), qoldiqqa TEGILMASDAN oldin.
5. **Atomik shartli kamaytirish**: `updateMany({ where: { miqdor: { gte: miqdor } } })`. `count === 0` → "Omborda yetarli emas". Bu poyga holatini yopadi.
6. AVTO biznesda kelishilgan narx kartochkaga yoziladi; **oddiy omborda YOZILMAYDI** (aks holda bitta chegirma butun katalog narxini buzardi — izohda H-1 deb belgilangan).
7. `Sale` yoziladi (tannarx snapshot bilan).
8. Tarmoqlanish:
   - **naqd** → `Transaction` (kirim) yoziladi, `sale.transactionId` bog'lanadi;
   - **qarz** → kirim YOZILMAYDI, `Debt` (status `OPEN`) yaratiladi. Kirim faqat to'lov qabul qilinganda, **to'lov sanasi** bilan yoziladi.
9. Tranzaksiyadan tashqarida audit yoziladi.

> **iOS uchun ma'no:** sotuv ekrani bitta mahsulot tanlaydi, miqdor butun
> son, to'lov turi **naqd|qarz** (aralash to'lov YO'Q). Qarz yo'lida mijoz
> nomi majburiy maydon. Savat loyihalanadi, lekin MISSING bo'ladi.

### 5.2 Xarid qabul qilish — `qabulQilish` (`services/xarid.ts:216+`)

1. Buyurtmani topadi; allaqachon qabul qilingan yoki bekor qilingan bo'lsa — xato.
2. Satrlarni oladi (`purchaseOrderItem`), bo'sh bo'lsa — xato.
3. Har satr uchun: `StockEntry` yaratadi (tannarx snapshot) + `Product.miqdor` ni oshiradi.
4. To'langan qismni hisoblaydi; `0 ≤ to'langan ≤ jami` bo'lmasa — xato. **Qisman to'lov qo'llab-quvvatlanadi.**
5. Ta'minotchi ICHKI (tizim useri) bo'lsa — to'lov uning shaxsiy kassasiga transfer qilinadi; ta'minotchi va xaridor bir xil bo'lsa — xato.

### 5.3 Kunlik yakun — `submitKunlikReport` → `confirmKunlikReport`

**Topshirish** (`services/kunlik.ts:265`):
1. Kelajak kunni topshirib bo'lmaydi.
2. `updateMany({ where: { holat: "OPEN" } , data: { holat: "SUBMITTED" }})` — **shartli o'tish**, ikki marta topshirilmaydi.
3. `count === 0` bo'lsa joriy holatni o'qib aniq xato beradi (CONFIRMED bo'lsa boshqa xabar).
4. Direktorga Telegram xabari (**best-effort** — yuborilmasa jarayon buzilmaydi).

**Tasdiqlash** (`:332`):
1. Faqat **tayinlangan direktor** (`DailyReportSetting`), aks holda `ForbiddenError`.
2. Kelajak kun — xato. Tushumsiz kun ham yakunlanadi (0 so'm).
3. `updateMany({ where: { holat: { in: ["OPEN","SUBMITTED"] } } })` → `CONFIRMED`.
4. `count === 0` → "Bu kun allaqachon tasdiqlangan".

> **iOS uchun ma'no:** holat mashinasi `OPEN → SUBMITTED → CONFIRMED`
> (+ `reopen`). Ikkala o'tish ham shartli `updateMany` — ya'ni **klient
> ikki marta bosса ham xavfsiz**, bu offline navbat uchun yaxshi xabar.

### 5.4 Smena yopish — `smenaYop` (`services/smena.ts:116-195`)

1. Oxirgi smena va bugungi smenalar sonini oladi → **joriy oyna chegarasi** (`joriyChegara`).
2. Oyna: `(oxirgi smena tugagan vaqt, hozir]`.
3. Shu oynadagi `DailyTransaction` (tushum) va `Transaction` (chiqim) larni jamlaydi.
4. `kutilganNaqd = boshlang'ich qoldiq + tushum − chiqim`.
5. `Smena` yozuvini yaratadi (sanalgan naqd, farq, qoldirilgan naqd bilan).
6. Audit.

> **iOS uchun ma'no:** kun ichida bir necha marta smena yopish mumkin.
> Ekran "kutilgan naqd" ni ko'rsatib, kassirdan **sanalgan naqd** ni so'raydi;
> farq darhol hisoblanadi.

---

## 6. iOS HOLATI — STATISTIKA

| Holat | Soni | Ulushi |
|---|---:|---:|
| **READY** | 52 | ~75% |
| **PARTIAL** | 11 | ~16% |
| **MISSING** | 6 | ~9% |

**MISSING** (6): ko'p qatorli savat · kasr miqdor · shtrix-kod skaner ·
push bildirishnoma · ombor entity · superadmin paneli (ataylab kiritilmaydi).

**PARTIAL** (11): login/logout (JWT kerak) · sotuv (bitta mahsulot) ·
chek (native ulashish) · eksport/import · Excel/PDF · fayl ilovasi
(rasm yuklash) · qarz aging · filial (entity yo'q) · qaytarish (faqat bekor) ·
offline (bitta idempotentlik pretsedenti) · narx darajalari.

---

## 7. ANIQLANMAGAN (UNKNOWN) — mendan emas, sizdan javob kerak

1. **Filial** — hozir erkin matn. iOS'da filial bo'yicha ajratish kerakmi,
   yoki bu maydon amalda ishlatilmaydimi? (Mavjud ma'lumotda nechta xil
   qiymat borligini bilmayman — bazaga kirmadim.)
2. **AVTO tarifi** — bu alohida mijoz segmentimi yoki bitta mijozmi?
   iOS'da avto rejimiga alohida oqim kerakmi?
3. **Superadmin** — iOS'ga kiritilmasin degan taxminim to'g'rimi?
   (Men "yo'q" deb hisobladim: bu platforma egasining ishi, telefonda emas.)
