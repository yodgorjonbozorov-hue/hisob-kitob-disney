# ISHGA TUSHIRISH — to'liq launch yo'riqnomasi

Kod tomonidan tizim tayyor: Faza 0–6 tugagan, 37 test to'plami (417+ test),
hammasi `main` da. Bu hujjat qolgan **operatsion** qadamlarni bitta joyga
jamlaydi — ularni faqat loyiha egasi bajara oladi (Turso/Vercel/registrator
hisoblariga kirish kerak). Tartib muhim: yuqoridan pastga.

Batafsil manbalar: `docs/MIGRATSIYA.md` (ko'chirish), `TELEFONDAN-APPLY.md`
(telefondan migratsiya), `docs/POSTGRES-KOCHISH.md` (keyingi bosqich).

---

## Hozirgi holat (2026-08-11)

| Nima | Holat |
|---|---|
| Kod (Faza 0–6, ERP modullari) | ✅ `main` da, build va testlar toza |
| 27 migratsiya (14 eski + 13 yangi) | ✅ deploy orqali qo'llangan |
| `kassa:migratsiya` | ✅ build zanjirida, avtomatik ishlaydi |
| Deploy oldidan avtomatik zaxira | ✅ `deploy-zaxira.mjs` build zanjirida |
| Turso region | ⏳ Tokio — **Frankfurtga ko'chirilishi kerak** |
| Vercel funksiya regioni | ⏳ iad1 (AQSh) — **fra1 qilinishi kerak** |
| balansa.uz domeni | ⏳ ulanmagan |
| GitHub Actions "Migratsiya qo'llash" | ⚠️ 2026-08-06 da yiqilgan — sekretlar qo'yilmagan edi. Endi **shart emas** (deploy o'zi zaxira + migratsiya qiladi). 1-qadamda sekretlar qo'yilgach bu ham ishlaydigan bo'ladi. |
| GitHub Actions "To'liq ishga tushirish" | ✅ tayyor — baza + ko'chirish + Vercel + tekshiruv, **bitta tugma** (2-qadam) |
| GitHub Actions "Bazani ko'chirish" | ✅ tayyor — faqat ma'lumot ko'chirish (3-qadam, zaxira yo'l) |

---

## 0-qadam · Holatni tekshirib oling (5 daqiqa)

Turso konsolida (faqat o'qish, hech narsa o'zgartirmaydi):

```sql
-- 27 chiqishi kerak
SELECT COUNT(*) FROM _applied_migrations;

-- 0 chiqishi kerak (kassa skripti hammasini bog'lagan)
SELECT COUNT(*) FROM "Transaction"
WHERE accountId IS NULL AND deletedAt IS NULL;

-- Har biznesda kamida bitta kassa bo'lishi kerak
SELECT businessId, COUNT(*) FROM "Account" GROUP BY businessId;
```

Vercel env tekshiruvi (Settings → Environment Variables):

| Env | Nima uchun |
|---|---|
| `CRON_SECRET` | yo'q bo'lsa cron 503 qaytaradi (ataylab) |
| `TELEGRAM_WEBHOOK_SECRET` | yo'q bo'lsa webhook 503 (ataylab) |
| `BACKUP_CHAT_ID`, `BACKUP_BOT_TOKEN` | kunlik zaxira Telegramga — **qo'yilmasa zaxira YO'Q** |
| `NEXT_PUBLIC_APP_URL` | domen ulangach `https://balansa.uz` |

---

## 1-qadam · Sekretlarni bir marta sozlash (5–10 daqiqa, telefondan ham bo'ladi)

Ikkita token yaratasiz (buni faqat siz qila olasiz — hisoblar sizniki):

1. **Turso:** dashboard → Account → **API Tokens** → yangi token.
2. **Vercel:** Account Settings → **Tokens** → yangi token.

Keyin GitHub → repo → Settings → Secrets and variables → Actions →
New repository secret — to'rtta sekret:

| Sekret | Qiymat |
|---|---|
| `DATABASE_URL` | eski (hozirgi) baza — Vercel env'dan ko'chiring |
| `DATABASE_AUTH_TOKEN` | eski baza tokeni — Vercel env'dan |
| `TURSO_API_TOKEN` | 1-banddagi Turso tokeni |
| `VERCEL_TOKEN` | 2-banddagi Vercel tokeni |

(Turso'da bittadan ortiq tashkilot yoki Vercel'da bittadan ortiq loyiha
bo'lsa qo'shimcha `TURSO_ORG` / `VERCEL_PROJECT_NAME` sekretlarini ham
qo'ying — workflow qaysi biri ekanini o'zi so'rab aytadi.)

---

## 2-qadam · Hammasi — BITTA TUGMA

**GitHub → Actions → "To'liq ishga tushirish" → Run workflow → tasdiq: `HA` → Run**

Workflow o'zi qiladi va har qadamda o'zini tekshiradi:

1. Turso'da **Frankfurt** guruhida yangi baza yaratadi;
2. ma'lumotni ko'chiradi: zaxira → 27 migratsiya → tiklash → **ikkala
   jonli bazani jadval-bajadval va pul summalari bo'yicha solishtirish**
   → FK yaxlitligi (bironta so'm farq qilsa to'xtaydi);
3. Vercel'da `DATABASE_URL`/`DATABASE_AUTH_TOKEN` ni yangisiga almashtiradi;
4. funksiya regionini `fra1` qiladi;
5. saytni qayta deploy qilib, tayyor bo'lishini kutadi va tekshiradi;
6. tekshiruv yiqilsa — env'ni **eski qiymatlarga o'zi qaytaradi**
   (avtomatik rollback): sayt eski bazada ishlashda davom etadi.

Kafolatlar: eski bazaga **faqat o'qish** bilan tegiladi; zaxira fayli
artefakt sifatida 30 kun saqlanadi; workflow yiqilsa ham ma'lumot
yo'qolmaydi va sayt to'xtamaydi.

> Kechqurun, mijozlar yozmayotgan paytda bosing: workflow davomida (~5–10
> daqiqa) kiritilgan yangi yozuvlar eski bazada qolib ketadi.

**Workflow yashil bo'lgach sizdan bitta narsa:** saytga kirib login,
dashboard raqamlari va bitta kirim qo'shilishini ko'zdan kechiring.
Eski bazani kamida **2 hafta** o'chirmang (orqaga yo'l).

---

## 3-qadam (zaxira yo'l) · Qo'lda, bosqichma-bosqich

2-qadam biror sababdan ishlamasa — xuddi shu ishni ikki bo'lakda qilish
mumkin: Actions'dagi **"Bazani ko'chirish"** workflow'i faqat ma'lumotni
ko'chiradi (sekretlarga `YANGI_DATABASE_URL`/`YANGI_DATABASE_AUTH_TOKEN`
qo'shiladi), keyin Vercel'da qo'lda: Environment Variables almashtirish →
Functions → Function Region → `fra1` → Redeploy.

Terminaldan bo'lsa: `npm run kochirish` (faqat ma'lumot) yoki
`npm run launch` (to'liq oqim) — workflow'lar ham aynan shularni chaqiradi.

---

> ⚠️ Qo'lda yo'lda ham region almashtirishni bazadan OLDIN qilmang:
> funksiya Frankfurtda, baza Tokioda qolsa sayt hozirgidan ham
> sekinlashadi. ("To'liq ishga tushirish" workflow'i tartibni o'zi saqlaydi.)

---

## 4-qadam · Natijani o'lchang

Brauzer konsolida:

```js
const t = performance.now();
const r = await fetch('/app', { cache: 'no-store' });
console.log(Math.round(performance.now() - t), r.headers.get('x-vercel-id'));
```

`x-vercel-id` ichida `fra1` chiqishi kerak. Oldingi/keyingi raqamni yozib
qo'ying — farq mijozlarga ko'rsatiladigan natija.

---

## 5-qadam · balansa.uz domeni

1. `.uz` domenni akkreditlangan registratordan oling (cctld.uz ro'yxati).
   Imlo bitta `s` bilan: **balansa.uz**.
2. Vercel → Settings → Domains → `balansa.uz` va `www.balansa.uz`,
   registratorda DNS yozuvlarini qo'ying.
3. Eski `*.vercel.app` manzilini O'CHIRMANG — 301 redirect qo'ying
   (bookmark va botdagi eski havolalar ishlashda davom etadi).
4. Env: `NEXT_PUBLIC_APP_URL=https://balansa.uz`.
5. BotFather: bot nomi, tavsifi va rasmi (`public/favicon-256.png`).

---

## 6-qadam · Jonli tekshiruv ro'yxati

Modul tekshiruvlari (PRO tarifdagi biznesda, Sozlamalar → Modullar):

- [ ] Login: OWNER, CASHIER, SELLER — uchchala rol kiradi
- [ ] Dashboard raqamlari ko'chishdan oldingi bilan bir xil
- [ ] Yozuv o'chirilsa dashboard va ro'yxat BIR XIL summani ko'rsatadi
- [ ] Kirim qo'shilgach dashboard darhol yangilanadi
- [ ] Ikki kassali biznes: plastik sotuv plastik kassaga tushadi
- [ ] Sotuv bekor qilinsa qoldiq qaytadi, kirim yo'qoladi
- [ ] Kechagi sanada kiritilgan sotuv kechagi hisobotda
- [ ] Chek PDF 80 mm termal printerda to'g'ri chiqadi
- [ ] CSV import: oldindan ko'rish → yozish oqimi ishlaydi
- [ ] Xarid: ta'minotchi → buyurtma → qabul → qoldiq va chiqim to'g'ri
- [ ] Tasdiqlash: chegaradan katta chiqim so'rovga aylanadi, Telegramda
      tugmali xabar keladi, tasdiq/rad ishlaydi
- [ ] Mijoz kartochkasi: qarz limiti oshsa qarzga sotuv rad etiladi
- [ ] Kassir hisobida boshqaruvchi modullari KO'RINMAYDI
- [ ] Bot: /kirim, /chiqim, /sotish oqimlari boshdan-oxir ishlaydi
- [ ] Cron qo'lda chaqirilganda zaxira Telegramga tushadi
- [ ] `securityheaders.com` da A baho; konsolda CSP report-only
      ogohlantirishlari toza bo'lsa CSP'ni majburiy rejimga o'tkazing

---

## 7-qadam (ixtiyoriy, keyinroq) · PostgreSQL

Faza 5.1 kodi tayyor va haqiqiy PostgreSQL 16 da sinalgan, lekin ko'chirish
staging talab qiladi. Frankfurt ko'chishi tezlik muammosini yechgach
shoshilinch emas. Tartib va tuzoqlari: `docs/POSTGRES-KOCHISH.md`.
