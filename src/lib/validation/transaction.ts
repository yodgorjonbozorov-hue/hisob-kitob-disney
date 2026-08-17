import { z } from "zod";

/** Tranzaksiya to'lov turlari. Null (eski yozuvlar) — kassa turidan chiqariladi. */
export const TOLOV_TURLARI = ["naqd", "click", "qarz"] as const;
export type TolovTuri = (typeof TOLOV_TURLARI)[number];

export const TOLOV_NOMI: Record<TolovTuri, string> = {
  naqd: "Naqd",
  click: "Click",
  qarz: "Qarz",
};

export const TOLOV_BELGI: Record<TolovTuri, string> = {
  naqd: "\u{1F4B5}",
  click: "\u{1F4B3}",
  qarz: "\u{1F4CB}",
};

export const createTransactionSchema = z
  .object({
    turi: z.enum(["kirim", "chiqim"]),
    categoryId: z.string().min(1),
    summa: z.number().int().positive("Summa musbat bo'lishi kerak"),
    sana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana noto'g'ri formatda"),
    /** Qaysi kassaga tushdi. Berilmasa to'lov turiga mos faol kassa olinadi. */
    accountId: z.string().min(1).optional().nullable(),
    /** Berilmasa (eski mijozlar/import) — kassa turidan chiqariladi. */
    tolovTuri: z.enum(TOLOV_TURLARI).optional().nullable(),
    izoh: z.string().max(500).optional().nullable(),
    filial: z.string().max(100).optional().nullable(),
  })
  .refine((d) => !(d.tolovTuri === "qarz" && d.turi === "chiqim"), {
    message: "Qarz to'lov turi faqat kirim uchun",
  });

/**
 * MOLIYAVIY MAYDONLAR — tahrirlab bo'lmaydi (audit: Critical #3).
 *
 * Bular pul oqimini belgilaydi: yo'nalish, summa, qaysi kunga tegishli,
 * qaysi kassaga tushgani. Yozilgandan keyin o'zgartirilsa hisobot tarixi
 * jimgina qayta yoziladi — shuning uchun ular faqat storno orqali
 * (`POST /api/transactions/[id]/storno`) tuzatiladi.
 *
 * `categoryId` ataylab RO'YXATDA YO'Q: kategoriya summani ham, sanani ham,
 * kassa qoldig'ini ham o'zgartirmaydi — u faqat yozuvni qaysi moddaga
 * kiritishni bildiradi va uni ommaviy ko'chirish (`/api/transactions/bulk-move`)
 * allaqachon mavjud imkoniyat.
 */
export const OZGARMAS_MAYDONLAR = ["turi", "summa", "sana", "tolovTuri", "accountId"] as const;

/** Xato xabarida ko'rsatiladigan o'zbekcha nomlar. */
export const OZGARMAS_NOMLARI: Record<(typeof OZGARMAS_MAYDONLAR)[number], string> = {
  turi: "turi",
  summa: "summa",
  sana: "sana",
  tolovTuri: "to'lov turi",
  accountId: "kassa",
};

export const updateTransactionSchema = z.object({
  turi: z.enum(["kirim", "chiqim"]).optional(),
  categoryId: z.string().min(1).optional(),
  summa: z.number().int().positive("Summa musbat bo'lishi kerak").optional(),
  sana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana noto'g'ri formatda").optional(),
  accountId: z.string().min(1).optional().nullable(),
  tolovTuri: z.enum(TOLOV_TURLARI).optional().nullable(),
  izoh: z.string().max(500).optional().nullable(),
  filial: z.string().max(100).optional().nullable(),
});

/**
 * So'rovda MOLIYAVIY maydonni HAQIQATAN o'zgartirmoqchi bo'lganlarini topadi
 * (bo'sh massiv — o'zgarish yo'q, so'rov o'tadi).
 *
 * "Berilgan" emas, "BOSHQA qiymat berilgan" tekshiriladi: mijoz kodi ba'zan
 * butun obyektni qaytarib yuboradi — o'zgarmagan maydon so'rovni rad
 * etmasligi kerak. `null` va `undefined` bir xil "qiymat yo'q" deb qaraladi
 * (eski yozuvlarda `tolovTuri`/`accountId` null bo'lishi mumkin).
 */
export function ozgarmasBuzilishi(
  data: UpdateTransactionInput,
  mavjud: {
    turi: string;
    summa: number;
    sana: Date;
    tolovTuri: string | null;
    accountId: string | null;
  },
  /** "YYYY-MM-DD" -> Date. Aylanma importdan qochish uchun tashqaridan beriladi. */
  sanaOqi: (s: string) => Date
): string[] {
  const buzilgan: string[] = [];

  for (const maydon of OZGARMAS_MAYDONLAR) {
    if (data[maydon] === undefined) continue;

    const yangi = maydon === "sana" ? sanaOqi(data.sana!).getTime() : data[maydon];
    const eski = maydon === "sana" ? mavjud.sana.getTime() : mavjud[maydon];

    if ((yangi ?? null) !== (eski ?? null)) buzilgan.push(OZGARMAS_NOMLARI[maydon]);
  }

  return buzilgan;
}

/**
 * Storno (bekor qilish + ixtiyoriy tuzatish) so'rovi.
 * `tuzatish` berilmasa yozuv shunchaki bekor qilinadi.
 */
export const stornoTransactionSchema = z.object({
  sabab: z.string().trim().min(3, "Sabab yozilishi shart").max(500),
  tuzatish: createTransactionSchema.optional().nullable(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type StornoTransactionInput = z.infer<typeof stornoTransactionSchema>;
