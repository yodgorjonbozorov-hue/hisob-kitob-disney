# Telefondan migratsiya qo'llash

Kompyuter kerak emas. Uch yo'l bor — birinchisi tavsiya etiladi.

---

## 1. GitHub Actions (tavsiya etiladi) ✅

**Nega bu yo'l:** avval zaxira olinadi va u 30 kun saqlanadi. Boshqa
yo'llarda zaxira yo'q.

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

## 2. Vercel'ga deploy qilish

`package.json` dagi `build` buyrug'i migratsiyalarni **avtomatik**
qo'llaydi:

```
build: db-migrate.mjs && kassa-migratsiya.ts && bootstrap-superadmin.mjs && next build
```

Ya'ni branch'ni merge qilsangiz yoki Vercel'da "Redeploy" bossangiz,
migratsiyalar va kassa migratsiyasi o'zi bajariladi.

**⚠️ Kamchiligi: zaxira olinmaydi.** Shuning uchun bu yo'l kichik
o'zgarishlar uchun. Katta migratsiyada (masalan hozirgi 13 ta) avval
1-yo'l bilan zaxira oling.

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

1. Ilovani qayta deploy qiling (agar 1-yo'lni ishlatgan bo'lsangiz)
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
