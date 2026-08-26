import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { runBusinessTx } from "@/lib/db/businessTx";
import { logAudit } from "@/lib/services/audit";

/**
 * KATALOGNI TOZALASH — tanlangan kategoriyalardan BOSHQA tovarlarni o'chirish.
 *
 * Nima uchun kerak: import ba'zan keraksiz tovarlarni ham olib keladi
 * (masalan, eski dasturning butun bazasi). Ularni bittalab o'chirish yuzlab
 * bosish degani.
 *
 * Asosiy qarorlar:
 *
 *  1. TARIXI BOR TOVAR O'CHIRILMAYDI — NOFAOL bo'ladi. Sotuv, kirim,
 *     inventarizatsiya yoki xarid yozuvi bor tovarni o'chirish hisobotlarni
 *     teshik qilib qo'yadi (FK darajasida ham Restrict). Bunday tovar
 *     `isActive: false` bo'lib ro'yxatdan yo'qoladi, tarixi esa saqlanadi.
 *  2. HAMMASI BITTA TRANZAKSIYADA — yarim tozalangan katalog qolmaydi.
 *  3. "Hammasini o'chir" bo'lmaydi — kamida bitta kategoriya saqlanishi
 *     shart (validatsiya qatlamida ham tekshiriladi).
 */

export interface TozalashHisobi {
  /** Butunlay o'chiriladigan (tarixsiz) tovarlar. */
  ochiriladi: number;
  /** Tarixi borligi uchun nofaol qilinadigan tovarlar. */
  nofaolBoladi: number;
  /** Tegilmaydigan (saqlanadigan) tovarlar. */
  qoladi: number;
}

/** O'chirish nomzodlari: saqlanadigan kategoriyalarga KIRMAGAN tovarlar. */
function nomzodShart(
  businessId: string,
  saqlanadigan: string[],
  kategoriyasizSaqlansin: boolean
): Prisma.ProductWhereInput {
  const shartlar: Prisma.ProductWhereInput[] = [];
  if (kategoriyasizSaqlansin) {
    // Kategoriyasiz tovarlar saqlanadi — nomzod faqat kategoriyalilar.
    shartlar.push({ categoryId: { not: null } });
    if (saqlanadigan.length > 0) shartlar.push({ categoryId: { notIn: saqlanadigan } });
  } else {
    // Kategoriyasizlar ham o'chadi. `notIn` NULL qiymatni QAMRAMAYDI,
    // shuning uchun null alohida OR bilan yoziladi.
    shartlar.push({
      OR: [{ categoryId: null }, { categoryId: { notIn: saqlanadigan } }],
    });
  }
  return { businessId, AND: shartlar };
}

/**
 * Qaysi nomzodlarning tarixi bor — shular o'chirilmasdan nofaol bo'ladi.
 * Har so'rovda `businessId` sharti QO'LDA (CLAUDE.md kelishuvi, tx ichida ham).
 */
async function tarixliIdlar(
  db: {
    sale: { findMany: (a: unknown) => Promise<{ productId: string }[]> };
    stockEntry: { findMany: (a: unknown) => Promise<{ productId: string }[]> };
    stockAdjustment: { findMany: (a: unknown) => Promise<{ productId: string }[]> };
    productExpense: { findMany: (a: unknown) => Promise<{ productId: string }[]> };
    purchaseOrderItem: { findMany: (a: unknown) => Promise<{ productId: string }[]> };
  },
  businessId: string,
  idlar: string[]
): Promise<Set<string>> {
  const sorov = {
    where: { businessId, productId: { in: idlar } },
    select: { productId: true },
    distinct: ["productId"],
  };
  const natijalar = await Promise.all([
    db.sale.findMany(sorov),
    db.stockEntry.findMany(sorov),
    db.stockAdjustment.findMany(sorov),
    db.productExpense.findMany(sorov),
    db.purchaseOrderItem.findMany(sorov),
  ]);
  return new Set(natijalar.flat().map((r) => r.productId));
}

/** Oldindan hisob — hech narsa o'zgarmaydi, faqat sonlar. */
export async function tozalashniKorish(params: {
  businessId: string;
  saqlanadiganKategoriyalar: string[];
  kategoriyasizSaqlansin: boolean;
}): Promise<TozalashHisobi> {
  const shart = nomzodShart(
    params.businessId,
    params.saqlanadiganKategoriyalar,
    params.kategoriyasizSaqlansin
  );
  const [jami, nomzodlar] = await Promise.all([
    prisma.product.count({ where: { businessId: params.businessId } }),
    prisma.product.findMany({ where: shart, select: { id: true } }),
  ]);
  const idlar = nomzodlar.map((n) => n.id);
  const tarixli = idlar.length
    ? await tarixliIdlar(
        prisma as unknown as Parameters<typeof tarixliIdlar>[0],
        params.businessId,
        idlar
      )
    : new Set<string>();
  return {
    ochiriladi: idlar.length - tarixli.size,
    nofaolBoladi: tarixli.size,
    qoladi: jami - idlar.length,
  };
}

/** Tozalashni bajaradi — BITTA tranzaksiyada. */
export async function katalogniTozala(params: {
  businessId: string;
  userId: string;
  saqlanadiganKategoriyalar: string[];
  kategoriyasizSaqlansin: boolean;
}): Promise<TozalashHisobi> {
  const natija = await runBusinessTx(params.businessId, async (tx) => {
    const shart = nomzodShart(
      params.businessId,
      params.saqlanadiganKategoriyalar,
      params.kategoriyasizSaqlansin
    );
    const [jami, nomzodlar] = await Promise.all([
      tx.product.count({ where: { businessId: params.businessId } }),
      tx.product.findMany({ where: shart, select: { id: true } }),
    ]);
    const idlar = nomzodlar.map((n) => n.id);
    if (idlar.length === 0) return { ochiriladi: 0, nofaolBoladi: 0, qoladi: jami };

    const tarixli = await tarixliIdlar(
      tx as unknown as Parameters<typeof tarixliIdlar>[0],
      params.businessId,
      idlar
    );
    const ochadiganlar = idlar.filter((id) => !tarixli.has(id));

    if (ochadiganlar.length > 0) {
      // Qarz yozuvlaridagi havola FK darajasida o'zi NULL bo'ladi (SetNull).
      await tx.product.deleteMany({
        where: { businessId: params.businessId, id: { in: ochadiganlar } },
      });
    }
    if (tarixli.size > 0) {
      await tx.product.updateMany({
        where: { businessId: params.businessId, id: { in: [...tarixli] } },
        data: { isActive: false },
      });
    }
    return { ochiriladi: ochadiganlar.length, nofaolBoladi: tarixli.size, qoladi: jami - idlar.length };
  });

  await logAudit({
    businessId: params.businessId,
    action: "delete",
    entity: "product",
    entityId: "katalog-tozalash",
    after: {
      ochirildi: natija.ochiriladi,
      nofaolQilindi: natija.nofaolBoladi,
      qoldi: natija.qoladi,
      saqlanganKategoriyalar: params.saqlanadiganKategoriyalar.length,
    },
  });

  return natija;
}
