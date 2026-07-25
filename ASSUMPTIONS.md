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

- **[Screenshotlar] Playwright** bilan 390px/1440px suratlar rejalashtirilgan. Agar
  `npx playwright install chromium` tarmoq/muhit sabab ishlamasa, bu yerga yoziladi va
  vizual tekshirish qo'lda (dev server + brauzer) davom etadi.
