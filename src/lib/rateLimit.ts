import { rawPrisma } from "@/lib/db/rawPrisma";

/**
 * RATE LIMIT — BAZA ASOSIDA (S-3).
 *
 * Muammo: eski variant hisoblagichni xotirada (`Map`) saqlardi. Vercel'da har
 * lambda instansiyasi alohida xotiraga ega — hujumchi parallel so'rov yuborsa
 * har biri yangi instansiyaga tushib, brute-force amalda cheklanmasdi.
 *
 * Yechim: hisoblagich `AppSetting` jadvalida, kalit ichida VAQT OYNASI raqami
 * bilan (`rl:{key}:{oyna}`) — oyna o'tishi bilan hisoblagich o'z-o'zidan
 * nolga qaytadi, alohida "tozalash" mantig'i kerak emas.
 *
 * ATOMIKLIK: `UPDATE ... SET value = value + 1` bitta SQL amalida bajariladi,
 * shuning uchun parallel so'rovlar hisoblagichni "o'g'irlab" ketolmaydi
 * (read → write poygasi yo'q).
 *
 * `rawPrisma` ishlatiladi: rate limit login/signup'dan OLDIN ishlaydi, ya'ni
 * tenant konteksti hali mavjud emas (CLAUDE.md da ruxsat etilgan holat).
 */

export interface RateLimitNatija {
  ok: boolean;
  /** Limit oshgan bo'lsa — necha soniyadan keyin qayta urinish mumkin. */
  retryAfter: number;
}

/**
 * Kalit + joriy vaqt oynasi.
 * Format: `rl:{key}:{windowMs}:{oyna}` — oyna uzunligi kalitda bo'lgani uchun
 * tozalashda yozuvning haqiqiy tugash vaqtini hisoblab bo'ladi.
 */
function oynaKaliti(key: string, windowMs: number): { kalit: string; tugash: number } {
  const oyna = Math.floor(Date.now() / windowMs);
  return { kalit: `rl:${key}:${windowMs}:${oyna}`, tugash: (oyna + 1) * windowMs };
}

/**
 * Hisoblagichni bittaga oshiradi va limitdan oshganini qaytaradi.
 *
 * Baza xatosi bo'lsa so'rov O'TKAZILADI (fail-open): rate limit yordamchi
 * himoya qatlami — u tufayli mijoz tizimga kira olmay qolmasligi kerak.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitNatija> {
  const { kalit, tugash } = oynaKaliti(key, windowMs);
  const retryAfter = Math.max(1, Math.ceil((tugash - Date.now()) / 1000));

  try {
    // Atomik oshirish + O'Z natijasini olish. `RETURNING` shart: keyin alohida
    // SELECT qilinsa, parallel so'rovlar HAMMASI oxirgi (yig'ilgan) qiymatni
    // o'qib qolardi va 10 tadan faqat 1 tasi o'tardi.
    const oshirilgan = await rawPrisma.$queryRaw<Array<{ value: string }>>`
      UPDATE "AppSetting" SET "value" = CAST(CAST("value" AS INTEGER) + 1 AS TEXT)
      WHERE "key" = ${kalit}
      RETURNING "value"
    `;

    let soni: number;
    if (oshirilgan.length > 0) {
      soni = Number(oshirilgan[0].value);
    } else {
      try {
        await rawPrisma.appSetting.create({ data: { key: kalit, value: "1" } });
        soni = 1;
      } catch {
        // Poyga: boshqa so'rov ayni paytda yaratib ulgurdi — endi oshiramiz.
        const qayta = await rawPrisma.$queryRaw<Array<{ value: string }>>`
          UPDATE "AppSetting" SET "value" = CAST(CAST("value" AS INTEGER) + 1 AS TEXT)
          WHERE "key" = ${kalit}
          RETURNING "value"
        `;
        soni = Number(qayta[0]?.value ?? "1");
      }
    }

    if (soni > limit) return { ok: false, retryAfter };
    return { ok: true, retryAfter: 0 };
  } catch (error) {
    console.error("Rate limit xatosi (so'rov o'tkazildi):", error);
    return { ok: true, retryAfter: 0 };
  }
}

/** Muvaffaqiyatli amaldan keyin hisoblagichni tozalaydi (masalan to'g'ri login). */
export async function rateLimitReset(key: string, windowMs: number): Promise<void> {
  const { kalit } = oynaKaliti(key, windowMs);
  try {
    await rawPrisma.appSetting.deleteMany({ where: { key: kalit } });
  } catch (error) {
    console.error("Rate limit tozalash xatosi:", error);
  }
}

/**
 * Eskirgan rate limit yozuvlarini tozalash (cron'da kuniga bir marta).
 * Oyna kaliti vaqtga bog'liq — o'tgan oynalar hech qachon qayta
 * ishlatilmaydi, faqat joy egallaydi.
 */
export async function cleanupRateLimits(): Promise<number> {
  const hozir = Date.now();
  try {
    const yozuvlar = await rawPrisma.appSetting.findMany({
      where: { key: { startsWith: "rl:" } },
      select: { key: true },
    });
    const ochiriladi = yozuvlar
      .map((r) => r.key)
      .filter((k) => {
        const qismlar = k.split(":");
        const oyna = Number(qismlar[qismlar.length - 1]);
        const windowMs = Number(qismlar[qismlar.length - 2]);
        if (!Number.isFinite(oyna) || !Number.isFinite(windowMs) || windowMs <= 0) return false;
        // Oyna allaqachon tugagan — yozuv boshqa hech qachon ishlatilmaydi.
        return (oyna + 1) * windowMs < hozir;
      });
    if (ochiriladi.length === 0) return 0;
    const res = await rawPrisma.appSetting.deleteMany({ where: { key: { in: ochiriladi } } });
    return res.count;
  } catch (error) {
    console.error("Rate limit tozalash xatosi:", error);
    return 0;
  }
}
