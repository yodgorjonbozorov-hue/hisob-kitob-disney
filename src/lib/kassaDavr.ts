import { TOSHKENT_OFFSET_MS } from "@/lib/date";

/**
 * KASSA SAHIFASI DAVR FILTRI — "Bugun | Hafta | Oy | Barchasi" + sana oralig'i.
 *
 * Sof funksiyalar (prisma import qilinmaydi), shuning uchun server sahifasi
 * ham, client komponenti ham AYNI shu ro'yxatdan foydalanadi — yorliqlar
 * ikkiga ajralib ketmaydi.
 *
 * Chegaralar TOSHKENT kalendari bo'yicha hisoblanadi va UTC instant sifatida
 * qaytadi: server UTC'da ishlaydi, foydalanuvchi esa Toshkentda yashaydi.
 * Kesish `createdAt` bo'yicha bo'ladi (yozuvning `sana` si emas) — kassadagi
 * pul yozuv qaysi kunga tegishli ekaniga emas, QACHON kiritilganiga qarab
 * harakatlanadi. Bu qoida smena va kassa qoldig'i bilan bir xil.
 */

export const KASSA_DAVRLARI = ["bugun", "hafta", "oy", "barchasi", "oraliq"] as const;
export type KassaDavr = (typeof KASSA_DAVRLARI)[number];

/** Segmentli filtr yorliqlari (sana oralig'i alohida boshqariladi). */
export const DAVR_YORLIQ: Record<KassaDavr, string> = {
  bugun: "Bugun",
  hafta: "Hafta",
  oy: "Oy",
  barchasi: "Barchasi",
  oraliq: "Oraliq",
};

/** URL parametridan xavfsiz davr qiymati (noma'lum qiymat — `bugun`). */
export function davrOqi(raw: string | undefined | null): KassaDavr {
  return (KASSA_DAVRLARI as readonly string[]).includes(raw ?? "")
    ? (raw as KassaDavr)
    : "bugun";
}

/** Toshkent kalendaridagi kun boshining UTC instanti. */
export function toshkentKunBoshi(now: Date = new Date()): Date {
  const siljigan = new Date(now.getTime() + TOSHKENT_OFFSET_MS);
  const yarimTun = Date.UTC(
    siljigan.getUTCFullYear(),
    siljigan.getUTCMonth(),
    siljigan.getUTCDate()
  );
  return new Date(yarimTun - TOSHKENT_OFFSET_MS);
}

/**
 * Davr boshlanishi. `null` — chegara yo'q ("Barchasi").
 *
 * Hafta DUSHANBADAN boshlanadi: o'zbek ish haftasi shunday, yakshanbadan
 * boshlansa "bu hafta" dam olish kunini o'tgan haftaga qo'shib yuborardi.
 */
export function davrBoshi(davr: KassaDavr, now: Date = new Date()): Date | null {
  if (davr === "barchasi" || davr === "oraliq") return null;

  const kunBoshi = toshkentKunBoshi(now);
  if (davr === "bugun") return kunBoshi;

  const siljigan = new Date(now.getTime() + TOSHKENT_OFFSET_MS);
  if (davr === "oy") {
    const oyBoshi = Date.UTC(siljigan.getUTCFullYear(), siljigan.getUTCMonth(), 1);
    return new Date(oyBoshi - TOSHKENT_OFFSET_MS);
  }
  // Hafta: dushanbagacha necha kun orqaga qaytish kerak (yakshanba = 6 kun).
  const haftaKuni = (siljigan.getUTCDay() + 6) % 7;
  return new Date(kunBoshi.getTime() - haftaKuni * 24 * 60 * 60 * 1000);
}

/**
 * "YYYY-MM-DD" oralig'i → UTC chegaralari. `gacha` INKLYUZIV (o'sha kunning
 * oxirigacha), foydalanuvchi "17-dan 19-gacha" deganda 19-kun ham kiradi.
 * Noto'g'ri yoki teskari oraliq — `null` (chaqiruvchi odatdagi davrga qaytadi).
 */
export function oraliqChegaralari(
  dan: string | undefined | null,
  gacha: string | undefined | null
): { boshlanish: Date; tugash: Date } | null {
  const naqsh = /^\d{4}-\d{2}-\d{2}$/;
  if (!dan || !gacha || !naqsh.test(dan) || !naqsh.test(gacha)) return null;
  const boshlanish = new Date(Date.parse(`${dan}T00:00:00Z`) - TOSHKENT_OFFSET_MS);
  const tugash = new Date(Date.parse(`${gacha}T00:00:00Z`) - TOSHKENT_OFFSET_MS + 24 * 60 * 60 * 1000);
  if (Number.isNaN(boshlanish.getTime()) || Number.isNaN(tugash.getTime())) return null;
  if (tugash <= boshlanish) return null;
  return { boshlanish, tugash };
}
