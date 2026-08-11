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
| GitHub Actions "Migratsiya qo'llash" | ⚠️ 2026-08-06 da yiqilgan — sekretlar qo'yilmagan edi. Endi **shart emas** (deploy o'zi zaxira + migratsiya qiladi). Xohlasangiz `DATABASE_URL` va `DATABASE_AUTH_TOKEN` sekretlarini qo'yib, zaxira-artefakt yo'lini ham tiklaysiz. |

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

## 1-qadam · Zaxira

```bash
npm run backup   # production env bilan
```

yoki cron'ni qo'lda bir marta chaqirib, zaxira Telegram kanaliga
(`@balansauzmalumotlar`) tushganini ko'ring. **Zaxirasiz 2-qadamga o'tmang.**

---

## 2-qadam · Turso'ni Frankfurtga (tezlikning asosiy davosi)

Toshkent → Frankfurt ≈ 100 ms; hozirgi AQSh ↔ Tokio yo'li har SQL uchun
~160 ms yeydi. Downtime 3–4 daqiqa — kechqurun qiling.

1. `npm run backup` (production env bilan).
2. Turso'da `fra` regionida yangi baza yarating.
3. Yangi bazaga migratsiya: `npm run db:apply` (yangi `DATABASE_URL` bilan).
4. `npm run restore -- prisma/backups/<fayl>.json --confirm` — sonlar
   avtomatik solishtiriladi.
5. Vercel env'da `DATABASE_URL`/`DATABASE_AUTH_TOKEN` ni yangisiga
   almashtiring → Redeploy.
6. Sayt tekshiruvi: login, dashboard, bitta kirim.

**Rollback:** eski Tokio bazasini kamida 2 hafta o'chirmang — muammo bo'lsa
env'ni qaytarib redeploy qilasiz (2 daqiqa).

---

## 3-qadam · Vercel funksiya regionini fra1

Project → Settings → Functions → Function Region → `fra1`.

> ⚠️ Bu qadamni 2-qadamdan OLDIN qilmang: funksiya Frankfurtda, baza Tokioda
> qolsa sayt hozirgidan ham sekinlashadi.

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
