import { Prisma } from "@prisma/client";

/**
 * REAL PUL FILTRI — butun tizimdagi eng muhim buxgalteriya qoidasi.
 *
 * Qarzga berilgan savdo pul KIRIMI EMAS: mahsulot ketdi, pul kelmadi.
 * Shuning uchun `tolovTuri = "qarz"` bilan yozilgan kirim hech qaysi
 * daromad/sof balans/kassa yakunida qatnashmasligi kerak. Pul faqat
 * mijoz to'laganda kirimga aylanadi — o'shanda `Debt` to'lovi alohida
 * kirim tranzaksiyasini TO'LOV SANASI bilan yozadi (lib/services/qarz.ts).
 *
 * Nega bu fayl alohida: qoida oltita joyda kerak (yozuvlar jamlanmasi,
 * oylik xulosa, trend, kategoriya taqsimoti, kun yakuni, Telegram xulosasi).
 * Har birida qo'lda yozilsa, bittasi unutilishi muqarrar edi — va aynan
 * shunday bo'lgan ham.
 *
 * NEGA `{ not: "qarz" }` EMAS: `tolovTuri` NULL bo'lishi mumkin (eski
 * yozuvlar, ularda tur kassadan chiqariladi). SQL'da `NULL <> 'qarz'`
 * qiymati NULL — ya'ni qator TUSHIB QOLADI. Ochiq `OR` shartisiz eski
 * yozuvlarning hammasi jimgina hisobdan chiqib ketardi.
 */
export const QARZ_EMAS: Prisma.TransactionWhereInput = {
  OR: [{ tolovTuri: null }, { tolovTuri: { not: "qarz" } }],
};

/**
 * Mavjud shartga real-pul filtrini qo'shadi.
 *
 * `AND` orqali birlashtiriladi, chunki chaqiruvchi shartda o'zining `OR`i
 * bo'lishi mumkin (masalan izoh bo'yicha qidiruv) — ustidan yozib
 * yuborilmasin.
 */
export function qarzsiz(where: Prisma.TransactionWhereInput): Prisma.TransactionWhereInput {
  return { AND: [where, QARZ_EMAS] };
}

/**
 * Xom SQL uchun bir xil shart. `alias` — `Transaction` jadvalining taxallusi
 * (`monthlyTotals` va `trend` da bu `t`).
 */
export function qarzEmasSql(alias: string): Prisma.Sql {
  const ustun = Prisma.raw(`"${alias}"."tolovTuri"`);
  return Prisma.sql`(${ustun} IS NULL OR ${ustun} <> 'qarz')`;
}
