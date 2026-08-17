import { prisma } from "@/lib/prisma";
import { getAccountBalances, getKassaKunlik, type AccountQoldiq } from "@/lib/queries/accounts";
import { toshkentBugunBoshi } from "@/lib/services/kassirKassa";

/**
 * BITTA KASSANING DETALI — qoldiq, bugungi kesim va HARAKATLAR TARIXI.
 *
 * Harakat — kassadagi pulni o'zgartirgan har qanday voqea. Uch manbadan
 * yig'iladi va bitta vaqt o'qiga tiziladi:
 *   1. kirim tranzaksiyalari (savdo, qarz to'lovi, boshqa kirim);
 *   2. chiqim tranzaksiyalari (xarajat);
 *   3. o'tkazmalar (kirgan va chiqqan).
 *
 * Faqat YAKUNLANGAN o'tkazmalar tarixga kiradi (`bajarildi` / `bekor`):
 * tasdiq kutayotgani hali pulni ko'chirmagan va alohida panelda ko'rinadi.
 */
export interface KassaHarakat {
  id: string;
  /** "kirim" | "chiqim" | "transfer-kirgan" | "transfer-chiqqan" */
  turi: string;
  /** Qoldiqqa ta'siri: musbat — qo'shildi, manfiy — ayrildi. */
  summa: number;
  /** Ekranda ko'rinadigan izoh: "Savdo", "Javlonga o'tkazildi", "Xarajat". */
  matn: string;
  /** Ikkinchi tomon (o'tkazmalarda) — "Javlon → Murod" ko'rinishi uchun. */
  qarshiTomon: string | null;
  vaqt: string;
}

export interface KassaDetal {
  kassa: AccountQoldiq;
  bugungiKirim: number;
  bugungiChiqim: number;
  harakatlar: KassaHarakat[];
}

export async function getKassaDetal(
  businessId: string,
  accountId: string,
  limit = 50
): Promise<KassaDetal | null> {
  const bugun = toshkentBugunBoshi();

  const [qoldiqlar, kunlik, tranzaksiyalar, transferlar] = await Promise.all([
    getAccountBalances(businessId),
    getKassaKunlik(businessId, bugun),
    prisma.transaction.findMany({
      where: { businessId, accountId, deletedAt: null },
      select: {
        id: true,
        turi: true,
        summa: true,
        izoh: true,
        createdAt: true,
        category: { select: { nomi: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.accountTransfer.findMany({
      where: {
        businessId,
        holat: { in: ["bajarildi", "bekor"] },
        OR: [{ fromAccountId: accountId }, { toAccountId: accountId }],
      },
      include: {
        fromAccount: { select: { nomi: true } },
        toAccount: { select: { nomi: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);

  const kassa = qoldiqlar.find((q) => q.id === accountId);
  if (!kassa) return null;

  const harakatlar: KassaHarakat[] = [
    ...tranzaksiyalar.map((t) => ({
      id: t.id,
      turi: t.turi,
      summa: t.turi === "kirim" ? t.summa : -t.summa,
      matn: t.izoh?.trim() || t.category?.nomi || (t.turi === "kirim" ? "Kirim" : "Chiqim"),
      qarshiTomon: null,
      vaqt: t.createdAt.toISOString(),
    })),
    ...transferlar.map((tr) => {
      const chiqqan = tr.fromAccountId === accountId;
      const qarshi = chiqqan ? tr.toAccount.nomi : tr.fromAccount.nomi;
      return {
        id: tr.id,
        turi: chiqqan ? "transfer-chiqqan" : "transfer-kirgan",
        summa: chiqqan ? -tr.summa : tr.summa,
        matn: chiqqan ? `${qarshi}ga o'tkazildi` : `${qarshi}dan qabul qilindi`,
        qarshiTomon: qarshi,
        vaqt: tr.createdAt.toISOString(),
      };
    }),
  ]
    .sort((a, b) => (a.vaqt < b.vaqt ? 1 : -1))
    .slice(0, limit);

  const bugungi = kunlik.get(accountId) ?? { kirim: 0, chiqim: 0 };
  return {
    kassa,
    bugungiKirim: bugungi.kirim,
    bugungiChiqim: bugungi.chiqim,
    harakatlar,
  };
}
