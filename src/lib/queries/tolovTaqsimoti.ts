import { prisma } from "@/lib/prisma";
import { monthRangeUTC } from "@/lib/date";
import {
  TOLOV_BOLIMLARI,
  TOLOV_BOLIMI_NOMI,
  TOLOV_BOLIMI_BELGI,
  amaldagiBolim,
  type TolovBolimi,
} from "@/lib/tolovBolimi";
import type { Prisma } from "@prisma/client";

/**
 * "Jami kirim/chiqim" kartasi ichidagi TO'LOV TAQSIMOTI (jamlash qismi).
 *
 * Bo'limga biriktirish qoidasi va ro'yxat filtri `lib/tolovBolimi.ts` da —
 * u toza (bazasiz) modul, shuning uchun brauzer komponentlari ham o'sha
 * yerdan o'qiydi va qoida ikki nusxaga bo'linib ketmaydi.
 */

export interface TolovBolimiDTO {
  kod: TolovBolimi;
  nomi: string;
  belgi: string;
  summa: number;
  /** Jamiga nisbatan foiz (jami 0 bo'lsa — 0). */
  foiz: number;
  soni: number;
}

export interface TolovTaqsimotiDTO {
  /** "kirim" | "chiqim". */
  turi: string;
  /** Bo'limlar YIG'INDISI — bosh sahifadagi karta summasi bilan teng. */
  jami: number;
  /** Summasi noldan katta bo'limlar, kattadan kichikka. */
  bolimlar: TolovBolimiDTO[];
  /**
   * Qarzga yozilgan savdo (faqat kirimda bo'ladi). Jamiga KIRMAYDI —
   * ekranda alohida eslatma sifatida ko'rsatiladi.
   */
  qarz: number;
}

/**
 * Oylik to'lov taqsimoti — bitta `groupBy` va bitta kichik kassa so'rovi.
 *
 * Baza to'plami `getMonthSummary` bilan AYNI: shu biznes, o'chirilmagan,
 * tanlangan oy, qarzsiz. Shuning uchun `jami` kartadagi raqamga teng
 * chiqadi (test buni majburlaydi).
 */
export async function getTolovTaqsimoti(
  businessId: string,
  monthStr: string,
  turi: "kirim" | "chiqim"
): Promise<TolovTaqsimotiDTO> {
  const { from, to } = monthRangeUTC(monthStr);
  const asos: Prisma.TransactionWhereInput = {
    businessId,
    turi,
    deletedAt: null,
    sana: { gte: from, lt: to },
  };

  const [guruhlar, kassalar] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["tolovTuri", "accountId"],
      where: asos,
      _sum: { summa: true },
      _count: { _all: true },
    }),
    prisma.account.findMany({
      where: { businessId },
      select: { id: true, turi: true },
    }),
  ]);

  const kassaTuri = new Map(kassalar.map((k) => [k.id, k.turi]));
  const jamlanma = new Map<TolovBolimi, { summa: number; soni: number }>();
  let qarz = 0;

  for (const g of guruhlar) {
    const summa = g._sum.summa ?? 0;
    const bolim = amaldagiBolim(
      g.tolovTuri,
      g.accountId ? kassaTuri.get(g.accountId) ?? null : null
    );
    if (bolim === null) {
      qarz += summa;
      continue;
    }
    const oldingi = jamlanma.get(bolim) ?? { summa: 0, soni: 0 };
    jamlanma.set(bolim, {
      summa: oldingi.summa + summa,
      soni: oldingi.soni + g._count._all,
    });
  }

  const jami = Array.from(jamlanma.values()).reduce((a, b) => a + b.summa, 0);

  const bolimlar = TOLOV_BOLIMLARI.filter((k) => (jamlanma.get(k)?.summa ?? 0) > 0)
    .map((kod) => {
      const v = jamlanma.get(kod)!;
      return {
        kod,
        nomi: TOLOV_BOLIMI_NOMI[kod],
        belgi: TOLOV_BOLIMI_BELGI[kod],
        summa: v.summa,
        foiz: jami > 0 ? (v.summa / jami) * 100 : 0,
        soni: v.soni,
      };
    })
    .sort((a, b) => b.summa - a.summa);

  return { turi, jami, bolimlar, qarz };
}
