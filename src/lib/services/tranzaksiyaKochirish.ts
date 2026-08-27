import { prisma } from "@/lib/prisma";
import { kategoriyaIdTop } from "@/lib/kategoriyaNom";
import { kunlikBulkUz } from "@/lib/services/kunlik";

/**
 * YOZUVLARNI BIZNESDAN BIZNESGA KO'CHIRISH (bulk-move).
 *
 * Ilgari bu mantiq route ichida edi va faqat `businessId` + `categoryId`
 * yangilanardi. `accountId` esa ESKI biznes kassasiga ishora qilib
 * qolaverardi. Oqibati ikki tomonlama xato edi:
 *   - manba biznes: ko'chirilgan chiqim uning kassa ledgeridan yo'qoladi va
 *     kassa qoldig'i sababsiz KO'TARILIB qoladi (pul allaqachon sarflangan
 *     bo'lsa ham dashboardda turaveradi);
 *   - maqsad biznes: yozuv begona kassaga bog'langani uchun uning kassa
 *     qoldig'ida umuman qatnashmaydi.
 *
 * Endi har yozuv maqsad biznesning MOS kassasiga qayta bog'lanadi.
 */

/**
 * Kassa turi mosligi — `resolveAccountId` bilan bir xil oila qoidasi:
 * naqd pul naqd kassaga, naqdsiz pul plastik/bank kassaga tushadi.
 */
const TUR_OILASI: Record<string, string[]> = {
  naqd: ["naqd"],
  plastik: ["plastik", "bank"],
  bank: ["bank", "plastik"],
};

interface MaqsadKassa {
  id: string;
  turi: string;
}

/**
 * Ko'chirilayotgan yozuv uchun maqsad biznes kassasi.
 *
 * Qarz yozuvi kassaga bog'lanmaydi (pul yo'q). Kassasiz eski yozuv kassasiz
 * qoladi. Qolganlarga avval bir xil turdagi (oilaviy moslikda) kassa, u
 * bo'lmasa birinchi faol kassa olinadi — maqsad biznesda umuman faol kassa
 * bo'lmasa yozuv kassasiz qoladi (ledgerga kirmasligi ko'rinib turadi).
 */
function maqsadKassaTanla(
  yozuv: { accountId: string | null; tolovTuri: string | null; kassaTuri: string | null },
  maqsadKassalar: MaqsadKassa[]
): string | null {
  if (yozuv.tolovTuri === "qarz") return null;
  if (!yozuv.accountId) return null;
  const oila = yozuv.kassaTuri ? TUR_OILASI[yozuv.kassaTuri] ?? [yozuv.kassaTuri] : [];
  for (const turi of oila) {
    const mos = maqsadKassalar.find((k) => k.turi === turi);
    if (mos) return mos.id;
  }
  return maqsadKassalar[0]?.id ?? null;
}

/**
 * Tanlangan yozuvlarni manba biznesdan maqsad biznesga ko'chiradi.
 * Kategoriya nom+tur bo'yicha maqsad biznesda topiladi yoki yaratiladi,
 * kassa esa yuqoridagi qoida bilan qayta bog'lanadi. Qaytaradi: nechta
 * yozuv ko'chdi.
 */
export async function tranzaksiyalarniKochir(
  sourceBusinessId: string,
  targetBusinessId: string,
  ids: string[]
): Promise<number> {
  // Faqat manba biznesdagi, o'chirilmagan tanlangan yozuvlar.
  const txs = await prisma.transaction.findMany({
    where: { id: { in: ids }, businessId: sourceBusinessId, deletedAt: null },
    select: {
      id: true,
      accountId: true,
      tolovTuri: true,
      category: { select: { nomi: true, turi: true } },
      account: { select: { turi: true } },
    },
  });

  // Maqsad biznes kassalari — tanlash tartibi yozish qatlami bilan bir xil.
  const maqsadKassalar = await prisma.account.findMany({
    where: { businessId: targetBusinessId, isActive: true },
    select: { id: true, turi: true },
    orderBy: [{ tartib: "asc" }, { createdAt: "asc" }],
  });

  // Kategoriya keshi: "nomi::turi" -> maqsad kategoriya id.
  const catCache = new Map<string, string>();
  async function targetCategoryId(nomi: string, turi: string): Promise<string> {
    const key = `${nomi}::${turi}`;
    const cached = catCache.get(key);
    if (cached) return cached;
    // Registrga BEFARQ moslash: maqsad biznesda "bantik" bo'lsa, "Bantik"
    // qayta yaratilmaydi. Yaratish `upsert` — parallel ko'chirishda dublikat
    // kategoriya paydo bo'lmasin.
    const id = await kategoriyaIdTop(
      () =>
        prisma.category.findMany({
          where: { businessId: targetBusinessId, turi },
          select: { id: true, nomi: true },
        }),
      () =>
        prisma.category.upsert({
          where: { nomi_turi_businessId: { nomi, turi, businessId: targetBusinessId } },
          update: {},
          create: { businessId: targetBusinessId, nomi, turi },
          select: { id: true },
        }),
      nomi
    );
    catCache.set(key, id);
    return id;
  }

  // Yozuvlar (kategoriya, kassa) juftligi bo'yicha guruhlanadi va har guruh
  // bitta `updateMany` bilan ko'chiriladi (N+1 emas, 500 tagacha yozuv).
  const guruhlar = new Map<string, { catId: string; accountId: string | null; ids: string[] }>();
  for (const t of txs) {
    const catId = await targetCategoryId(t.category.nomi, t.category.turi);
    const accountId = maqsadKassaTanla(
      { accountId: t.accountId, tolovTuri: t.tolovTuri, kassaTuri: t.account?.turi ?? null },
      maqsadKassalar
    );
    const key = `${catId}::${accountId ?? ""}`;
    const guruh = guruhlar.get(key);
    if (guruh) guruh.ids.push(t.id);
    else guruhlar.set(key, { catId, accountId, ids: [t.id] });
  }

  let moved = 0;
  for (const { catId, accountId, ids: txIds } of guruhlar.values()) {
    const res = await prisma.transaction.updateMany({
      where: { id: { in: txIds }, businessId: sourceBusinessId, deletedAt: null },
      data: { businessId: targetBusinessId, categoryId: catId, accountId },
    });
    moved += res.count;
  }

  // Boshqa biznesga ko'chgan yozuv manba biznes kunligidan chiqadi
  // (kunlik — pul tushgan biznesning ko'zgusi).
  await kunlikBulkUz(
    sourceBusinessId,
    txs.map((t) => t.id)
  );

  return moved;
}
