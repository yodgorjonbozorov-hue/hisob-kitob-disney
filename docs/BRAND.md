# BRAND.md — Balansa brend kitobi

> Kodda brend nomi qattiq yozilmaydi — yagona manba [`src/lib/brand.ts`](../src/lib/brand.ts).
> Rang tokenlarining yagona manbasi [`src/app/globals.css`](../src/app/globals.css) (`:root` / `.dark`),
> Tailwind ularni [`tailwind.config.ts`](../tailwind.config.ts) orqali ochadi.

## 1. Brand Lock (o'zgarmas)

| Element | Qiymat |
|---|---|
| Brend nomi | **Balansa** |
| Domen | balansa.uz |
| Pozitsiya | Kichik va o'rta biznes uchun yagona boshqaruv platformasi (Business OS) |
| Tagline (UZ) | Biznesingiz balansda |
| Tagline (RU) | Ваш бизнес в балансе |
| Tagline (EN) | Your business in balance |
| Logo belgisi | Tarozi + o'sish grafigi shaklidagi abstrakt belgi |
| Sarlavha shrifti | Poppins 600/700 (`font-heading`) |
| Matn shrifti | Inter 400/500/600 (`font-sans`) |
| Raqam shrifti | Manrope, tabular (`font-display`) — pul summalari ustunlar bo'ylab sakramaydi |

**Ovoz:** sodda, to'g'ridan-to'g'ri, hurmatli "siz". Texnik jargon yo'q. Raqamlar haqida
aniq gapiriladi, marketing shovqini qo'shilmaydi.

## 2. Rang tizimi

### Brend shkalasi (`brand-50` … `brand-900`, mavzudan qat'i nazar bir xil)

| Token | HEX | Ishlatilishi |
|---|---|---|
| `brand-50` | `#F0FDFA` | Eng och fon, hover holat |
| `brand-100` | `#CCFBF1` | Badge foni, tanlangan qator (`brand-wash`) |
| `brand-300` | `#5EEAD4` | Logo mint akssenti, grafik ikkinchi rang |
| `brand-500` | `#14B8A6` | Grafiklar, progress, aktiv border |
| `brand-600` | `#0D9488` | — |
| `brand-700` | `#0F766E` | **Primary** — logo, asosiy tugma, aktiv nav |
| `brand-800` | `#115E59` | Tugma hover/pressed (`brand-ink`) |
| `brand-900` | `#134E4A` | Dark surface, dark mode `brand-wash` |

### Semantik brend tokenlari (dark mode'da avtomatik flip)

`bg-brand` / `text-brand` · `bg-brand-ink` (hover) · `bg-brand-wash` (soft fon) · `text-brand-fg` (brend ustidagi matn).
Dark mode'da `brand` → `#2DD4BF`, `brand-ink` → `#5EEAD4`, `brand-wash` → `#134E4A`.

### Moliyaviy semantika

| Token | Light | Ma'nosi |
|---|---|---|
| `income` | `#16A34A` | Kirim, "Yutildi", to'lov tasdiqlandi |
| `expense` | `#DC2626` | Chiqim, muddati o'tgan vazifa, "Yo'qotildi" |
| `debt` / `warning` | `#D97706` / `#F59E0B` | Qarz, obuna ogohlantirishi, budjet limiti |
| `info` | `#0EA5E9` | Neytral xabar, tooltip |

**Muhim qoida:** kirim/chiqim ranglari **hech qachon** brend teal bilan almashtirilmaydi.
Yashil = pul kirdi, qizil = pul chiqdi. Asosiy CTA tugmalari `bg-brand` (teal), `bg-income` emas —
yashil faqat pul yo'nalishini bildiradi.

### Neytral

`#0F172A` asosiy matn · `#475569` ikkinchi darajali · `#64748B` placeholder ·
`#E2E8F0` border · `#F1F5F9` sahifa foni · `#FFFFFF` karta foni.
Tailwind default palitra (blue/gray/slate) UI'da ishlatilmaydi.

## 3. Logo

React komponenti: [`src/components/Logo.tsx`](../src/components/Logo.tsx) — ranglarni
tokenlardan oladi, light/dark'ga o'zi moslashadi.

```tsx
<Logo variant="full" height={32} />              {/* belgi + "Balansa" */}
<Logo variant="icon" height={26} />              {/* faqat belgi — mobil */}
<Logo variant="full" height={28} inverted />     {/* majburan qorong'i fon ustida */}
```

`public/` dagi statik nusxalar:

| Fayl | Nima uchun |
|---|---|
| `logo-full.svg` | Gorizontal lockup (oq/och fon) |
| `logo-full-dark.svg` | Qorong'i fon uchun |
| `logo-icon.svg` | Faqat belgi |
| `favicon.svg`, `icon.svg` | Teal kvadrat ichida oq belgi — favicon, PWA |
| `favicon-256.png`, `logo-icon-512.png` | Raster — Telegram profil rasmi, PWA maskable |
| `logo-full-1600.png` | OG-image, email header |

### Foydalanish qoidalari

- Minimal o'lcham: belgi **24px**, lockup **120px** kenglik.
- Atrofida bo'sh joy: belgi balandligining **25%**.
- Cho'zish, aylantirish, soya qo'shish, rangini o'zgartirish **taqiqlanadi**.
- Rangli fon ustiga faqat `logo-full-dark.svg` yoki `inverted` variant.
- PDF ichida belgi vektor sifatida chiziladi ([`MonthlyReportDocument.tsx`](../src/lib/pdf/MonthlyReportDocument.tsx)) —
  tashqi rasm yuklanmaydi, hisobot generatsiyasi tarmoqqa bog'liq emas.

## 4. Migratsiya holati (Hisob-Kitob → Balansa)

Bajarildi:

- `package.json`, `layout.tsx` metadata + OG + icons, `manifest.json`, theme color
- Rang tokenlari (`globals.css`), Tailwind `brand` shkalasi, grafik palitrasi (`CHART_COLORS`)
- Logo komponenti (`DisneyLogo` → `Logo`), header/sidebar/mobil nav, login, signup, landing, billing
- PDF header + footer (`Balansa · balansa.uz`), Excel brend qatori va sarlavha rangi
- Telegram bot `/start`, kunlik xulosa va oylik hisobot sarlavhalari
- Sessiya cookie nomi: `disney_navoiy_session` → `balansa_session`

- `prisma/seed.ts` — demo ma'lumot neytral nomlarga o'tdi ("Demo Kompaniya" / "Demo Xizmatlar"),
  `package-lock.json` nomi `balansa`.

Ataylab tegilmadi:

- **Ma'lumotlar bazasi yozuvlari** — mavjud tenant/biznes nomlari mijoz ma'lumoti;
  rebranding faqat prezentatsiya qatlamida, migration yozilmaydi.
- **Seed'dagi ID'lar** (`tenant_disney_navoiy`, `biz_disney_navoiy`) — `20260727093026_tenant_layer`
  backfill'idagi qiymatlar bilan bir xil bo'lishi shart (idempotentlik). ID'lar hech qayerda
  ko'rinmaydi; `scripts/shot.mjs` ham shu ID'ga tayanadi.
- **Qo'llanilgan migratsiya SQL'lari** — tarix; ularni tahrirlash hech narsa bermaydi.
- **Route nomlari** (`/app/hisobot`, `/app/tranzaksiyalar`) — funksional yo'llar, brend emas.
- **Telegram bot username va BotFather profili** — BotFather'da qo'lda: nom, description,
  about, profil rasmi → `public/favicon-256.png`. Username o'zgarsa, ulangan xodimlar
  uziladi — avval ogohlantirish xabari yuboriladi.

Vaqtinchalik: landing va login sahifasida "Hisob-Kitob endi Balansa" izohi
(`ESKI_NOM_IZOHI`, `src/lib/brand.ts`) — **2026-09-01**da olib tashlanadi.

Domen: eski domen ishlayotgan bo'lsa `balansa.uz` ga 301 redirect.
`NEXT_PUBLIC_APP_URL` o'rnatilmasa `https://balansa.uz` ishlatiladi.
