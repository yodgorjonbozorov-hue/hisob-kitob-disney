# ASSUMPTIONS.md — redesign/ui-v2

Noaniqliklarda tanlangan qarorlar. Egasi qaytganda ko'rib, kerak bo'lsa tuzatadi.

## Faza 0

- **[Kontekst] Ilova "shablon" holatida emas.** REDESIGN.md muallifi asl (generic
  Tailwind) holatni nazarda tutgan. Lekin `main` branch bugun allaqachon yangilandi:
  semantik dizayn tokenlari, dark mode, Inter shrifti, mobil pastki nav + FAB, soft-delete,
  audit, budjet, bildirishnoma, smena, takroriy va boshqa 26 funksiya deploy qilingan.
  → Redesign shu **joriy koddan** boshlanadi (asl shablondan emas). Brief bo'yicha
  ishlar **`redesign/ui-v2` branch'ida**, `main`ga tegilmaydi, **deploy qilinmaydi** —
  egasi ko'rib, o'zi merge/deploy qiladi.

- **[Dark mode] REDESIGN.md v1'da dark mode so'ramaydi**, lekin joriy kodda dark mode
  allaqachon bor. Uni buzmayman — yangi teal tokenlar dark variantlari bilan saqlanadi.
  Agar teal palitra dark mode'da yomon ko'rinsa, dark tokenlarni moslashtiraman.

- **[claude-settings.json] O'rnatildi** (`.claude/settings.json`): `git push`, `curl`,
  `turso`, `vercel`, `rm -rf`, `.env` — harness darajasida bloklangan. Brief chegaralarini
  kuchaytiradi.

- **[DEPLOY] Egasi "hozirgacha ishni deploy qil" dedi** → `redesign/ui-v2` `main`ga
  ff-merge qilinib push qilindi (Vercel deploy). REDESIGN.md dastlab deploy'ni taqiqlagan
  edi, lekin egasi keyingi aniq buyrug'i ustun. Redesign faqat UI (schema o'zgarmagan),
  shu bois bazaga yangi xavf yo'q — mavjud deploy qilingan backend ustiga tushdi.
  `.claude/settings.json` push'ni bloklagandek edi, lekin bu sessiyada push o'tdi.

- **[Screenshotlar] Playwright** bilan 390px/1440px suratlar rejalashtirilgan. Agar
  `npx playwright install chromium` tarmoq/muhit sabab ishlamasa, bu yerga yoziladi va
  vizual tekshirish qo'lda (dev server + brauzer) davom etadi.

## Audit BOSQICH 2 (2026-08-13)

- **[TASK 2.7 — direktor tasdig'i] A VARIANT TANLANDI (egasi, 2026-08-13).**
  Direktor tayinlanmagan bo'lsa kun yakunini HECH KIM tasdiqlay olmaydi —
  boshqaruvchi fallback olib tashlandi (`getKunlikRuxsat.tasdiqlaydi =
  direktormi`). UI va xato matni "Avval direktor tayinlang" deb
  yo'naltiradi; cron eslatmasi direktorsiz biznes boshqaruvchilariga
  tasdiqlash tugmasisiz, "direktor tayinlang" matni bilan boradi.
- **[LOCKED muddat] `qulflashKun` standarti 7 kun** (0 = avto qulflash
  o'chirilgan). Sozlama UI'si hali yo'q — qiymat hozircha bazadan
  o'zgartiriladi; kerak bo'lsa keyingi bosqichda sozlamalar sahifasiga chiqadi.
- **[Impersonatsiya muddati] 60 daqiqa.** Muddat o'tsa kontekst yopiladi va
  superadmin /login orqali o'z hisobiga qaytadi (sessiya avtomatik
  superadminga qaytarilmaydi — cookie'ni render paytida qayta yozib bo'lmaydi).
- **[Parol tiklash] faqat Telegram orqali** (SMS provayder yo'q). Telegram
  ulanmagan foydalanuvchiga kod bormaydi; UI "direktoringizga murojaat
  qiling" deb yo'naltiradi (direktor H-1 chegaralari bilan parol almashtiradi).
