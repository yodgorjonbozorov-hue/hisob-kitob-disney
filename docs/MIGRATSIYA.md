# Domen, tezlik va server ko'chirish

Bu hujjat uchta ishni qamrab oladi: **balansa.uz domenini ulash**, **saytni tezlashtirish**,
**mijoz ma'lumotlarini yo'qotmaslik**. Tartib muhim — yuqoridan pastga bajariladi.

---

## 0. Sekinlikning haqiqiy sababi (2026-08-03 o'lchandi)

`x-vercel-id: hkg1::iad1::…` javob sarlavhasi ko'rsatdi:

| Bo'lak | Joylashuv | Natija |
|---|---|---|
| Next.js funksiyalari (SSR) | **iad1 — Washington, AQSh** | foydalanuvchi (Navoiy) → AQSh ≈ 250–300 ms |
| Turso baza | **Tokio** (aws-ap-northeast-1) | har bir SQL uchun AQSh ↔ Tokio ≈ 160 ms |
| Foydalanuvchilar | O'zbekiston | — |

Dashboard ochilishida ~4 qatlam ketma-ket so'rov bor (sessiya → obuna guard → biznes → hisob-kitoblar),
ya'ni **faqat baza kutish ≈ 0.6–0.8 s**, ustiga okean orqasidagi yo'l va cold start.

> **Xulosa:** muammo "bepul tarif" emas, **geografiya**. Pullik serverga o'tish o'zi buni yechmaydi —
> agar yangi server ham noto'g'ri joyda bo'lsa, sekinlik qoladi.

---

## 1. Zaxira — hamma narsadan OLDIN

Domen yoki server bilan bog'liq bironta amalni zaxirasiz boshlamang.

```bash
npm run backup
```

Production zaxirasi uchun production env (`DATABASE_URL`, `DATABASE_AUTH_TOKEN`) bilan ishga tushiring.
Fayl `prisma/backups/` ichiga tushadi (git'ga tushmaydi — mijoz ma'lumoti).

### Kunlik avtomatik zaxira

Kunlik cron (`/api/cron/monthly-report`, 03:00) endi **eng birinchi ish sifatida** butun bazani
JSON+gzip qilib Telegramga hujjat sifatida yuboradi. Yoqish uchun bitta env kerak:

| Env | Qiymat |
|---|---|
| `BACKUP_CHAT_ID` | zaxira yuboriladigan **shaxsiy** Telegram kanal/chat id |

Kanalni yopiq qiling va botni admin qiling. Env yo'q bo'lsa zaxira jim o'tkazib yuboriladi
(cron yiqilmaydi), lekin logda ogohlantirish chiqadi — ya'ni **env qo'yilmasa zaxira YO'Q**.

### Tiklash (va uni sinab ko'rish)

```bash
npm run restore -- prisma/backups/<fayl>.json --confirm
```

Standart holatda faqat **bo'sh** bazaga tiklaydi; ustiga yozish uchun `--force` ochiq talab qilinadi.
Tiklashdan keyin skript har jadval bo'yicha yozuvlar sonini solishtiradi va mos kelmasa xato bilan to'xtaydi.

`npm run test:backup` — dump → JSON → **boshqa bazaga** to'liq tiklash round-trip testi (5 test).
Bu aynan quyidagi ko'chirish stsenariysining o'zi, shuning uchun ko'chirishdan oldin bir marta ishga tushiring.

---

## 2. Tezlik: Frankfurtga ko'chirish (tekin, ~1–2 soat)

Toshkent → Frankfurt ≈ 100 ms, Toshkent → Washington ≈ 280 ms. Baza va funksiya bir regionda bo'lsa,
ular orasidagi 160 ms butunlay yo'qoladi.

> ⚠️ **TARTIB MUHIM.** Avval baza, keyin funksiya. Agar funksiyani Frankfurtga o'tkazib, baza
> Tokioda qolsa, **sayt hozirgidan ham sekinlashadi** (fra1 → Tokio ≈ 230 ms, iad1 → Tokio ≈ 160 ms).

### 2.1. Turso bazasini Frankfurtga

Ma'lumot hajmi kichik (~350 tranzaksiya), shuning uchun eng ishonchli yo'l — yangi baza + tiklash:

1. `npm run backup` (production env bilan) — zaxira olinadi.
2. Turso'da Frankfurt (`fra`) da yangi baza yaratiladi.
3. Yangi baza migratsiya qilinadi: `npm run db:apply` (yangi `DATABASE_URL`/`DATABASE_AUTH_TOKEN` bilan).
4. `npm run restore -- <zaxira.json> --confirm` — yangi bazaga tiklanadi, sonlar solishtiriladi.
5. Vercel env'dagi `DATABASE_URL`/`DATABASE_AUTH_TOKEN` yangisiga almashtiriladi, redeploy.
6. Sayt tekshiriladi (login, dashboard, bitta kirim qo'shish).

**Downtime:** 3–4 daqiqa (4-qadamdan 5-qadamgacha). Kechqurun, mijozlar ishlamayotgan vaqtda qiling.

**Rollback:** eski Turso bazasi o'chirilmaydi — muammo chiqsa Vercel env'ni eski qiymatga qaytarib
redeploy qilinadi, 2 daqiqada eski holatga qaytadi. Eski bazani kamida **2 hafta** saqlang.

### 2.2. Vercel funksiya regionini Frankfurtga

Ikki yo'ldan biri:

- **Vercel loyiha sozlamasi** (tavsiya): Project → Settings → Functions → Function Region → `fra1`.
  Bitta joydan barcha funksiyalarga tegadi.
- **Kodda**: `src/app/layout.tsx` ga `export const preferredRegion = "fra1";` qo'shish.
  Repoda qoladi, lekin har segment uchun tekshirish kerak.

### 2.3. Natijani tasdiqlash

Brauzer konsolida:

```js
const t = performance.now();
const r = await fetch('/app', { cache: 'no-store' });
console.log(Math.round(performance.now() - t), r.headers.get('x-vercel-id'));
```

`x-vercel-id` ichida `fra1` chiqishi kerak. Ko'chirishdan oldingi va keyingi raqamni yozib qo'ying —
mijozga aynan shu farqni ko'rsatasiz.

---

## 3. Domen: balansa.uz

Imlo **bitta `s` bilan** — `balansa.uz` (kodda `src/lib/brand.ts` da shunday).

1. `.uz` domen akkreditlangan registrator orqali olinadi (cctld.uz ro'yxati).
2. Vercel → Project → Settings → Domains → `balansa.uz` va `www.balansa.uz` qo'shiladi,
   registratorda ko'rsatilgan DNS yozuvlari qo'yiladi.
3. Eski `hisob-kitob-disneyn1.vercel.app` **o'chirilmaydi** — undan `balansa.uz` ga 301 redirect
   qo'yiladi (mijozlarning bookmark'lari va Telegram botdagi eski havolalar ishlashda davom etadi).
4. Env: `NEXT_PUBLIC_APP_URL=https://balansa.uz` (Vercel'da ham, `.env`/`.env.example` da ham).
   Bu qo'yilmasa `BRAND.url` standart `https://balansa.uz` ga tushadi — ya'ni sayt ishlaydi,
   lekin lokal/preview muhitlarda havolalar production'ga ketadi.
5. BotFather: bot nomi/description va rasm (`public/favicon-256.png`) yangilanadi.

---

## 4. Agar Frankfurt ham yetmasa: Toshkent VPS

2-bosqichdan keyin o'lchang. Agar hali sekin bo'lsa (masalan mobil internet ustida), keyingi qadam —
O'zbekistondagi VPS (ps.uz, ahost.uz, Uzinfocom): foydalanuvchiga **5–20 ms**, oyiga ~$10–25.

Nima o'zgaradi:

| | Vercel + Turso (Frankfurt) | Toshkent VPS |
|---|---|---|
| Latensiya | ~100 ms | ~5–20 ms |
| Deploy | `git push` — avtomatik | o'zimiz sozlaymiz (CI yoki qo'lda) |
| SSL, nginx, monitoring | Vercel qiladi | **bizning javobgarligimiz** |
| Baza | Turso boshqaradi | SQLite fayl serverda (app bilan bir joyda — 0 ms) yoki Postgres |
| Zaxira | shu hujjatdagi cron | **shu hujjatdagi cron ishlashda davom etadi** |
| Server yiqilsa | Vercel ko'taradi | biz ko'taramiz |

VPS'ga o'tishda ko'chirish tartibi 2.1 bilan bir xil: `backup` → yangi bazani `db:apply` → `restore` →
env almashtirish. Zaxira/tiklash skriptlari ikkala holatda ham ishlaydi.

---

## 5. Tekshiruv ro'yxati (har ko'chishdan keyin)

- [ ] Login ishlaydi (OWNER, CASHIER, SELLER)
- [ ] Dashboard raqamlari ko'chishdan oldingi bilan bir xil
- [ ] Yangi kirim qo'shiladi va ro'yxatda ko'rinadi
- [ ] Telegram bot javob beradi
- [ ] Cron qo'lda bir marta chaqirilib, zaxira Telegramga tushgani ko'riladi
- [ ] `x-vercel-id` da kutilgan region
- [ ] Eski baza hali o'chirilmagan (2 hafta)
