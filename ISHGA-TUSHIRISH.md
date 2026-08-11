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
| GitHub Actions "Bazani ko'chirish" | ✅ tayyor — Frankfurtga ko'chirish **bitta tugma** (2-qadam) |

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

## 1-qadam · Sekretlarni bir marta sozlash (5 daqiqa, telefondan ham bo'ladi)

1. Turso'da **`fra` (Frankfurt)** regionida yangi, bo'sh baza yarating —
   URL va token'ini oling.
2. GitHub → repo → Settings → Secrets and variables → Actions →
   New repository secret — to'rtta sekret:

| Sekret | Qiymat |
|---|---|
| `DATABASE_URL` | eski (hozirgi) baza — Vercel env'dan ko'chiring |
| `DATABASE_AUTH_TOKEN` | eski baza tokeni |
| `YANGI_DATABASE_URL` | yangi Frankfurt bazasi |
| `YANGI_DATABASE_AUTH_TOKEN` | yangi baza tokeni |

---

## 2-qadam · Ko'chirish — BITTA TUGMA

**GitHub → Actions → "Bazani ko'chirish" → Run workflow → tasdiq: `HA` → Run**

Workflow o'zi hammasini qiladi va har qadamda o'zini tekshiradi:
zaxira olish → yangi bazaga 27 migratsiya → tiklash → **ikkala jonli
bazani jadval-bajadval va pul summalari bo'yicha solishtirish** → FK
yaxlitligi. Bironta son mos kelmasa to'xtaydi va aniq aytadi.

Muhim kafolat: **eski bazaga faqat o'qish bilan tegiladi** — workflow
yiqilsa ham sayt avvalgidek ishlashda davom etadi, hech narsa buzilmaydi.
Zaxira fayli artefakt sifatida 30 kun saqlanadi.

(Terminaldan bo'lsa: `YANGI_DATABASE_URL=... YANGI_DATABASE_AUTH_TOKEN=...
npm run kochirish` — xuddi shu skript.)

---

## 3-qadam · Vercel'da almashtirish (~2 daqiqa, downtime shu yerda)

Workflow yashil bo'lgach:

1. Vercel → Settings → Environment Variables: `DATABASE_URL` va
   `DATABASE_AUTH_TOKEN` ni **yangi** qiymatlarga almashtiring.
2. Settings → Functions → Function Region → **`fra1`**.
3. Deployments → eng oxirgisini **Redeploy**.
4. Saytda tekshiring: login, dashboard raqamlari, bitta kirim qo'shish.

**Rollback:** eski Tokio bazasini kamida 2 hafta o'chirmang — muammo bo'lsa
env'ni qaytarib redeploy qilasiz (2 daqiqa).

> Kechqurun, mijozlar ishlamayotgan paytda qiling: workflow tugagach env
> almashtirilguncha kiritilgan yangi yozuvlar eski bazada qoladi. Xavfsiz
> yo'l — ko'chirishni mijozlar yozmayotgan paytda boshlash.

---

> ⚠️ Region almashtirishni bazadan OLDIN qilmang: funksiya Frankfurtda,
> baza Tokioda qolsa sayt hozirgidan ham sekinlashadi. Yuqoridagi tartib
> shuning uchun: avval baza (2-qadam), keyin region (3-qadam).

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
