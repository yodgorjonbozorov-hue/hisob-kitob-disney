# Disney Navoiy — Kirim-Chiqim Hisob-Kitob Tizimi

"Disney Navoiy" kompaniyasi (animatsiya, o'yinchoqlar, dekoratsiya, hovli bezaklari, sveta-musiqa xizmatlari) uchun kirim-chiqim hisobini yuritish va oy oxirida direktor uchun avtomatik hisobot tayyorlash veb-ilovasi.

## Texnologiyalar

- **Frontend/Backend**: Next.js 14 (App Router) + React + TypeScript + TailwindCSS
- **Ma'lumotlar bazasi**: SQLite-mos (Prisma + `@libsql/client` driver adapter) — lokalda fayl, production'da [Turso](https://turso.tech) (bulutli, bepul tarif)
- **Grafiklar**: Recharts
- **Autentifikatsiya**: custom sessiya (`iron-session` + shifrlangan httpOnly cookie), parollar `bcryptjs` bilan hash qilinadi
- **Eksport**: `@react-pdf/renderer` (PDF), `exceljs` (Excel)
- **Telegram bot**: `grammy` — lokalda long polling (`npm run bot`), production'da webhook (`/api/telegram/webhook`)

## Talablar

- Node.js 18+ (tavsiya etiladi: 20 yoki undan yuqori)
- npm

## O'rnatish

```bash
npm install
```

**Windows'da qiyinchilik yuzaga kelsa**: ba'zi Windows muhitlarida (antivirus/Application Control siyosati) `npm install` `esbuild`/`@prisma/engines` kabi paketlarni o'rnatishda `EBUSY` yoki fayl bloklanishi xatosini berishi mumkin. Bunday holda `pnpm` bilan o'rnating:

```bash
npm install -g pnpm
pnpm install
```

Loyihaning barcha skriptlari (`npm run dev`, `npm run bot`, va h.k.) `node`/`ts-node` orqali ishlaydi va `esbuild`ga bog'liq emas — shuning uchun faqat o'rnatish bosqichida muammo chiqishi mumkin, keyingi ishga tushirishlarga ta'sir qilmaydi.

## Muhit sozlamalari

Loyiha ildizida `.env` fayli quyidagicha bo'lishi kerak (`.env.example`dan nusxa olishingiz mumkin):

```
DATABASE_URL="file:./prisma/dev.db"
DATABASE_AUTH_TOKEN=""
SESSION_SECRET="kamida-32-belgidan-iborat-tasodifiy-maxfiy-satr"
TELEGRAM_BOT_TOKEN="@BotFather'dan olingan token"
TELEGRAM_BOT_USERNAME="bot_username (ixtiyoriy, ulanish yo'riqnomasida ko'rsatiladi)"
```

Lokal ishlashda `DATABASE_AUTH_TOKEN` bo'sh qoldirilishi mumkin (fayl-based SQLite token talab qilmaydi). Production (Turso) uchun quyidagi "Production'ga deploy qilish" bo'limiga qarang.

`SESSION_SECRET` — sessiya cookie'sini shifrlash uchun ishlatiladi, production'da albatta o'zgartiring va hech kimga oshkor qilmang. `TELEGRAM_BOT_TOKEN` ham maxfiy qiymat — uni hech qachon ochiq chatda yoki kodga qattiq yozib qo'ymang, faqat `.env` faylida saqlang (`.env` `.gitignore`ga kiritilgan).

## Migratsiya va boshlang'ich ma'lumotlar (seed)

Migratsiyalar `@libsql/client` orqali qo'llanadi (Prisma `migrate deploy` libsql:// protokolini qo'llab-quvvatlamaydi). Lokal (fayl) va Turso (bulut) uchun bir xil buyruq:

```bash
npm run db:apply    # prisma/migrations/* SQL fayllarini bazaga qo'llaydi (idempotent)
npm run db:seed     # bizneslar (Disney Navoiy + Salyut), Disney kategoriyalari, admin/kassir1
```

> Yangi migratsiya yaratish uchun (schema o'zgartirilganda): `npm run db:migrate:create -- --name <nom>` — bu faqat SQL faylini generatsiya qiladi, so'ng `npm run db:apply` bilan qo'llaysiz.

## Ishga tushirish

```bash
npm run dev
```

Brauzerda [http://localhost:3000](http://localhost:3000) manzilini oching.

## Standart login ma'lumotlari

Seed skripti quyidagi foydalanuvchilarni yaratadi:

| Rol | Login | Parol |
|---|---|---|
| Direktor (admin) | `admin` | `admin123` |
| Kassir | `kassir1` | `kassir123` |

**Muhim**: birinchi kirishdan so'ng parollarni albatta o'zgartiring (Admin panel → Foydalanuvchilar bo'limida yangi parol o'rnatish mumkin).

## Ko'p-biznes (multi-business)

Tizim bir nechta alohida biznesni bitta saytda yuritadi (masalan Disney Navoiy, Salyut, ...). Har bir biznesning **o'z alohida** hisob-kitobi bor: kategoriyalari, tranzaksiyalari, dashboard'i (0 dan boshlanadi) va oylik hisoboti.

- **Direktor (admin)** barcha bizneslarni ko'radi va yon menyudagi dropdown orqali ular orasida almashadi (tanlov cookie'da saqlanadi).
- **Kassir** bitta biznesga biriktiriladi — faqat o'z biznesini ko'radi/yozadi, boshqasiga o'ta olmaydi.
- Yangi biznes **Admin panel → Bizneslar** bo'limidan qo'shiladi; bo'sh (kategoriyasiz) boshlanadi, admin o'ziga mos kategoriyalarni qo'shadi.
- Barcha ma'lumotlar biznes bo'yicha izolyatsiya qilingan — bir biznes ma'lumoti boshqasida ko'rinmaydi (server darajasida `businessId` filtri, cross-business kirish imkonsiz).

## Funksiyalar

- Tranzaksiya kiritish (kirim/chiqim), filtrlash, qidirish, tahrirlash va o'chirish (kassir faqat o'zi kiritgan yozuvni o'zgartira oladi)
- Boshqaruv paneli: joriy oy bo'yicha jami kirim/chiqim/sof foyda, kategoriya bo'yicha doira diagrammalar, 6 oylik trend, kunlik dinamika
- Oylik hisobot: kategoriya bo'yicha taqsimot, o'tgan oy bilan solishtirma, PDF va Excel formatda yuklab olish
- Admin panel: bizneslar, kategoriyalar va foydalanuvchilarni boshqarish
- Telegram bot: tezkor tranzaksiya kiritish (admin uchun biznes tanlash), hisobot olish, direktorga avtomatik oylik hisobot (har biznes uchun alohida)

## Telegram bot

Bot alohida process sifatida ishlaydi (veb-serverdan mustaqil):

```bash
npm run bot
```

### Botga ulanish

1. Veb-saytga kiring (login/parol bilan).
2. Chap menyudagi (yoki mobil menyudagi) **"Telegram bot bilan bog'lash"** tugmasini bosing — 10 daqiqa amal qiladigan 6 xonali kod ko'rsatiladi.
3. Telegram'da botni toping va `/kod 123456` (o'z kodingiz bilan) yuboring.
4. Muvaffaqiyatli bog'langandan so'ng bot orqali quyidagi buyruqlardan foydalanish mumkin:
   - `/kirim` — kirim tranzaksiyasini bosqichma-bosqich kiritish (kategoriya → summa → sana → izoh)
   - `/chiqim` — chiqim tranzaksiyasini kiritish
   - `/hisobot` — joriy oy bo'yicha qisqa hisobot va PDF/Excel yuklab olish tugmalari
   - `/bekor` — joriy suhbat/amalni bekor qilish

Har bir Telegram chat faqat bitta tizim foydalanuvchisiga bog'lanadi (parol Telegram orqali hech qachon yuborilmaydi — faqat bir martalik kod orqali bog'lanadi).

### Avtomatik oylik hisobot

Bot ishga tushirilgan holda qolsa, har oyning 1-sanasida (server vaqti bo'yicha) o'tgan oy uchun to'liq hisobot (PDF) barcha Telegram'ga ulangan direktor (admin) foydalanuvchilarga avtomatik yuboriladi. Bot buni har soatda tekshirib turadi va bir oy uchun faqat bir marta yuboradi (`AppSetting` jadvalida belgilanadi).

## Production'ga deploy qilish (bepul: Vercel + Turso)

Lokal fayl-based SQLite va uzluksiz bot jarayoni serverless hostingda (Vercel) ishlamaydi, shuning uchun production uchun ikkita almashtirish qilinadi: baza → Turso (bulutli, SQLite-mos), bot → webhook (Vercel'ning o'zida, alohida server shart emas).

### 1. Turso'da baza yaratish

```bash
npm install -g @turso/cli   # yoki https://docs.turso.tech/cli/installation
turso auth login
turso db create disney-navoiy
turso db show disney-navoiy --url        # DATABASE_URL
turso db tokens create disney-navoiy     # DATABASE_AUTH_TOKEN
```

Olingan ikkita qiymatni keyingi bosqichda Vercel muhit o'zgaruvchilariga qo'shasiz. Bazani sxema bilan to'ldirish uchun (bir marta, lokal terminaldan Turso qiymatlari bilan):

```bash
DATABASE_URL="libsql://..." DATABASE_AUTH_TOKEN="..." npx prisma migrate deploy
DATABASE_URL="libsql://..." DATABASE_AUTH_TOKEN="..." npm run db:seed
```

### 2. GitHub'ga joylashtirish

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <GitHub repo URL>
git push -u origin main
```

### 3. Vercel'da loyiha yaratish

[vercel.com](https://vercel.com) → "New Project" → GitHub repo'ni tanlang → "Environment Variables" bo'limiga quyidagilarni qo'shing:

| Nomi | Qiymati |
|---|---|
| `DATABASE_URL` | Turso `libsql://...` manzili |
| `DATABASE_AUTH_TOKEN` | Turso tokeni |
| `SESSION_SECRET` | tasodifiy, kamida 32 belgi |
| `TELEGRAM_BOT_TOKEN` | @BotFather tokeni |
| `TELEGRAM_BOT_USERNAME` | bot username |
| `TELEGRAM_WEBHOOK_SECRET` | o'zingiz o'ylab topgan maxfiy satr |
| `CRON_SECRET` | o'zingiz o'ylab topgan maxfiy satr |

"Deploy" tugmasini bosing.

### 4. Telegram webhookni ro'yxatdan o'tkazish (bir marta)

Deploy tugagach, brauzerda quyidagi manzilni oching (o'z qiymatlaringiz bilan):

```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<domeningiz>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

`{"ok":true,"result":true,...}` javobi kelsa — bot ishga tushdi. Endi bot uzluksiz jarayonsiz, faqat Telegram xabar yuborganda ishlaydi.

### 5. Vercel Cron

`vercel.json` allaqachon loyihada mavjud — Vercel avtomatik ravishda `/api/cron/monthly-report` route'ini kuniga bir marta chaqiradi (Vercel loyiha sozlamalarida "Cron Jobs" bo'limida ko'rinadi). Alohida sozlash shart emas.

## Kelajakdagi ishlar (v1'da qasddan kiritilmagan)

- Tranzaksiyaga rasm/kvitansiya biriktirish
- Kunlik/haftalik/oylik budget (maqsad) belgilash va kuzatish
- Xodimlar bo'yicha batafsil analitika (kim qancha kiritganini alohida sahifada ko'rsatish)
