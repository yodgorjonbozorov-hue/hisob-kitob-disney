import { z } from "zod";
import { zakazXodimlariSchema } from "./xodimKategoriya";
import { ZAKAZ_HOLATLARI, TOLOV_HOLATLARI } from "@/lib/crm/pipeline";
import { TOLOV_KANALLARI, TOLOV_SATR_LIMITI } from "@/lib/crm/tolovlar";

/**
 * ARALASH TO'LOV QATORLARI. Berilsa — TO'LOVNING YAGONA manbai: server
 * `tolangan` ni yig'indidan, `tolovTuri` ni esa kanallardan hisoblaydi.
 * Bo'sh massiv — "to'lov qatori yo'q" (tanlanmagan yoki to'liq qarzga).
 * QARZ bu yerda kanal EMAS — u qolgan summa (`lib/crm/tolovlar.ts`).
 */
export const zakazTolovlariSchema = z
  .array(
    z.object({
      kanal: z.enum(TOLOV_KANALLARI),
      summa: z.number().int("To'lov summasi butun so'mda bo'lishi kerak").positive("To'lov summasi noldan katta bo'lsin"),
    })
  )
  .max(TOLOV_SATR_LIMITI, `Bir zakazda ${TOLOV_SATR_LIMITI} tadan ko'p to'lov qatori bo'lmaydi`);

/** CRM kunlik buyurtmalari uchun validatsiya sxemalari. */

const sanaRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Yangi buyurtma. Kategoriya — KIRIM modulidagi kategoriya id'si
 * (alohida CRM kategoriya tizimi yo'q). Summa `Int` (so'm), hech qachon float.
 */
export const buyurtmaSchema = z
  .object({
    nomi: z.string().trim().min(1, "Xizmat/buyurtma nomi kiritilsin").max(200),
    categoryId: z.string().trim().min(1, "Kategoriya tanlansin"),
    summa: z.number().int("Summa butun so'mda bo'lishi kerak").min(0).optional(),
    contactId: z.string().trim().optional().nullable(),
    kontaktIsm: z.string().trim().max(100).optional().nullable(),
    kontaktTel: z.string().trim().max(30).optional().nullable(),
    /**
     * ZAKAZ SANASI — MAJBURIY (6-talab). Zakazning doskadagi o'rni aynan
     * shundan hisoblanadi, shuning uchun sanasiz zakaz "qayerga tushishi
     * noma'lum" holatda qolardi.
     */
    sana: z.string().regex(sanaRegex, "Zakaz sanasi YYYY-MM-DD ko'rinishida").min(1, "Zakaz sanasi kiritilsin"),
    muddat: z.string().regex(sanaRegex, "Muddat YYYY-MM-DD ko'rinishida").optional().nullable(),
    izoh: z.string().trim().max(1000).optional().nullable(),
    masulId: z.string().trim().optional().nullable(),
    stageId: z.string().trim().optional().nullable(),
    /**
     * ZAKAZNI OLGAN SOTUVCHI (Employee.id) — birinchi darajali maydon.
     * `masulId` (User) va `xodimlar` (ijrochilar) BILAN ARALASHTIRILMAYDI:
     * bu "mijoz bilan gaplashib zakazni kim oldi" degan javob.
     * Berilmasa server foydalanuvchining o'z sotuvchi profilini qo'yadi
     * (avto-tanlash), u ham bo'lmasa — biznes sozlamasiga qarab rad etadi.
     */
    sotuvchiId: z.string().trim().min(1).optional().nullable(),
    /** Zakazdagi xodimlar (kategoriya kesimida). Berilmasa — biriktiruvsiz. */
    xodimlar: zakazXodimlariSchema.optional(),
    /**
     * Haqiqatda olingan pul (so'm) — `tolovlar` berilmaganda ishlatiladi
     * (bot, eski integratsiyalar). `tolovlar` bo'lsa server uni QAYTA
     * hisoblaydi, ya'ni ikki xil raqam paydo bo'lmaydi.
     */
    tolangan: z.number().int("To'langan summa butun so'mda bo'lishi kerak").min(0).optional(),
    /** Pul kanali (bir kanalli eski yo'l) yoki "qarz" — to'liq qarzga. */
    tolovTuri: z.enum(["naqd", "click", "qarz"]).optional().nullable(),
    /** ARALASH TO'LOV qatorlari — berilsa to'lovning yagona manbai. */
    tolovlar: zakazTolovlariSchema.optional(),
  })
  .refine((d) => (d.tolangan ?? 0) <= (d.summa ?? 0), {
    message: "To'langan summa zakaz narxidan ko'p bo'lmasligi kerak",
    path: ["tolangan"],
  })
  .refine(
    (d) => !d.tolovlar || d.tolovlar.reduce((s, t) => s + t.summa, 0) <= (d.summa ?? 0),
    { message: "To'lovlar yig'indisi zakaz summasidan ko'p bo'lmasligi kerak", path: ["tolovlar"] }
  );

/**
 * Buyurtmani tahrirlash / holatini o'zgartirish.
 * `kirimYoz` — eski xulq (WON bosqichga sudrab o'tkazganda kirim taklifi).
 */
export const buyurtmaPatchSchema = z.object({
  stageId: z.string().trim().optional(),
  kirimYoz: z.boolean().optional(),
  /**
   * ISH JARAYONI HOLATI. "YUTILDI" moliyaviy yakun — u `lib/crm/yakunlash.ts`
   * orqali (kirim + qarzdorlik) bajariladi, boshqalari oddiy o'tish.
   */
  holat: z.enum(ZAKAZ_HOLATLARI).optional(),
  /** "Bugungi zakazga o'tkazish": sanani bugunga suradi. */
  bugungaKochir: z.boolean().optional(),
  /**
   * YO'QOTISH SABABI — "Yo'qotildi" ga o'tkazishda. Boshqa holatga
   * o'tkazishda e'tiborsiz qoladi (server sababni o'zi tozalaydi).
   */
  yoqotishSababi: z.string().trim().max(500, "Sabab 500 belgidan oshmasin").optional().nullable(),
  nomi: z.string().trim().min(1).max(200).optional(),
  summa: z.number().int().min(0).optional(),
  categoryId: z.string().trim().optional().nullable(),
  sana: z.string().regex(sanaRegex).optional().nullable(),
  izoh: z.string().trim().max(1000).optional().nullable(),
  masulId: z.string().trim().optional(),
  kontaktIsm: z.string().trim().max(100).optional().nullable(),
  kontaktTel: z.string().trim().max(30).optional().nullable(),
  tolangan: z.number().int().min(0).optional(),
  tolovTuri: z.enum(["naqd", "click", "qarz"]).optional().nullable(),
  /** ARALASH TO'LOV qatorlari — berilsa to'lovning yagona manbai. */
  tolovlar: zakazTolovlariSchema.optional(),
  /**
   * SOTUVCHINI ALMASHTIRISH (Employee.id) — alohida huquq talab QILINMAYDI
   * (kirgan hisob sotuvchini aniqlamaydi), lekin server xodim shu biznesning
   * faol sotuvchisi ekanini tekshiradi va o'zgarish audit jurnaliga
   * yoziladi (10-talab).
   */
  sotuvchiId: z.string().trim().min(1).optional(),
  /** Zakaz xodimlarini TO'LIQ almashtirish (kirim yozilgach qulflanadi). */
  xodimlar: zakazXodimlariSchema.optional(),
});

/**
 * DOSKA FILTRI (12-talab). Sana oralig'i, sotuvchi (mas'ul), kategoriya va
 * to'lov holati. To'lov holati hisoblanadigan qiymat (`summa` va `tolangan`
 * dan) — u bazada ustun emas, shuning uchun o'qishdan keyin kesiladi.
 */
export const doskaFiltrSchema = z.object({
  from: z.string().regex(sanaRegex).optional().nullable(),
  to: z.string().regex(sanaRegex).optional().nullable(),
  masulId: z.string().trim().optional().nullable(),
  categoryId: z.string().trim().optional().nullable(),
  /** Sotuvchi (Employee.id) — biriktiruv jadvali orqali bazada kesiladi. */
  sotuvchiId: z.string().trim().optional().nullable(),
  tolov: z.enum(TOLOV_HOLATLARI).optional().nullable(),
  yoqotilgan: z.boolean().optional(),
});

/** Kirimga o'tkazish: kassa va to'lov turi ixtiyoriy. */
export const kirimgaSchema = z.object({
  accountId: z.string().trim().optional().nullable(),
  tolovTuri: z.enum(["naqd", "click", "qarz"]).optional().nullable(),
});

export type BuyurtmaInput = z.infer<typeof buyurtmaSchema>;
export type BuyurtmaPatchInput = z.infer<typeof buyurtmaPatchSchema>;
export type DoskaFiltrInput = z.infer<typeof doskaFiltrSchema>;
