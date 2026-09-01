import { z } from "zod";

// ---------------------------------------------------------------------------
// Holatlar
// ---------------------------------------------------------------------------

/** Qarz holati. `Debt.status` shu qiymatlardan birini saqlaydi. */
export const QARZ_HOLATLARI = ["OPEN", "PARTIALLY_PAID", "PAID", "CANCELLED"] as const;
export type QarzHolat = (typeof QARZ_HOLATLARI)[number];

/** UI matnlari — kod ichida ingliz, ekranda o'zbek. */
export const QARZ_HOLAT_NOMI: Record<QarzHolat, string> = {
  OPEN: "Ochiq",
  PARTIALLY_PAID: "Qisman to'langan",
  PAID: "Yopilgan",
  CANCELLED: "Bekor qilingan",
};

/**
 * HOLAT HAR DOIM SHU YERDAN CHIQADI — `Debt.status` hech qayerda qo'lda
 * yozilmaydi, aks holda qoldiq bilan holat bir-biriga zid bo'lib qolardi.
 *
 * Invariant: qolgan = jamiSumma − tolangan.
 *   qolgan = 0            → PAID
 *   0 < tolangan < jami   → PARTIALLY_PAID
 *   tolangan = 0          → OPEN
 * Bekor qilingan qarz bu hisobdan tashqarida — u undirilmaydi.
 *
 * Sof funksiya: server ham, brauzer ham ayni qoidadan foydalanadi.
 */
export function qarzHolatHisobla(
  jamiSumma: number,
  tolangan: number,
  bekorMi = false
): QarzHolat {
  if (bekorMi) return "CANCELLED";
  if (tolangan >= jamiSumma) return "PAID";
  if (tolangan > 0) return "PARTIALLY_PAID";
  return "OPEN";
}

/**
 * `isYopilgan` — eski ustun, lekin butun tizim (ochiq qarz jamlari, mijoz
 * limiti, bildirishnomalar) hali ham unga tayanadi. Shuning uchun u `status`
 * bilan HAR YOZUVDA birga yangilanadi: yopiq = to'langan YOKI bekor qilingan.
 */
export function qarzYopiqmi(status: QarzHolat): boolean {
  return status === "PAID" || status === "CANCELLED";
}

/**
 * Qarz to'lovining usuli. Kassa (Account) tanlash bundan ALOHIDA: usul
 * "qanday to'ladi" degan savolga javob beradi va tarixda shu ko'rinishda
 * saqlanadi, kassa esa pul QAYSI qopga tushganini bildiradi.
 */
export const QARZ_TOLOV_USULLARI = ["naqd", "click", "bank"] as const;
export type QarzTolovUsuli = (typeof QARZ_TOLOV_USULLARI)[number];

export const QARZ_TOLOV_NOMI: Record<QarzTolovUsuli, string> = {
  naqd: "Naqd",
  click: "Click",
  bank: "Bank",
};

export const QARZ_TOLOV_BELGI: Record<QarzTolovUsuli, string> = {
  naqd: "\u{1F4B5}",
  click: "\u{1F4B3}",
  bank: "\u{1F3E6}",
};

// ---------------------------------------------------------------------------
// Telefon
// ---------------------------------------------------------------------------

/**
 * O'zbekiston raqamini yagona ko'rinishga keltiradi: `+998901234567`.
 *
 * Foydalanuvchi raqamni har xil yozadi — `90 123 45 67`, `(90) 1234567`,
 * `998901234567`, `+998 90 123-45-67`. Bazada har xil ko'rinishda yotsa
 * bir mijozning ikkita kartochkasi paydo bo'lardi.
 *
 * Formatga tushmasa `null` qaytaradi (chaqiruvchi xato beradi).
 */
export function telNormalize(xom: string | null | undefined): string | null {
  if (!xom) return null;
  const raqamlar = xom.replace(/\D/g, "");
  if (raqamlar.length === 9) return `+998${raqamlar}`;
  if (raqamlar.length === 12 && raqamlar.startsWith("998")) return `+${raqamlar}`;
  return null;
}

/** Ko'rsatish uchun: `+998901234567` → `+998 90 123 45 67`. */
export function telKorinish(tel: string | null | undefined): string {
  const n = telNormalize(tel);
  if (!n) return tel ?? "";
  const d = n.slice(4);
  return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
}

/**
 * Telefon maydoni: bo'sh bo'lsa `null`, to'ldirilgan bo'lsa formatga
 * tushishi SHART. "Majburiymi" degan savolga esa sxema oxiridagi
 * `superRefine` javob beradi — u qarz yo'nalishiga bog'liq.
 */
const telMaydoni = z
  .string()
  .max(30)
  .optional()
  .nullable()
  .superRefine((v, ctx) => {
    if (v && v.trim() && telNormalize(v) === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Telefon raqami noto'g'ri (masalan: +998 90 123 45 67)",
      });
    }
  })
  .transform((v) => (v && v.trim() ? telNormalize(v) : null));

/**
 * "+ Yangi mijoz" formasi (qarz/sotuv oynasidan kartochka ochish).
 *
 * Telefon ATAYLAB majburiy emas: bozorda kassir raqamni har doim ham
 * so'ramaydi, lekin qarz baribir kartochkaga bog'lanishi kerak.
 */
export const yangiMijozSchema = z.object({
  ism: z.string().trim().min(1, "Ism kiritilishi shart").max(100),
  tel: telMaydoni,
  /** Optom kartochka maydonlari (ixtiyoriy — chakanada so'ralmaydi). */
  manzil: z.string().trim().max(300).optional().nullable(),
  masulShaxs: z.string().trim().max(120).optional().nullable(),
  izoh: z.string().trim().max(500).optional().nullable(),
});

export type YangiMijozInput = z.infer<typeof yangiMijozSchema>;

const sanaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Sana YYYY-MM-DD ko'rinishida bo'lishi kerak");

// ---------------------------------------------------------------------------
// Qarz yaratish
// ---------------------------------------------------------------------------

/**
 * Qarz yaratish — Yozuvlar sahifasidagi "Kirim → Qarz" va Qarzlar
 * sahifasidagi "Yangi qarzdorlik" ikkalasi ham shu sxemadan o'tadi.
 *
 * Mijoz ikki yo'l bilan beriladi: mavjud kartochka (`contactId`) yoki yangi
 * ism+telefon. Ikkalasi ham bo'lmasa — xato: qarz kimniki ekani noma'lum
 * bo'lsa uni undirib bo'lmaydi.
 */
export const createQarzSchema = z
  .object({
  turi: z.enum(["olinadigan", "beriladigan"]).default("olinadigan"),
  /** Mavjud mijoz kartochkasi. Berilsa ism/telefon undan olinadi. */
  contactId: z.string().min(1).optional().nullable(),
  mijozNomi: z.string().trim().max(100).optional().nullable(),
  mijozTel: telMaydoni,
  /** Mijoz kartochkasi yaratilsinmi (MIJOZLAR moduli yoqiq bo'lsa). */
  mijozSaqla: z.boolean().optional(),
  jamiSumma: z.number().int().positive("Qarz summasi 0 dan katta bo'lishi kerak"),
  /** Qarz berilgan sana. Berilmasa — bugun. */
  sana: sanaSchema.optional().nullable(),
  categoryId: z.string().min(1).optional().nullable(),
  /** Mas'ul sotuvchi/operator (tizim foydalanuvchisi). Berilmasa — yozuvchi. */
  masulId: z.string().min(1).optional().nullable(),
  productId: z.string().min(1).optional().nullable(),
  muddat: sanaSchema.optional().nullable(),
  izoh: z.string().max(500).optional().nullable(),
  /** Boshlang'ich to'lov (qarzning bir qismi darhol to'langan holat). */
  tolangan: z.number().int().min(0).optional(),
  })
  .superRefine((d, ctx) => {
    // Mijoz majburiy: kartochka tanlanmagan bo'lsa ism qo'lda kiritiladi.
    if (!d.contactId && !d.mijozNomi) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mijozNomi"],
        message: "Mijozni tanlang yoki ismini kiriting",
      });
    }
    // Telefon faqat BIZGA qarzdorlar uchun majburiy: qarzni undirish uchun
    // bog'lanish yo'li bo'lishi shart. "Biz qarzdormiz" yozuvida (masalan
    // ichki hisob-kitob) raqam har doim ham bo'lmaydi.
    if (d.turi === "olinadigan" && !d.contactId && !d.mijozTel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mijozTel"],
        message: "Telefon raqami kiritilishi shart",
      });
    }
    if (d.tolangan != null && d.tolangan > d.jamiSumma) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tolangan"],
        message: "To'langan summa qarz summasidan ko'p bo'lmasligi kerak",
      });
    }
  });

// ---------------------------------------------------------------------------
// To'lov
// ---------------------------------------------------------------------------

/**
 * Qarz to'lovi.
 *
 * `idempotencyKey` — klient har OCHILGAN to'lov formasiga bitta kalit
 * beradi. Tugma ikki marta bosilsa ikkala so'rov ham AYNI kalitni olib
 * keladi va server ikkinchisiga mavjud to'lovni qaytaradi (yangi kirim
 * yozilmaydi). Bu tarmoq qayta urinishlaridan ham himoya qiladi.
 */
export const qarzTolovSchema = z.object({
  summa: z.number().int().positive("To'lov summasi 0 dan katta bo'lishi kerak"),
  /** To'lov sanasi — kirim tranzaksiyasi AYNAN shu sana bilan yoziladi. */
  sana: sanaSchema.optional().nullable(),
  tolovTuri: z.enum(QARZ_TOLOV_USULLARI).optional().nullable(),
  /** Pul qaysi kassaga tushdi. Berilmasa — to'lov turiga mos faol kassa. */
  accountId: z.string().min(1).optional().nullable(),
  izoh: z.string().max(500).optional().nullable(),
  idempotencyKey: z.string().min(8).max(64).optional().nullable(),
});

/**
 * MIJOZ BO'YICHA TO'LOV — bitta summa, mijozning barcha ochiq qarzlariga.
 *
 * `taqsimot` berilmasa server ENG ESKI OCHIQ QARZDAN boshlab taqsimlaydi
 * (lib/services/qarz.ts dagi hujjatlangan qoida). Berilsa — aynan
 * ko'rsatilganidek, lekin yig'indisi `summa` ga teng bo'lishi shart.
 */
export const qarzdorTolovSchema = z.object({
  turi: z.enum(["olinadigan", "beriladigan"]),
  /** `qarzdorKalit()` natijasi: "contact:<id>" yoki "ism:<kichik harf>". */
  kalit: z.string().min(1, "Qarzdor kaliti berilmadi").max(200),
  summa: z.number().int().positive("To'lov summasi 0 dan katta bo'lishi kerak"),
  sana: sanaSchema.optional().nullable(),
  tolovTuri: z.enum(QARZ_TOLOV_USULLARI).optional().nullable(),
  accountId: z.string().min(1).optional().nullable(),
  izoh: z.string().max(500).optional().nullable(),
  idempotencyKey: z.string().min(8).max(64).optional().nullable(),
  taqsimot: z
    .array(
      z.object({
        debtId: z.string().min(1),
        summa: z.number().int().positive(),
      })
    )
    .max(50, "Bir to'lovda 50 tadan ko'p qarz yopilmaydi")
    .optional()
    .nullable(),
});

export const qarzBekorSchema = z.object({
  sabab: z.string().trim().min(3, "Bekor qilish sababini yozing").max(300),
});

export type CreateQarzInput = z.infer<typeof createQarzSchema>;
export type QarzTolovInput = z.infer<typeof qarzTolovSchema>;
export type QarzdorTolovInput = z.infer<typeof qarzdorTolovSchema>;
export type QarzBekorInput = z.infer<typeof qarzBekorSchema>;
