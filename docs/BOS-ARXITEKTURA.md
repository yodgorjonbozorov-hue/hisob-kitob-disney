# Business OS — Arxitektura hujjati (BOS-0)

> Holat: TAKLIF (tasdiq kutilmoqda) · Sana: 2026-07-27
> Asos: production'dagi multi-tenant SaaS (saas/faza-1..6 yakunlangan)

## 1. Bugungi holat (audit xulosasi)

Mavjud poydevor Business OS uchun to'g'ri qurilgan:

| Qatlam | Holat | BOS uchun ahamiyati |
|---|---|---|
| Multi-tenant izolyatsiya | `lib/db/tenantDb.ts` extension — kontekstsiz so'rov XATO | Har yangi modul avtomatik izolyatsiyalanadi |
| Obuna/billing | Tenant status guard, MANUAL to'lov, provider-agnostik | Modul-tarif bog'lash uchun tayyor ilgak |
| RBAC | 5 rol (SUPERADMIN/OWNER/ADMIN/CASHIER/SELLER), markaziy `roles.ts` | Modul-rol matritsasiga kengayadi |
| Moliya yadrosi | Kirim-chiqim, budjet, takroriy, smena, hisobot PDF/Excel | = **MOLIYA moduli v0.5** |
| Ombor/Sotuv | `Business.omborli` flagi bilan yoqiladi | = **modul tizimining prototipi** (umumlashtiriladi) |
| Telegram bot | Tenant-aware, obuna guard'li | Kelajakda CRM lead kanali |
| Testlar | 49 ta (izolyatsiya/billing/signup/superadmin) | Har modul o'z test to'plamini oladi |

**Asosiy kuzatuv:** `omborli` flagi allaqachon "modul yoqish/o'chirish" g'oyasining isboti — faqat u bitta modul uchun, biznes darajasida, qo'lda kodlangan. BOS-1 buni umumiy tizimga aylantiradi.

**Texnik qarz (yo'q darajada, lekin qoida sifatida yozamiz):** navigatsiya 3 joyda qo'lda takrorlanadi (Sidebar, BottomNav, CommandPalette) — modul tizimida BITTA manbadan generatsiya qilinadi.

---

## 2. Modul tizimi dizayni (BOS-1 uchun)

### 2.1 Ikki daraja

1. **Katalog (kodda, statik)** — `src/lib/modules/registry.ts`. Modul nima ekani, nav havolalari, rol matritsasi, qaysi tarifda borligi. Kod bilan birga versiyalanadi.
2. **Yoqilganlik (bazada, dinamik)** — qaysi tenant qaysi modulni yoqqan.

### 2.2 Katalog sxemasi (TypeScript)

```ts
interface ModulTa'rifi {
  code: string;              // "MOLIYA" | "OMBOR" | "CRM" | "VAZIFALAR" | ...
  nomi: string;              // "Moliya"
  tavsif: string;
  core: boolean;             // true => o'chirib bo'lmaydi (MOLIYA, SOZLAMALAR)
  tariflar: string[];        // qaysi plan'larda mavjud: ["STANDARD", "PRO"]
  rollar: Partial<Record<Rol, "full" | "read" | "none">>; // modul-rol matritsasi
  nav: NavHavola[];          // Sidebar/BottomNav/CommandPalette BITTA manbadan
  bizneslik?: boolean;       // true => biznes darajasida ham yoqiladi (OMBOR kabi)
}
```

### 2.3 Baza sxemasi (yangi model)

```prisma
/// Tenant qaysi modullarni yoqqani. Katalog kodda — bu jadval faqat holat.
model TenantModule {
  id        String   @id @default(cuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  code      String   // registry'dagi modul kodi
  isActive  Boolean  @default(true)
  sozlamalar String? // modul-spetsifik JSON (masalan CRM pipeline defaultlari)
  createdAt DateTime @default(now())

  @@unique([tenantId, code])
  @@index([tenantId])
}
```

- Extension'da `TENANT_DIRECT` to'plamiga qo'shiladi (avtomatik izolyatsiya).
- Backfill: `omborli=true` biznesi bor tenantlarga `OMBOR` yozuvi; hammaga `MOLIYA` (core — yozuv bo'lmasa ham yoqilgan hisoblanadi).
- `Business.omborli` SAQLANADI — "OMBOR moduli qaysi biznesda faol" degan ikkinchi daraja (bizneslik modul).

### 2.4 Server tekshiruvi

```ts
// lib/modules/guard.ts
async function requireModule(ctx: TenantContext, code: string): void
// 1) katalogda bormi  2) tenant tarifida bormi  3) TenantModule'da yoqiqmi
// 4) rol matritsasida ruxsat bormi — bo'lmasa ForbiddenError
```

- `withTenant` ga ixtiyoriy `module: "CRM"` opsiyasi qo'shiladi — route darajasida deklarativ.
- Sahifalarda `requireTenantPage()` natijasi bilan `requireModulePage(ctx, "CRM")`.
- **QOIDA:** har yangi modul modeli `tenantDb.ts` dagi to'plamlarga qo'shilishi va izolyatsiya testine ega bo'lishi SHART (PR checklist).

### 2.5 UX oqimi

- **Sozlamalar → Modullar** (faqat OWNER): kartochkalar, bitta toggle = 1 klik. Core modullar toggle'siz.
- Modul o'chirilsa: ma'lumot O'CHMAYDI, faqat nav/route yopiladi (billing READONLY tajribasi bilan bir xil falsafa).
- Tarifda yo'q modul kartochkasi: "PRO tarifda" belgisi + billing'ga havola (upsell).
- Navigatsiya: Sidebar/BottomNav/CommandPalette registry'dan quriladi — yangi modul qo'shganda UI kodiga tegilmaydi.

### 2.6 Tarif-modul bog'lanishi

`lib/billing/plans.ts` kengayadi:

```ts
{ code: "STANDARD", oylikNarx: 200_000, modullar: ["MOLIYA", "OMBOR"] }
{ code: "PRO",      oylikNarx: 300_000, modullar: [...STANDARD, "CRM", "VAZIFALAR", "AI"] }
```

Narxlar — taklif, siz belgilaysiz. Mavjud STANDARD mijozlari ta'sirlanmaydi (grandfather: hozirgi modullar ularda qoladi).

---

## 3. CRM v1 eskizi (BOS-2 uchun, hozir faqat dizayn)

### 3.1 Modellar

```prisma
/// Mijoz/kontakt — biznes darajasida (extension avtomatik himoya qiladi).
model Contact {
  id         String  @id @default(cuid())
  businessId String
  business   Business @relation(...)
  ism        String
  tel        String?
  telegram   String?
  izoh       String?
  teglar     String?  // JSON array (v1); keyin alohida jadval
  createdBy  String   // userId
  createdAt  DateTime @default(now())
  deals      Deal[]
  activities Activity[]
  @@index([businessId])
  @@index([businessId, tel])
}

/// Sotuv bosqichi (pipeline ustuni). Default to'plam modul yoqilganda yaratiladi.
model Stage {
  id         String @id @default(cuid())
  businessId String
  nomi       String   // "Yangi", "Aloqa qilindi", "Taklif", "Yutildi", "Yo'qotildi"
  tartib     Int
  turi       String @default("OPEN") // OPEN | WON | LOST
  @@index([businessId, tartib])
}

/// Bitim (lead ham shu — eng birinchi bosqichdagi bitim). Alohida Lead modeli YO'Q:
/// bitta model = sodda UX, 3-klik prinsipi. "Lead konvertatsiyasi" degan ortiqcha qadam yo'q.
model Deal {
  id         String   @id @default(cuid())
  businessId String
  contactId  String?
  nomi       String
  summa      Int      @default(0)
  stageId    String
  masulId    String   // mas'ul user
  manba      String?  // "telegram" | "qo'lda" | "sayt" ...
  muddat     DateTime?
  yopilgan   DateTime?
  createdAt  DateTime @default(now())
  @@index([businessId, stageId])
  @@index([businessId, masulId])
}

/// Faoliyat tarixi (izoh, qo'ng'iroq, uchrashuv) — timeline.
model Activity {
  id         String  @id @default(cuid())
  businessId String
  contactId  String?
  dealId     String?
  turi       String  // "izoh" | "qongiroq" | "uchrashuv" | "telegram"
  matn       String
  userId     String
  createdAt  DateTime @default(now())
  @@index([businessId, dealId])
  @@index([businessId, contactId])
}
```

### 3.2 UX (3-klik tekshiruvi)

- Kanban: bitim kartasini bosqichga sudrash = 1 amal. Yangi bitim: "+" → ism/summa → saqlash = 3 klik.
- Bitim ochilganda: timeline + tez izoh qutisi (Enter = saqlash).
- Mobil: kanban gorizontal skroll; karta bosilganda pastdan sheet.
- Rollar: OWNER/ADMIN full; SELLER — CRM'da **full** (sotuvchining asl ishi shu! FAZA-2 dagi "faqat kirim-chiqim" cheklovi moliya moduliga tegishli edi — CRM uni bekor qilmaydi, modul-rol matritsasi orqali alohida beriladi); CASHIER — none (default, sozlanadi).
- Yutildi bosqichiga tushganda: "Kirim yozilsinmi?" — 1 klik bilan MOLIYA'ga tranzaksiya (modullar bir-birini kuchaytiradi — Business OS mohiyati).

### 3.3 Telegram lead kanali (BOS-2 oxiri)

Bot'ga "yangi lead" oqimi: mijoz yozadi → bot kontakt+bitim yaratadi (birinchi bosqichda) → mas'ulga xabar. Bot infra tayyor.

---

## 4. AI qatlam eskizi (BOS-4 uchun)

- `/api/ai/chat` — Claude API (server-side, `ANTHROPIC_API_KEY` env). Model: claude-sonnet-5 (narx/sifat balansi).
- AI'ga xom baza EMAS — tenant-scoped tayyor funksiyalar beriladi (tool-use): `getMonthSummary`, `getCategoryBreakdown`, `getTrend`, `listDebts`... Ya'ni AI ham xuddi route'lar kabi izolyatsiya ichida ishlaydi.
- Boshlang'ich 3 imkoniyat: (1) "Biznesim qanday?" chat, (2) oylik hisobotga AI xulosa paragrafi (PDF ichiga), (3) AI moliya maslahati ("chiqimlar o'tgan oyga nisbatan +40% — sabab: ...").
- Xarajat nazorati: so'rovlar tenant bo'yicha limitlanadi (kunlik N), PRO tarifga bog'lanadi.

---

## 5. Miqyoslanish va texnik qoidalar

1. **Baza:** hozircha bitta Turso DB — 1-2 ming tenantgacha yetadi (indekslar to'g'ri bo'lsa). 100k kompaniya uchun keyin: Turso "database per tenant" yoki Postgres+RLS'ga ko'chish yo'li ochiq — barcha so'rovlar `businessId/tenantId` scoped bo'lgani uchun ko'chish mexanik bo'ladi. Hozir bu haqda QAROR QILINMAYDI (overengineering).
2. **Har yangi jadval:** `businessId` yoki `tenantId` + indeks + extension to'plamiga qo'shish + izolyatsiya testi — PR checklist (docs/MODUL-CHECKLIST.md sifatida BOS-1 da).
3. **Pagination standarti:** har ro'yxat `take/skip` + `orderBy` indeksli ustunda.
4. **Soft delete:** Transaction'dagi `deletedAt` uslubi CRM Deal/Contact'ga ham qo'llanadi.
5. **Mobil:** BottomNav maksimal 4 tab + Menyu — modul ko'paysa tab emas, Menyu boyiydi.

## 6. Bosqichlar va qabul shartlari

| Bosqich | Natija | Qabul sharti |
|---|---|---|
| BOS-1 | Modul registri + TenantModule + Sozlamalar→Modullar + nav bitta manbadan + OMBOR backfill | Modulni o'chirsam nav/route yopiladi, ma'lumot qoladi; mavjud mijozlar hech narsa sezmaydi; izolyatsiya testlari yashil |
| BOS-2 | CRM v1 (kanban, kontakt, timeline, Yutildi→Kirim, Telegram lead) | Sotuvchi 3 klikda bitim ochadi; tenant A bitimi B'da ko'rinmaydi (test) |
| BOS-3 | Vazifalar v1 | 3 klikda vazifa; Telegram bildirishnoma |
| BOS-4 | AI v1 (chat + hisobot xulosasi) | AI faqat o'z tenanti ma'lumotini ko'radi (test) |
| BOS-5 | Avtomatlashtirish v1 | Trigger→amal ishlaydi, loop himoyasi bor |

Har bosqich: alohida branch (`bos/faza-N`), kichik commitlar, testlar, sizning tasdiq — avvalgi tartib.
