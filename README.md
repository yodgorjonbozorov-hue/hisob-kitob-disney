# Balansa — biznesingiz balansda

**Balansa** ([balansa.uz](https://balansa.uz)) — kichik va o'rta biznes uchun yagona boshqaruv platformasi:
kirim-chiqim, ombor, sotuv, qarzdorlik, CRM, vazifalar va hisobotlar bitta tizimda. Ko'p tenantli SaaS —
har kompaniya o'z ma'lumotlari bilan izolyatsiyada ishlaydi, oy oxirida direktorga avtomatik hisobot boradi.

Brend (nom, ranglar, logo, foydalanish qoidalari): [`docs/BRAND.md`](docs/BRAND.md).

> Ilova avval "Hisob-Kitob" nomi bilan bitta mijoz uchun qurilgan edi, keyin ko'p tenantli
> SaaSga o'tkazildi. `prisma/seed.ts` endi neytral demo ma'lumot yaratadi.

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
NEXT_PUBLIC_APP_URL="https://balansa.uz"

# Onlayn to'lov (ixtiyoriy — qo'yilmasa faqat "O'tkazma orqali" usuli ko'rinadi)
PAYME_MERCHANT_ID="Payme kabinetidagi merchant id"
PAYME_KEY="Payme merchant kaliti (Basic auth paroli)"
CLICK_SERVICE_ID="Click service_id"
CLICK_MERCHANT_ID="Click merchant_id"
CLICK_SECRET_KEY="Click SECRET_KEY"
```

`NEXT_PUBLIC_APP_URL` — OG-image va metadata uchun absolyut manzil. O'rnatilmasa `https://balansa.uz` ishlatiladi.

Lokal ishlashda `DATABASE_AUTH_TOKEN` bo'sh qoldirilishi mumkin (fayl-based SQLite token talab qilmaydi). Production (Turso) uchun quyidagi "Production'ga deploy qilish" bo'limiga qarang.

`SESSION_SECRET` — sessiya cookie'sini shifrlash uchun ishlatiladi, production'da albatta o'zgartiring va hech kimga oshkor qilmang. `TELEGRAM_BOT_TOKEN` ham maxfiy qiymat — uni hech qachon ochiq chatda yoki kodga qattiq yozib qo'ymang, faqat `.env` faylida saqlang (`.env` `.gitignore`ga kiritilgan).

### Onlayn to'lov (Payme / Click)

Kod ikkala provider uchun ham tayyor va **env sozlangandagina** yoqiladi — shartnoma imzolanmagan bo'lsa mijoz faqat "O'tkazma orqali" usulini ko'radi. To'lov tasdiqlangach obuna **avtomatik** uzayadi (qo'lda tasdiqlash bilan bir xil `confirmPayment` funksiyasi).

Kabinetda ko'rsatiladigan manzillar (`<domen>` — sizning domeningiz):

| Provider | Endpoint | Izoh |
| --- | --- | --- |
| Payme | `https://<domen>/api/billing/payme` | Merchant API (JSON-RPC), Basic auth `Paycom:<PAYME_KEY>` |
| Click | `https://<domen>/api/billing/click/prepare` | Prepare (action=0) |
| Click | `https://<domen>/api/billing/click/complete` | Complete (action=1) |

Tafsilotlar:

- Payme summani **tiyin**da yuboradi (199 000 so'm → 19 900 000), hisob maydoni `payment_id` (bizdagi `Payment.id`).
- Click imzosi `md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id [+ merchant_prepare_id] + amount + action + sign_time)` bo'yicha tekshiriladi; imzo mos kelmasa `-1` qaytadi.
- Takroriy so'rovlar (provider qayta yuborsa) obunani ikkinchi marta uzaytirmaydi — idempotentlik testlar bilan qoplangan (`npm run test:tolov`).
- Payme bajarilgan to'lovni bekor qilsa (`state -2`), to'lov `REFUNDED` bo'ladi va superadmin panelida ko'rinadi — obuna muddati avtomatik qisqartirilmaydi, qarorni siz qabul qilasiz.

## Migratsiya va boshlang'ich ma'lumotlar (seed)

Migratsiyalar `@libsql/client` orqali qo'llanadi (Prisma `migrate deploy` libsql:// protokolini qo'llab-quvvatlamaydi). Lokal (fayl) va Turso (bulut) uchun bir xil buyruq:

```bash
npm run db:apply    # prisma/migrations/* SQL fayllarini bazaga qo'llaydi (idempotent)
npm run db:seed     # demo tenant, 2 biznes (Demo Xizmatlar + Salyut), kategoriyalar, admin/kassir1
```

> Yangi migratsiya yaratish uchun (schema o'zgartirilganda): `npm run db:migrate:create -- --name <nom>` — bu faqat SQL faylini generatsiya qiladi, so'ng `npm run db:apply` bilan qo'llaysiz.

### SUPERADMIN paneli

Panelga (`/superadmin`) oddiy `/login` sahifasi orqali kiriladi — roli SUPERADMIN bo'lgan foydalanuvchi
avtomatik panelga o'tkaziladi. Akkauntlar:

```bash
npm run superadmin:create -- <login> <parol> [ism]   # yangi superadmin
npm run superadmin:reset                            # mavjud superadminlar ro'yxati
npm run superadmin:reset -- <login> <yangi-parol>   # parolni tiklash (parol esdan chiqqanda)
```

`superadmin:reset` faqat roli SUPERADMIN bo'lgan akkauntga ta'sir qiladi. Production uchun buyruq
Turso env (`DATABASE_URL`, `DATABASE_AUTH_TOKEN`) bilan ishga tushiriladi — masalan `npx vercel env pull`
bilan olingan fayl orqali.

#### Production'ga env orqali kirish (Turso ulanmasdan)

Agar production'da "Login yoki parol noto'g'ri" chiqsa — bazada SUPERADMIN yo'q yoki parol boshqa.
Turso'ga qo'l bilan ulanmasdan tiklash uchun Vercel → Project → Settings → Environment Variables'da
quyidagilarni qo'yib, qayta deploy qiling (build vaqtida `scripts/bootstrap-superadmin.mjs` ishlaydi):

| Env | Ma'nosi |
| --- | --- |
| `SUPERADMIN_LOGIN` | login (masalan `superadmin`) |
| `SUPERADMIN_PAROL` | parol, kamida 8 belgi |
| `SUPERADMIN_ISM` | ism (ixtiyoriy, default "Platforma egasi") |
| `SUPERADMIN_RESET` | `1` — mavjud superadmin parolini ALMASHTIRISH (parol esdan chiqqanda) |

Xulq-atvor: login topilmasa — yangi SUPERADMIN yaratiladi; mavjud bo'lsa va `SUPERADMIN_RESET` qo'yilmagan
bo'lsa — tegilmaydi; `SUPERADMIN_RESET=1` bo'lsa — parol almashtiriladi va akkaunt faollashtiriladi.
Login SUPERADMIN bo'lmagan (mijoz) foydalanuvchiga tegishli bo'lsa hech narsa o'zgarmaydi.
Konfiguratsiya bo'lmasa qadam jimgina o'tkazib yuboriladi va build to'xtamaydi.

**Kirgandan keyin `SUPERADMIN_PAROL` va `SUPERADMIN_RESET` ni Vercel'dan o'chirib tashlang** — aks holda
har deploy'da parol qayta o'rnatiladi va sir env'da saqlanib qoladi.

### Yangi mijoz (tenant) yaratish

Eng oson yo'li — **`/superadmin` paneli → "Yangi mijoz" → "+ Mijoz qo'shish"**: kompaniya nomi, login, parol,
tarif, biznes rejimi (umumiy/avto) va obuna kunlari kiritiladi; parol bir marta ekranda ko'rsatiladi.

Terminal orqali ham xuddi shu amal (bir xil servis):

```bash
npm run client:create -- --nom "AvtoBalans" --login AvtoBalans --parol "avtobalans.uz" --tarif AVTO --turi avto --kunlar 30
```

`--tarif`: STANDARD | AVTO | PRO · `--turi`: umumiy | avto · `--kunlar`: obuna kunlari (0 → 14 kunlik TRIAL).
Production'da xuddi shu buyruq Turso env (`DATABASE_URL`, `DATABASE_AUTH_TOKEN`) bilan ishlatiladi.

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

## Kirim/chiqim ko'rinuvchanligi (kim nimani ko'radi)

- **Direktor / Administrator (OWNER, ADMIN)** — aktiv biznesdagi **barcha** kirim/chiqimni ko'radi, kim kiritganidan qat'i nazar.
- **Kassir / Sotuvchi (CASHIER, SELLER)** — faqat **o'zi kiritgan** yozuvlarni ko'radi. Boshqa xodimning yozuvi unga ko'rinmaydi.

Bu qoida barcha ko'rinishlarda bir xil ishlaydi: Yozuvlar ro'yxati va undagi jamlar,
kassa bosh ekranidagi "Bugun" jami va oxirgi yozuvlar lentasi, global qidiruv,
Excel eksporti hamda kun yakunidagi "kutilgan naqd" (kassir o'z smenasi bo'yicha yakunlaydi).

Qoida bitta joyda — `src/lib/auth/visibility.ts` (`transactionScopeUserId`) — yozilgan va
server tomonda qo'llanadi; testlari: `npm run test:visibility`.

## Ko'p-biznes (multi-business)

Tizim bir nechta alohida biznesni bitta saytda yuritadi (masalan "Do'kon", "Filial-2", ...). Har bir biznesning **o'z alohida** hisob-kitobi bor: kategoriyalari, tranzaksiyalari, dashboard'i (0 dan boshlanadi) va oylik hisoboti.

- **Direktor (admin)** barcha bizneslarni ko'radi va yon menyudagi dropdown orqali ular orasida almashadi (tanlov cookie'da saqlanadi).
- **Kassir** bitta biznesga biriktiriladi — faqat o'z biznesini ko'radi/yozadi, boshqasiga o'ta olmaydi.
- Yangi biznes **Admin panel → Bizneslar** bo'limidan qo'shiladi; bo'sh (kategoriyasiz) boshlanadi, admin o'ziga mos kategoriyalarni qo'shadi.
- Barcha ma'lumotlar biznes bo'yicha izolyatsiya qilingan — bir biznes ma'lumoti boshqasida ko'rinmaydi (server darajasida `businessId` filtri, cross-business kirish imkonsiz).

## Ombor / Sotuv / Qarzdorlik (tovar sotadigan bizneslar uchun)

Biznes **omborli** bo'lsa (Admin panel → Bizneslar → biznes yaratishda yoqiladi; Salyut'da yoqilgan), qo'shimcha modul ishlaydi:

- **Ombor** (direktor): mahsulot turlari (masalan salyut turlari), har biriga **kelgan narx (tannarx)** va **sotuv narxi**, joriy qoldiq. "Ombor kirimi" bilan qoldiq oshiriladi. "Ko'p tur qo'shish" — bir nechta turni birdan kiritish. Ombor kirimi chiqim yozmaydi (tovar tannarxini direktor alohida kuzatadi).
- **Sotuv** (direktor + kassir): mahsulot tanlab sotiladi. **Naqd** → darhol kirim (daromad) yoziladi; **Qarzga** → qarzdorlik yaratiladi (daromad hali yozilmaydi — kassa usuli). Omborda yetarli bo'lmasa sotib bo'lmaydi (atomik himoya).
- **Qarzdorlik** (direktor + kassir): **ikki yo'nalishli** ro'yxat — *Menga qarzdor* (qarzga sotilgan) va *Men qarzdorman* (olingan mol/mashina uchun to'lanmagan pul), yakunda **sof holat**. To'lov qabul qilinganda summa **kirim**, o'z qarzini to'laganda **chiqim** sifatida yoziladi. Qarzni qo'lda ham qo'shish mumkin (mahsulotga bog'lash va to'lov muddati bilan).
- **Kassir ko'rinishi**: sotuv narxini ko'radi (sotish uchun), lekin **qancha qolganini ko'rmaydi** — tugagan tur "Qolmadi" deb ko'rsatiladi. Ombordagi miqdorni faqat direktor ko'radi.

### Avto rejimi (olib-sotarlar uchun)

Biznes **turi** "avto" bo'lsa (Admin panel → Bizneslar → *Avto rejim*), ombor moduli avtoparkka aylanadi:

- Bitta yozuv = **bitta mashina** (model, yil, davlat raqami, rang; qoldiq 0/1 — "Sotuvda"/"Sotildi").
- **Mashina qabul qilish**: *naqd* olinsa darhol chiqim yoziladi ("Mashina xaridi"); *qarzga* olinsa egasiga "Men qarzdorman" qarzdorligi ochiladi va chiqim to'lov paytida yoziladi (kassa usuli).
- **Mashina xarajatlari**: avtopark jadvalidagi *Xarajat* tugmasi orqali ta'mirlash / bo'yoq / yuvish / rasmiylashtirish / ehtiyot qism summasi **aynan o'sha mashinaga** yoziladi. Naqd to'langan bo'lsa "Mashina xarajati" chiqimi avtomatik yoziladi (qo'lda takror kiritish shart emas); "keyin to'lanadi" tanlansa ustaga "Men qarzdorman" qarzdorligi ochiladi.
- **Kelishilgan narx**: mashina sotilayotganda haqiqiy narx sotuv sahifasida (yoki botda) kiritiladi — rejadagi narxni oldindan tahrirlash shart emas; kiritilgan narx mashina kartochkasiga ham yoziladi.
- **Sof foyda**: har mashina bo'yicha sotilgan narx − olingan narx − **shu mashinaga qilingan xarajatlar**, hamda avtopark sahifasida umumiy yakun (sotilgan mashinalar, tushum, tannarx, xarajat, sof foyda). Sotilmagan mashinaga tikilgan xarajat avtopark qiymatiga qo'shiladi.
- Kategoriyalar avto biznesga moslangan: rasmiylashtirish (MRB, notarius), ta'mirlash, sug'urta, evakuator, maydon ijarasi va h.k.
- Tarif: **Avto — 200 000 so'm/oy** (Moliya + Avtopark modullari).

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
   - `/lead` — yangi mijoz/bitim (CRM moduli yoqilgan bo'lsa)

Avto rejimidagi kompaniyalarda direktor/administrator uchun qo'shimcha buyruqlar (bozorda turib kiritish uchun):

   - `/mashina` — avtoparkka mashina qabul qilish (model → olingan narx → sotuv narxi → naqd/qarzga)
   - `/xarajat` — mashinani tugmadan tanlab xarajat yozish (turi → summa)
   - `/sotish` — mashinani sotish: mashina → **kelishilgan narx** → naqd/qarzga; javobda sof foyda (sotuv − olingan narx − xarajatlar) darhol ko'rinadi
   - Bir qatorli tez yo'l: **`xarajat: Cobalt, ta'mirlash 2 mln`** — mashinani nomi yoki davlat raqami bo'yicha topadi, summani "2 mln / 500 ming / 2 500 000" ko'rinishida tushunadi va javobda shu mashinaning yangilangan sof foydasini qaytaradi.

Har bir Telegram chat faqat bitta tizim foydalanuvchisiga bog'lanadi (parol Telegram orqali hech qachon yuborilmaydi — faqat bir martalik kod orqali bog'lanadi).

### Avtomatik oylik hisobot

Bot ishga tushirilgan holda qolsa, har oyning 1-sanasida (server vaqti bo'yicha) o'tgan oy uchun to'liq hisobot (PDF) barcha Telegram'ga ulangan direktor (admin) foydalanuvchilarga avtomatik yuboriladi. Bot buni har soatda tekshirib turadi va bir oy uchun faqat bir marta yuboradi (`AppSetting` jadvalida belgilanadi).

## Production'ga deploy qilish (bepul: Vercel + Turso)

Lokal fayl-based SQLite va uzluksiz bot jarayoni serverless hostingda (Vercel) ishlamaydi, shuning uchun production uchun ikkita almashtirish qilinadi: baza → Turso (bulutli, SQLite-mos), bot → webhook (Vercel'ning o'zida, alohida server shart emas).

### 1. Turso'da baza yaratish

```bash
npm install -g @turso/cli   # yoki https://docs.turso.tech/cli/installation
turso auth login
turso db create balansa
turso db show balansa --url        # DATABASE_URL
turso db tokens create balansa     # DATABASE_AUTH_TOKEN
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
| `BACKUP_CHAT_ID` | kunlik zaxira yuboriladigan yopiq Telegram kanal id (qarang: [docs/MIGRATSIYA.md](docs/MIGRATSIYA.md)) |
| `BACKUP_BOT_TOKEN` | zaxira kanaliga admin qilingan **alohida** bot tokeni |

"Deploy" tugmasini bosing.

### 4. Telegram webhookni ro'yxatdan o'tkazish (bir marta)

Deploy tugagach, brauzerda quyidagi manzilni oching (o'z qiymatlaringiz bilan):

```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<domeningiz>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

`{"ok":true,"result":true,...}` javobi kelsa — bot ishga tushdi. Endi bot uzluksiz jarayonsiz, faqat Telegram xabar yuborganda ishlaydi.

### 5. Vercel Cron

`vercel.json` allaqachon loyihada mavjud — Vercel avtomatik ravishda `/api/cron/monthly-report` route'ini kuniga bir marta chaqiradi (Vercel loyiha sozlamalarida "Cron Jobs" bo'limida ko'rinadi). Alohida sozlash shart emas.

### 6. Zaxira (backup)

Kunlik cron eng birinchi ish sifatida butun bazani JSON+gzip qilib `BACKUP_CHAT_ID` kanaliga yuboradi.
Qo'lda: `npm run backup`, tiklash: `npm run restore -- <fayl.json> --confirm`.
To'liq tartib va server ko'chirish yo'riqnomasi — [docs/MIGRATSIYA.md](docs/MIGRATSIYA.md).

## Kelajakdagi ishlar (v1'da qasddan kiritilmagan)

- Tranzaksiyaga rasm/kvitansiya biriktirish
- Kunlik/haftalik/oylik budget (maqsad) belgilash va kuzatish
- Xodimlar bo'yicha batafsil analitika (kim qancha kiritganini alohida sahifada ko'rsatish)
