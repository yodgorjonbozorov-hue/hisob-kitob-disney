# DESIGN.md — "Kassa" redesign (redesign/ui-v2)

> Bu hujjat REDESIGN.md brief'i asosidagi qayta qurish rejasi. Ish `redesign/ui-v2`
> branch'ida, `main`ga tegilmaydi, deploy qilinmaydi (egasi ko'rib chiqadi).

## Konsepsiya

Interfeys qahramoni — **raqam** (pul summasi). Rang bezak emas, faqat pul yo'nalishini
bildiradi: kirdi (yashil) / chiqdi (qizil) / qarz (jigarrang). Rolga qarab boshqa interfeys:
kassir → telefon uchun "kassa" ekrani (3 bosishda yozuv, grafik yo'q); direktor → zich
analitik panel. Signature element: **kassa lentasi** (chek shaklidagi yozuvlar ro'yxati).

## Rang tokenlari (yagona manba: globals.css → tailwind)

- canvas `#F3F6F7`, surface `#FFFFFF`, surface-sunk `#EDF1F2`, line `#DDE4E7`, line-strong `#C3CED3`
- ink `#0C1A21`, ink-soft `#4B5F68`, ink-faint `#8296A0`
- brand `#0B6B5F` (teal), brand-ink `#084F46`, brand-wash `#E4F0EE`
- income `#0E7C57` / wash `#E6F4EE` · expense `#C0362C` / wash `#FBEAE8` · debt `#B9761A` / wash `#FBF1E3`
- Grafik: `#0B6B5F #2F6F91 #B06A4A #6E7F52 #7A5C82` — har kategoriyaga doimiy rang.
- Tailwind default palitra (blue/gray/slate) UI'da **ishlatilmaydi** (Faza 10 grep).
- Dark mode: joriy kodda bor — teal tokenlarning dark variantlari saqlanadi.

## Tipografika

- Raqam/display: **Manrope** (600/700/800). UI/body: **Inter** (400/500/600). Utility: JetBrains Mono (ixtiyoriy).
- Har pul summasi `tabular-nums`. Format: `1 250 000 soʻm` (probel, tiyinsiz).
- Scale: 12/13/15/17/20/26/34/46/60. 26+ da `letter-spacing:-0.02em`. Body ≥15px, kassir ≥17px.
- Sarlavhalar sentence case.

## Fazo/radius/soya/motion

- 4px grid. Radius: input/tugma 10, karta 14, sheet/modal 20, pill 999. Boshqa yo'q.
- Soya: 1px line + `0 1px 2px rgba(12,26,33,.04)`; ko'tarilgan `0 8px 28px rgba(12,26,33,.12)`.
- Motion 3 xil: 120ms (hover), 200ms cubic (sheet), 400ms (raqam counter, birinchi render). reduced-motion hurmat.

## Signature: Kassa lentasi

Yozuvlar kun bo'yicha guruhlangan; sticky kun sarlavhasi + o'ngda kun sof natijasi; qator =
ikonka + izoh/kim + katta tabular summa (±); kun blok ostida perforatsiya chizig'i (nuqtali
border + yon yarim-doira kesik); lenta oxirida zigzag "yirilgan" chegara. Boldlik faqat shu yerda.

## Lug'at (lib/copy.ts)

Yozuv (tranzaksiya emas), Pul kirdi/Pul chiqdi, Kirdi/Chiqdi/Qoldi, Saqlash, Saralash/Qidirish.
UI + Telegram + PDF bir xil.

---

## O'z-tanqid (brief talabi: "qaysi qismi har qanday loyihada chiqadigan default javob?")

1. **"CSS var + tailwind extend" — default javob.** Har kim shunday qiladi. Farq tokenlarning
   O'ZIDA: sovuq teal + issiq jigarrang qarz rangi + kam soya — bu Ramp/Mercury emas, o'ziga xos.
   Xavf: teal'ni ko'k default o'rniga ishlatib, baribir "yana bir SaaS" chiqishi. → Teal faqat
   brand/aktiv uchun; asosiy sirt sovuq-oq, aksent kam. Boldlik faqat kassa lentasi + katta raqam.

2. **StatCard + sparkline — default fintech.** Har dashboard shunday. Farq: insight matni REAL
   hisoblangan ("Chiqimning 42%i Ish haqi") — sun'iy emas. Va pie chart YO'Q (gorizontal bar).

3. **NumberPad — default emas, aynan shu loyiha uchun.** Kassir telefonда tez pul yozadi —
   bu haqiqiy differensiator. Ko'p vaqt shunga sarflanadi (keypad + kategoriya to'ri + undo).

4. **Kassa lentasi perforatsiya — bezakka aylanib ketishi mumkin.** Xavf: "chiroyli" bo'lib
   funksiyani buzadi. → Perforatsiya faqat kun ajratgichi, juda nozik; summa va o'qilishi ustuvor.

5. **Rolga qarab alohida interfeys — eng katta qiymat, eng katta ish.** Kassir dashboard ko'rmaydi;
   bu shunchaki "yashirish" emas, butunlay boshqa ekran. Shu yerda default'dan qochiladi.

### Tuzatilgan yo'nalish
Boldlikni bitta joyga (kassa lentasi + katta raqam) to'playman; qolgan hamma joy sokin, kam rang,
kam soya. Kassir oqimi (keypad + kategoriya to'ri + undo) — eng ko'p sayqal beriladigan qism.
Grafiklarda default Recharts ko'rinishi to'liq olib tashlanadi (pie yo'q, legend qutisi yo'q, grid yo'q).

## Fazalar

0 audit/branch/docs · 1 tokenlar+shrift+format+copy · 2 ui primitivlar+ReceiptList+NumberPad+CategoryPicker
· 3 app shell · 4 kassir oqimi · 5 direktor dashboard · 6 yozuvlar · 7 ombor/sotuv/qarz · 8 hisobot/PDF/Excel
· 9 admin/telegram · 10 audit (grep/a11y/390px) · 11 PWA/polish · 12 screenshots/SUMMARY. Har faza — alohida commit.
