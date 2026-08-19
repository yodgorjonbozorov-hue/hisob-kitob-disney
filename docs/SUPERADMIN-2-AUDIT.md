# SUPERADMIN 2.0 — AUDIT VA ARXITEKTURA HISOBOTI

Sana: 2026-08-19 · Manba: `hisob-kitob-disney` (Balansa) repozitoriysi
Bu hujjat KOD YOZISHDAN OLDIN bajarilgan to'liq auditning natijasi.

---

## 1. MAVJUD ARXITEKTURA

### 1.1 Texnologiya
- **Next.js 14 App Router**, React 18, TypeScript strict, Tailwind (CSS o'zgaruvchili
  brend tokenlari — `globals.css` + `tailwind.config.ts`).
- **Prisma 5** + ikki dialekt: SQLite/libsql (`@prisma/adapter-libsql`) va
  PostgreSQL (`@prisma/adapter-pg`). Dialekt `DATABASE_URL` sxemasidan tanlanadi
  (`lib/db/dialect.ts`).
- Sessiya — **iron-session** (shifrlangan cookie, `balansa_session`, 7 kun).
- Migratsiya — qo'lda yozilgan SQL fayllar, `scripts/db-migrate.mjs` idempotent
  qo'llaydi (`_applied_migrations`). Postgres varianti `scripts/pg-migratsiya.mjs`
  bilan sxemadan qayta generatsiya qilinadi.

### 1.2 Ko'p ijarachilik (multi-tenancy)
```
Tenant (mijoz kompaniya)
 ├── User[]        (tenantId; SUPERADMIN uchun null)
 ├── Business[]    (biznes bo'limlari)
 │    └── ~35 biznesga bog'langan model (Transaction, Sale, Debt, Product, ...)
 ├── TenantModule[]  (qaysi modul yoqilgan)
 ├── Subscription[]  (obuna davrlari)
 ├── Payment[]       (to'lovlar)
 └── Role[]          (PRO: maxsus rollar)
```
Izolyatsiya **Prisma client extension** (`lib/db/tenantDb.ts`) orqali:
`TENANT_DIRECT` / `BUSINESS_SCOPED` / `TIZIM_MODELLAR` to'plamlari.
Ro'yxatga tushmagan model **fail-open** — `tests/izolyatsiya-royxati.test.ts`
buni majburlaydi.

### 1.3 Auth va rollar
- Tizim rollari: `SUPERADMIN | OWNER | ADMIN | CASHIER | SELLER` (`lib/auth/roles.ts`).
- Granular huquqlar (PRO): `lib/permissions/katalog.ts` + `Role.huquqlar` JSON +
  `User.huquqPlus/huquqMinus`.
- Guard'lar: `withTenant()` (tenant API), `withSuperadmin()` (superadmin API),
  `requireTenantPage()` / `requireSuperadminPage()` (sahifalar).
- `verifySuperadmin()` sessiyaga ISHONMAYDI — har so'rovda bazadan qayta o'qiydi.

### 1.4 Obuna, tarif, modul
- Tariflar **kodda**: `lib/billing/plans.ts` (STANDARD / AVTO / PRO).
- Modul katalogi **kodda**: `lib/modules/registry.ts` (MOLIYA, KUNLIK, OMBOR,
  XARID, TASDIQLASH, MIJOZLAR, HR, HUJJATLAR, CRM, VAZIFALAR, AI, BOSHQARUV).
- Modul yoqilganligi uch shartdan: katalogda bor + tarifda bor + `TenantModule.isActive`.
- Kirish rejimi `computeAccess()` — `FULL | READONLY | BILLING_ONLY`.
- To'lov provayderlari: MANUAL (superadmin tasdiqlaydi), Payme, Click.

### 1.5 Audit
- `AuditLog` modeli; yozuv **avtomatik** — tenant extension har
  `create/update/delete` ni ushlaydi (`lib/db/auditWriter.ts`).
- Superadmin amallari `logSuperadminAction()` orqali qo'lda yoziladi.

### 1.6 Mavjud superadmin paneli
- Bitta sahifa: `src/app/superadmin/page.tsx` + 527 satrli
  `SuperadminClient.tsx` (loyiha qoidasi bo'yicha limit 250 satr — **buzilgan**).
- 11 ta API route: tenants (create/delete/extend/bepul/block/plan/impersonate),
  payments (confirm/reject), users (reset-password), impersonate/exit.
- Servis qatlami: `lib/superadmin/service.ts`, `newClient.ts`, `kassa.ts`.

### 1.7 Infratuzilma
- Zaxira: `lib/backup/dump.ts` (`ZAXIRA_JADVALLARI` bog'liqlik tartibida) +
  Telegram kanalga yuborish; deploy oldidan majburiy (`scripts/deploy-zaxira.mjs`).
- Cron: `/api/cron/{billing,backup,reports,tasks,monthly-report}`.
- Rate limit: bazaga asoslangan (`lib/rateLimit.ts`, `AppSetting` jadvali).
- Health: `/api/health` — ommaviy, minimal (commit, muhit, migratsiya soni).
- Redis / navbat (queue) / obyekt saqlagich **YO'Q** — bu SaaS Vercel + bitta
  baza ustida ishlaydi. Shuning uchun "Redis/Queue health" **soxta ko'rsatilmaydi**.

---

## 2. TOPILGAN MUAMMOLAR

| # | Muammo | Daraja |
|---|--------|--------|
| 1 | Superadmin RBAC binar: har superadmin hamma narsani qila oladi | KRITIK |
| 2 | Audit yozuvi O'CHIRILADI (`deleteEmptyTenant` → `auditLog.deleteMany`) | KRITIK |
| 3 | Sessiyani bekor qilib bo'lmaydi — bloklangan/o'chirilgan foydalanuvchi cookie tugagunicha (7 kun) ishlaydi | KRITIK |
| 4 | Superadmin audit yozuvida `tenantId`, `ip`, `userAgent`, `before`, `sabab` yo'q | YUQORI |
| 5 | `/superadmin` sahifasi BARCHA tenant + BARCHA user + BARCHA to'lovni bitta so'rovda yuklaydi (server-side pagination yo'q) | YUQORI |
| 6 | Xavfli amallar `window.prompt()` bilan; sabab so'ralmaydi, ikki bosqichli tasdiq yo'q | O'RTA |
| 7 | Superadmin tenant modulini yoqa/o'chira olmaydi (faqat OWNER o'zi) | O'RTA |
| 8 | Modul bog'liqligi (dependency) tizimi yo'q | O'RTA |
| 9 | Tizim sog'lig'i, zaxira holati, feature flag, support, global qidiruv yo'q | O'RTA |
| 10 | Superadmin uchun eksport (CSV) yo'q | PAST |
| 11 | Superadmin so'rovlari uchun indekslar yetishmaydi (`User.rol`, `Tenant.createdAt`, `Payment.createdAt`, `AuditLog.userId`) | O'RTA |
| 12 | `SuperadminClient.tsx` 527 satr — komponent limiti (250) buzilgan | PAST |

### 2.1 Xavfsizlik risklari
- **R1 — Imtiyoz eskalatsiyasi:** support xodimiga superadmin berilsa, u bazani
  o'chira oladi. Yechim: rol matritsasi + backend'da majburlash.
- **R2 — Audit ishonchsizligi:** audit o'chirilsa, superadmin o'z izini yo'qota
  oladi. Yechim: append-only qo'riqchi.
- **R3 — Sessiya bekor qilinmasligi:** o'g'irlangan cookie yoki ishdan bo'shagan
  xodim 7 kun kira oladi. Yechim: `User.sessionEpoch`.
- **R4 — Impersonatsiya izsizligi:** impersonatsiya paytida qilingan amallar
  auditda oddiy foydalanuvchi amali sifatida ko'rinadi. Yechim: aktor kontekstiga
  `impersonatedBy` qo'shish.

### 2.2 UX muammolari
- Bitta uzun sahifa; bo'lim yo'q, filtr yo'q, qidiruv yo'q.
- Loading/empty/error holatlari yo'q.
- `prompt()`/`confirm()` — brauzer modallari, mobil UX yomon.
- Mobil (375px) da jadval gorizontal siljiydi, karta ko'rinishi yo'q.

---

## 3. TAVSIYA ETILGAN ARXITEKTURA

```
src/lib/superadmin/
  rbac.ts          — rollar, huquq matritsasi, can()
  audit.ts         — WHO/WHAT/TARGET/WHEN/IP/UA/BEFORE/AFTER/REASON
  sessions.ts      — sessionEpoch orqali bekor qilish
  dashboard.ts     — KPI, chart, alert, oxirgi faoliyat
  bizneslar.ts     — server-side pagination/filter/sort
  foydalanuvchilar.ts
  obunalar.ts      — obuna + to'lov + MRR
  modullar.ts      — tenant moduli + dependency
  xavfsizlik.ts    — failed login, imtiyozli amallar, sessiyalar
  tizim.ts         — DB/migratsiya/zaxira/cron/telegram/provayder sog'lig'i
  support.ts       — tiket tizimi
  bayroqlar.ts     — feature flags
  qidiruv.ts       — global qidiruv
  eksport.ts       — CSV
lib/modules/bogliqlik.ts — modul dependency grafi
src/app/superadmin/(sahifalar)  — layout + 10 bo'lim
src/app/api/superadmin/*        — permission-guarded endpointlar
```

**Prinsiplar:**
1. Mavjud guard/servis/registry qayta ishlatiladi, qayta yozilmaydi.
2. Backend authoritative: frontend hech qanday huquq bermaydi.
3. Har privileged amal — zod validatsiya + permission + audit + sabab.
4. Har ro'yxat — server-side pagination + filter (100 000 biznesga chidamli).

---

## 4. MIGRATSIYA STRATEGIYASI (ma'lumot yo'qolmaydi)

Faqat **additiv**: `DROP TABLE`/`DROP COLUMN`/ma'lumot o'chirish YO'Q.

| O'zgarish | Turi | Backfill |
|---|---|---|
| `User.superadminRol TEXT DEFAULT 'ROOT'` | yangi ustun | mavjud SUPERADMIN → `ROOT` |
| `User.sessionEpoch INTEGER DEFAULT 0` | yangi ustun | 0 (barcha sessiyalar amalda qoladi) |
| `AuditLog.userAgent TEXT` | yangi ustun | NULL |
| `AuditLog.sabab TEXT` | yangi ustun | NULL |
| `FeatureFlag` | yangi jadval | — |
| `SupportTicket`, `SupportMessage` | yangi jadval | — |
| 6 ta indeks | yangi indeks | — |

Orqaga moslik: eski sessiyalarda `sessionEpoch` yo'q → `0` deb hisoblanadi,
ya'ni hech kim tizimdan chiqarilmaydi. Eski superadmin `ROOT` bo'lib qoladi —
bugungi xatti-harakat AYNAN saqlanadi.

Eski `/superadmin` endpointlari (`extend`, `block`, `plan`, `bepul`,
`impersonate`, `payments/*`, `users/*/reset-password`) **saqlanadi** va yangi
permission qatlamiga o'raladi — hech biri o'chirilmaydi.

---

# QISM 2 — BAJARILGAN ISH (SUPERADMIN 2.0)

## Arxitektura

Mavjud arxitektura QAYTA YOZILMADI, kengaytirildi:

- `withTenant` / tenant izolyatsiyasi extension'i — **tegilmadi**;
- modul registry (`lib/modules/registry.ts`) — **tegilmadi**, ustiga
  bog'liqlik qatlami qo'shildi (`lib/modules/bogliqlik.ts`);
- tariflar (`lib/billing/plans.ts`) — **tegilmadi**;
- to'lov provayderlari (Payme/Click) — **tegilmadi**;
- `withSuperadmin` guard'i RUXSAT talab qiladigan qilib kengaytirildi.

Yangi qatlamlar:

```
lib/superadmin/rbac.ts          — rollar va huquq matritsasi (yagona manba)
lib/superadmin/audit.ts         — WHO/WHAT/TARGET/WHEN/WHERE/BEFORE/AFTER/REASON
lib/superadmin/sessiyalar.ts    — sessionEpoch orqali sessiyani bekor qilish
lib/superadmin/sahifalash.ts    — server tomonda sahifalash
lib/superadmin/turlar.ts        — client-safe turlar va yorliqlar
lib/superadmin/{bizneslar,foydalanuvchilar,obunalar,billing,modullar,
                dashboard,xavfsizlik,tizim,support,bayroqlar,qidiruv,
                eksport,auditQidiruv,navigatsiya,sorovParam}.ts
lib/modules/bogliqlik.ts        — modul dependency grafi
lib/validation/superadmin.ts    — zod sxemalari (sabab majburiy)
```

## Database

Bitta **additiv** migratsiya: `20260819090000_superadmin_2_control_center`.

| Obyekt | O'zgarish |
|---|---|
| `User.superadminRol` | yangi ustun (NULL = eski holat = ROOT) |
| `User.sessionEpoch` | yangi ustun, default 0 |
| `AuditLog.userAgent` | yangi ustun |
| `AuditLog.sabab` | yangi ustun |
| `FeatureFlag` | yangi jadval |
| `SupportTicket`, `SupportMessage` | yangi jadval |
| 6 indeks | `AuditLog(userId,createdAt)`, `AuditLog(action,createdAt)`, `Tenant(createdAt)`, `Payment(createdAt)`, `Subscription(periodEnd)`, `User(rol)` |

`DROP` yo'q, ma'lumot o'chirilmaydi, mavjud yozuvlar qayta yozilmaydi.
Yangi modellar `tenantDb.ts` va `dump.ts` ro'yxatlariga kiritildi
(`test:izolyatsiya-royxati`, `test:backup` buni majburlaydi).
Postgres migratsiyasi `npm run pg:migratsiya` bilan qayta generatsiya qilindi.

## RBAC

6 rol: **ROOT · ADMIN · SUPPORT · FINANCE · ANALYST · READ_ONLY**.
13 resurs × 5 amal (VIEW/CREATE/UPDATE/DELETE/MANAGE) matritsasi
`lib/superadmin/rbac.ts` da — sidebar, sahifa guard'i va API guard'i
SHU BITTA manbaga tayanadi.

ROOT matritsada yo'q (u har doim "ha" deydi), qolgan rollar esa yangi resurs
qo'shilganda uni **avtomatik olmaydi** — bu ataylab fail-closed kengayish.

## Xavfsizlik yaxshilanishlari

1. **Sessiyani bekor qilish** — `User.sessionEpoch`. Bloklangan yoki paroli
   tiklangan foydalanuvchining ochiq cookie'lari darhol kuchsizlanadi.
   Ilgari bu 7 kungacha ishlayverardi.
2. **Har so'rovda foydalanuvchi holati tekshiriladi** (`lib/auth/tenant.ts`)
   — o'chirilgan hisob keyingi so'rovdayoq yopiladi.
3. **Append-only audit** — `AuditLog` ustida `update/delete` client
   darajasida bloklangan (`lib/db/rawPrisma.ts`).
4. **Kirish urinishlari jurnali** — muvaffaqiyatli va muvaffaqiyatsiz
   loginlar auditga tushadi, Xavfsizlik markazi shulardan hisoblaydi.
5. **Impersonatsiya** — alohida ruxsat, majburiy sabab, audit, nishon
   foydalanuvchining `sessionEpoch` i ko'chiriladi.
6. **Eksport** — POST + sabab + audit; parol hash, token va Telegram ID
   chiqmaydi; CSV formula in'ektsiyasi neytrallanadi.
7. **Oxirgi ROOT himoyasi** — oxirgi ROOT ni pasaytirib bo'lmaydi; o'z rolini
   o'zgartirish va o'zini bloklash taqiqlangan.

## Ochiq qolgan cheklovlar (yashirilmaydi)

- **Sessiyalar ro'yxati yo'q.** iron-session stateless: qaysi qurilmadan
  kirilgani serverda saqlanmaydi, shuning uchun alohida qurilmani chiqarib
  bo'lmaydi — bekor qilish har doim "hamma qurilmada". Qurilmalar ro'yxati
  kerak bo'lsa alohida `Session` jadvali qo'shilishi shart.
- **Audit immutability ilova darajasida.** `$queryRaw` extension'ni chetlab
  o'tadi. To'liq kafolat baza triggeri yoki alohida DB roli bilan beriladi —
  bu infratuzilma qarori.
- **Redis/navbat yo'q** — Tizim sahifasida ular SOZLANMAGAN deb ko'rsatiladi,
  soxta "SOG'LOM" yozilmaydi.
- **Churn taxminiy**: obuna holati tarixi saqlanmaydi, shuning uchun churn
  "davr ichida muddati tugab, hozir to'lamayotgan" mijozlar soni sifatida
  hisoblanadi.
- **"Faollik"/"tushum" bo'yicha saralash** joriy sahifa ichida bajariladi
  (bu maydonlar tenant jadvalida ustun emas) — panel buni ochiq aytadi.
