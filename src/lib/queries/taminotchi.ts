import { prisma } from "@/lib/prisma";
import { qarzdorKalit } from "@/lib/queries/qarz";
import { listTaminotlar, type TaminotRoyxatDTO } from "@/lib/queries/ombor";

/**
 * TA'MINOTCHI PROFILI — "bu ta'minotchi bilan hisob-kitobimiz qanday?"
 *
 * Barcha raqamlar MAVJUD jadvallardan hisoblanadi, saqlangan ikkinchi
 * hisob YO'Q: `PurchaseOrder` (ta'minot va to'langan qism) va `Debt`
 * (qolgan qarz). Ta'minotchining qarzi `PurchaseOrder.debtId` orqali
 * topiladi — ta'minotdan tug'ilgan qarzning yagona bog'lanishi shu.
 *
 * NEGA `Debt` ga `supplierId` QO'SHILMADI: ta'minot qarzi allaqachon
 * buyurtma orqali bog'langan va "Men qarzdorman" bo'limi qarzlarni ISM
 * bo'yicha birlashtiradi (`qarzdorKalit`). Ikkinchi bog'lanish qo'shish
 * ikki manba yaratardi — biri yangilanib, ikkinchisi eskirardi.
 */
export interface TaminotchiProfilDTO {
  id: string;
  nomi: string;
  tel: string | null;
  manzil: string | null;
  izoh: string | null;
  isActive: boolean;
  /** "Men qarzdorman" bo'limidagi to'lov uchun kalit ("ism:..."). */
  qarzKalit: string;
  /** Qabul qilingan ta'minotlar jami summasi. */
  jamiTaminot: number;
  /** Ta'minot paytida darhol to'langan qism (naqd/karta). */
  jamiTolangan: number;
  /** Qarzga olingan jami summa (ta'minot paytida to'lanmagan qism). */
  jamiQarz: number;
  /** Shundan hali to'lanmagani — bugungi qarzimiz. */
  qolganQarz: number;
  /** Qarzga olingandan keyin qilingan to'lovlar (jamiQarz − qolganQarz). */
  qarzTolovlari: number;
  /** Qabul qilingan ta'minotlar soni. */
  taminotSoni: number;
  /** Oxirgi ta'minot sanasi (ISO) — hech biri bo'lmasa null. */
  oxirgiTaminot: string | null;
}

export async function taminotchiProfil(
  businessId: string,
  supplierId: string
): Promise<{ profil: TaminotchiProfilDTO; tarix: TaminotRoyxatDTO } | null> {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, businessId, deletedAt: null },
  });
  if (!supplier) return null;

  const qabulQilinganlar = {
    businessId,
    supplierId,
    holat: "qabul_qilingan",
  };

  const [jamlar, oxirgi, qarzlar, tarix] = await Promise.all([
    prisma.purchaseOrder.aggregate({
      where: qabulQilinganlar,
      _sum: { jamiSumma: true, tolanganSumma: true },
      _count: { _all: true },
    }),
    prisma.purchaseOrder.findFirst({
      where: qabulQilinganlar,
      orderBy: [{ qabulSana: "desc" }, { sana: "desc" }, { createdAt: "desc" }],
      select: { qabulSana: true, sana: true },
    }),
    // Ta'minotdan tug'ilgan qarzlar — buyurtma orqali. Bekor qilingan qarz
    // (status "CANCELLED") qoldiqqa kirmaydi: u endi to'lanmaydi.
    prisma.purchaseOrder.findMany({
      where: { ...qabulQilinganlar, debtId: { not: null } },
      select: { debtId: true },
    }),
    listTaminotlar(businessId, { supplierId, sahifa: 1, limit: 50 }),
  ]);

  const debtIds = qarzlar.map((o) => o.debtId!).filter(Boolean);
  const qarzQoldigi = debtIds.length
    ? await prisma.debt.aggregate({
        where: { businessId, id: { in: debtIds }, status: { not: "CANCELLED" } },
        _sum: { jamiSumma: true, tolangan: true },
      })
    : null;

  const jamiTaminot = jamlar._sum.jamiSumma ?? 0;
  const jamiTolangan = jamlar._sum.tolanganSumma ?? 0;
  const jamiQarz = Math.max(0, jamiTaminot - jamiTolangan);
  const qolganQarz = Math.max(
    0,
    (qarzQoldigi?._sum.jamiSumma ?? 0) - (qarzQoldigi?._sum.tolangan ?? 0)
  );

  return {
    profil: {
      id: supplier.id,
      nomi: supplier.nomi,
      tel: supplier.tel,
      manzil: supplier.manzil,
      izoh: supplier.izoh,
      isActive: supplier.isActive,
      qarzKalit: qarzdorKalit(null, supplier.nomi),
      jamiTaminot,
      jamiTolangan,
      jamiQarz,
      qolganQarz,
      qarzTolovlari: Math.max(0, jamiQarz - qolganQarz),
      taminotSoni: jamlar._count._all,
      oxirgiTaminot: oxirgi ? (oxirgi.qabulSana ?? oxirgi.sana).toISOString() : null,
    },
    tarix,
  };
}
