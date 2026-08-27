import { Check } from "lucide-react";
import { ASOSIY_IMKONIYATLAR, pricingConfig, somFormat } from "@/lib/pricing/config";

/**
 * Tariflar sahifasining statik (server) bo'limlari: asosiy tizimga kiritilgan
 * imkoniyatlar, imkoniyatlar matritsasi va savol-javob.
 *
 * Matritsa FAQAT haqiqatda mavjud funksiyalarni ko'rsatadi — reklama uchun
 * to'qib chiqarilgan qator YO'Q (mavjud modullar: lib/modules/registry.ts).
 */

export function AsosiyImkoniyatlar() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <h2 className="font-heading text-xl font-semibold text-fg">
        Asosiy tizimga nimalar kiradi?
      </h2>
      <p className="mt-1.5 text-sm text-muted">
        Balansa asosiy obunasi ({somFormat(pricingConfig.baseMonthlyPrice)} so'm / oy) — bu
        to'liq hisob-kitob tizimi, mayda funksiyalar uchun alohida to'lov yo'q.
      </p>
      <ul className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {ASOSIY_IMKONIYATLAR.map((nomi) => (
          <li key={nomi} className="flex items-center gap-2 text-sm text-fg">
            <Check size={16} className="shrink-0 text-income" aria-hidden />
            {nomi}
          </li>
        ))}
      </ul>
    </section>
  );
}

interface MatritsaQator {
  nomi: string;
  /** null — asosiy tizimda; matn — qaysi qo'shimcha modul. */
  modul: string | null;
}

const MATRITSA: { guruh: string; qatorlar: MatritsaQator[] }[] = [
  {
    guruh: "Moliya",
    qatorlar: [
      { nomi: "Kirim-chiqim yozuvlari", modul: null },
      { nomi: "Budjet va takroriy to'lovlar", modul: null },
      { nomi: "Pul oqimi (Cash Flow)", modul: null },
    ],
  },
  {
    guruh: "Kassa",
    qatorlar: [
      { nomi: "Ko'p kassa va kassalararo o'tkazma", modul: null },
      { nomi: "Kun yakuni (kassa solishtiruvi)", modul: null },
    ],
  },
  {
    guruh: "Ombor",
    qatorlar: [
      { nomi: "Mahsulot qoldig'i va tannarx", modul: null },
      { nomi: "Excel/CSV dan import", modul: null },
      { nomi: "Inventarizatsiya", modul: null },
      { nomi: "Rejali xarid buyurtmalari", modul: "Kengaytirilgan Ombor" },
    ],
  },
  {
    guruh: "Savdo",
    qatorlar: [
      { nomi: "Sotuv (naqd / qarz)", modul: null },
      { nomi: "POS kassa: savat, chek, qaytarish", modul: "POS / Magazin" },
      { nomi: "Shtrix-kod va QR", modul: "POS / Magazin" },
    ],
  },
  {
    guruh: "Qarzdorlik",
    qatorlar: [
      { nomi: "Mijoz va ta'minotchi qarzlari", modul: null },
      { nomi: "Qarz to'lovlari nazorati", modul: null },
    ],
  },
  {
    guruh: "CRM",
    qatorlar: [
      { nomi: "Kontaktlar va bitimlar kanbani", modul: "CRM" },
      { nomi: "Buyurtmalar oqimi", modul: "CRM" },
    ],
  },
  {
    guruh: "Hisobot",
    qatorlar: [
      { nomi: "Foyda va zarar (P&L), davriy hisobotlar", modul: null },
      { nomi: "PDF va Excel eksport", modul: null },
      { nomi: "Kunlik hisobot Telegramda", modul: "Telegram Hisobot Boti" },
      { nomi: "AI tahlil va xulosalar", modul: "AI Analitika" },
    ],
  },
  {
    guruh: "Xodimlar",
    qatorlar: [
      { nomi: "Xodimlar va rollar (kassir, sotuvchi)", modul: null },
      { nomi: "Har amal uchun audit jurnali", modul: null },
    ],
  },
  {
    guruh: "Filiallar",
    qatorlar: [
      { nomi: "1 filial", modul: null },
      {
        nomi: `Qo'shimcha filial (+${somFormat(pricingConfig.additionalBranchPrice)} so'm / oy)`,
        modul: "Filial narxi",
      },
    ],
  },
];

export function ImkoniyatMatritsasi() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <h2 className="font-heading text-xl font-semibold text-fg">Imkoniyatlar matritsasi</h2>
      <p className="mt-1.5 text-sm text-muted">
        Nima asosiy tizimda, nima qo'shimcha modul — yashirin shartlarsiz.
      </p>
      <div className="jadval-siljish mt-5 overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">Imkoniyat</th>
              <th className="px-4 py-3 font-medium">Qayerda</th>
            </tr>
          </thead>
          <tbody>
            {MATRITSA.map((g) => (
              <Guruh key={g.guruh} guruh={g.guruh} qatorlar={g.qatorlar} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Guruh({ guruh, qatorlar }: { guruh: string; qatorlar: MatritsaQator[] }) {
  return (
    <>
      <tr className="border-t border-line bg-surface-2/60">
        <td colSpan={2} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
          {guruh}
        </td>
      </tr>
      {qatorlar.map((q) => (
        <tr key={q.nomi} className="border-t border-line/60">
          <td className="px-4 py-2.5 text-fg">{q.nomi}</td>
          <td className="px-4 py-2.5">
            {q.modul === null ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-income">
                <Check size={14} aria-hidden /> Balansa ichida
              </span>
            ) : (
              <span className="text-xs font-medium text-muted">Qo'shimcha: {q.modul}</span>
            )}
          </td>
        </tr>
      ))}
    </>
  );
}

const SAVOLLAR: { savol: string; javob: string }[] = [
  {
    savol: "14 kun bepul foydalanish uchun karta kerakmi?",
    javob: "Yo'q. Ism, telefon raqam va parol yetarli — to'lov ma'lumotlari so'ralmaydi.",
  },
  {
    savol: "Sinovdan keyin avtomatik pul yechiladimi?",
    javob:
      "Yo'q. Sinov tugagach o'zingiz tarif tanlab to'laysiz — Balansa hech qachon avtomatik pul yechmaydi.",
  },
  {
    savol: "Biznes turini keyin o'zgartira olamanmi?",
    javob:
      "Ha. Yo'nalish faqat boshlang'ich sozlash uchun: keyin Sozlamalar → Modullar bo'limidan istalgan bo'limni yoqasiz yoki o'chirasiz — hech narsa qulflanmaydi.",
  },
  {
    savol: "Filial qo'sha olamanmi?",
    javob:
      "Ha. Har filial alohida yuritiladi (raqamlar aralashmaydi) va istalgan payt Bizneslar bo'limidan qo'shiladi.",
  },
  {
    savol: "Ma'lumotlarim sinov tugaganda o'chib ketadimi?",
    javob:
      "Yo'q. Ma'lumotlaringiz saqlanadi — obuna faollashtirilgach hammasi joyida turadi. Balansa ma'lumotni hech qachon o'chirmaydi.",
  },
  {
    savol: "Excel'dan ma'lumot ko'chirish mumkinmi?",
    javob:
      "Ha. Mahsulotlar ro'yxatini Excel/CSV fayldan import qilasiz (rasmlar bilan birga), hisobotlarni esa Excel va PDF ko'rinishida yuklab olasiz.",
  },
  {
    savol: "Tarifni istalgan vaqtda o'zgartirish mumkinmi?",
    javob:
      "Ha. «Obuna va to'lov» bo'limidan boshqa tarifga o'tasiz — yangi tarif keyingi to'lovdan kuchga kiradi, avval to'langan kunlar yo'qolmaydi.",
  },
];

export function TariflarSavollari() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <h2 className="font-heading text-xl font-semibold text-fg">Savollar</h2>
      <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-surface">
        {SAVOLLAR.map((s, i) => (
          <details key={s.savol} className={i > 0 ? "border-t border-line" : ""}>
            <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-fg">
              {s.savol}
              <span aria-hidden className="flex-none text-base text-faint">
                +
              </span>
            </summary>
            <p className="m-0 max-w-[65ch] px-5 pb-4 text-sm leading-relaxed text-muted">{s.javob}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
