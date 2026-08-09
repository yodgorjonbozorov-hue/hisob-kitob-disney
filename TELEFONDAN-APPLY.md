# Telefondan migratsiya qo'llash

Kompyuter kerak emas. Uch yo'l bor — birinchisi tavsiya etiladi.

---

## 1. Oddiy deploy (tavsiya etiladi) ✅

**Hech qanday sozlash kerak emas.** Branch'ni `main` ga qo'shsangiz yoki
Vercel'da "Redeploy" bossangiz, build zanjiri o'zi hamma ishni qiladi:

```
deploy-zaxira.mjs && db-migrate.mjs && kassa-migratsiya.ts && bootstrap-superadmin.mjs && next build
```

Birinchi halqa — `deploy-zaxira.mjs` — kutayotgan migratsiya bor-yo'qligini
tekshiradi:

- **yo'q bo'lsa** hech narsa qilmaydi (oddiy deploy sekinlashmaydi);
- **bor bo'lsa** bazadan xom surat olib, uni Telegram zaxira kanalingizga
  hujjat qilib yuboradi. Yuborilmasa — **build to'xtaydi va migratsiya
  umuman ishga tushmaydi**.

Ya'ni zaxirasiz migratsiya qo'llanmaydi. Zaxira o'sha kanalda turadi,
tiklash: `npm run zaxira:xom -- --tikla <fayl>` (shifr va gzip'ni skript
o'zi ochadi).

Kerak bo'lgan env: `BACKUP_CHAT_ID` va `BACKUP_BOT_TOKEN` (yoki
`TELEGRAM_BOT_TOKEN`) — kunlik zaxira uchun allaqachon sozlangan.
Qo'shimcha tavsiya: `ZAXIRA_PAROL` — qo'yilsa fayl kanalga chiqishidan
oldin AES-256 bilan shifrlanadi (ichida parol hash'lari bilan butun baza
bor). Parolni yo'qotmang — usiz shifrlangan zaxira tiklanmaydi.

---

## 2. GitHub Actions (zaxirani alohida artefakt sifatida saqlash)

**Nega kerak bo'lishi mumkin:** zaxira Telegramga emas, GitHub artefaktiga
tushadi va 30 kun saqlanadi; migratsiyani deploy'dan ajratib, xohlagan
paytda ishga tushirish mumkin.

### Bir marta sozlash (5 daqiqa)

GitHub'da repozitoriyga kiring:

**Settings → Secrets and variables → Actions → New repository secret**

Ikkita sekret qo'shing:

| Nomi | Qiymati |
|---|---|
| `DATABASE_URL` | Turso bazangiz manzili (`libsql://...`) |
| `DATABASE_AUTH_TOKEN` | Turso tokeni |

> Qiymatlarni Vercel loyihangizning Environment Variables bo'limidan
> ko'chirib oling — o'sha ikkitasi.

### Har safar ishlatish

GitHub mobil ilovasida (yoki telefon brauzerida):

1. Repozitoriy → **Actions**
2. Chapdan **"Migratsiya qo'llash"**
3. **"Run workflow"** tugmasi
4. `tasdiq` maydoniga **`HA`** deb yozing
5. **Run workflow**

Bir necha daqiqada tugaydi. Natijani o'sha yerda ko'rasiz:
- ✅ bo'lsa — tugadi, zaxira artefaktda
- ❌ bo'lsa — log'da xato sababi va yechimi yozilgan, **baza o'zgarmagan**
  (skript fail-fast)

**Faqat zaxira olmoqchi bo'lsangiz:** `faqat_zaxira` katagini belgilang —
migratsiyaga tegilmaydi.

---

## 3. Turso konsoli (faqat tekshirish uchun)

`turso.tech` saytiga telefondan kirib SQL yozish mumkin. Migratsiya
qo'llash uchun **tavsiya etilmaydi** — 13 ta faylni qo'lda ko'chirish
xatoga olib keladi. Lekin tekshirish uchun qulay:

```sql
-- Qaysi migratsiyalar qo'llangan?
SELECT name FROM _applied_migrations ORDER BY name;

-- Kassasiz tranzaksiya qoldimi? (0 bo'lishi kerak)
SELECT COUNT(*) FROM "Transaction" WHERE "accountId" IS NULL;

-- Yangi jadvallar joyidami?
SELECT name FROM sqlite_master WHERE type='table' AND name IN
  ('Account','Supplier','ApprovalRule','Employee','Contract','Attachment');
```

---

## Migratsiyadan keyin

1. Ilovani qayta deploy qiling (agar 2-yo'lni ishlatgan bo'lsangiz)
2. **Sozlamalar → Modullar** bo'limida yangi modullarni yoqing (PRO tarif):
   XARID, TASDIQLASH, MIJOZLAR, Xodimlar (HR), HUJJATLAR
3. `PROGRESS-AGENT.md` dagi har modul tekshiruv ro'yxatidan o'ting

---

## Nimadir noto'g'ri ketsa

Skript **fail-fast**: birinchi xatoda to'xtaydi va keyingi qadamlarni
bajarmaydi. Ya'ni yarim qo'llangan baza qolmaydi.

Zaxira 1-yo'lda artefakt sifatida saqlanadi (30 kun). Uni yuklab olib
tiklash:

```bash
npm run zaxira:xom -- --tikla <fayl>.json
```

Eng ko'p uchraydigan xato — **"Migratsiya hisoboti baza holatiga mos
kelmaydi"**. Sababi: baza `db-migrate.mjs` dan boshqa yo'l bilan
qurilgan. Log'da yechim ko'rsatiladi:

```bash
npm run migratsiya:belgila -- --royxat          # nomlarni ko'rish
npm run migratsiya:belgila -- <nom> --tasdiq    # belgilash
```

Bu SQL bajarmaydi — faqat allaqachon qo'llangan migratsiyalarni hisobotda
belgilaydi.
