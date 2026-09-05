import { prisma } from "@/lib/prisma";
import { qidiruvRejimi } from "@/lib/db/dialect";
import { listTransactions, type TransactionListParams } from "@/lib/queries/transactions";
import { tolovGuruhi } from "@/lib/tolovBolimi";
import { isPulUsuli, type PulUsuli } from "@/lib/moliya/usul";
import { isShaxsTuri, type ShaxsTuri } from "@/lib/moliya/shaxs";

/**
 * MOLIYA BO'LIMI SO'ROVLARI.
 *
 * Ro'yxat MAVJUD `listTransactions` ustiga qurilgan — ikkinchi, parallel
 * "moliya ro'yxati" so'rovi yozilmaydi: filtr, ko'rinuvchanlik chegarasi,
 * sahifalash va jamlar qoidasi bitta joyda qolishi kerak (aks holda Moliya
 * sahifasi va Kirim/Chiqim sahifasi bir davr uchun ikki xil raqam ko'rsatib
 * qolardi).
 *
 * BIR AMAL — BIR NECHA QATOR bo'lishi mumkin: qarz to'lovi bir necha qarzga
 * taqsimlansa har qarz uchun alohida kirim yoziladi (kategoriya kesimi
 * saqlansin — lib/services/qarz.ts). Ro'yxat ularni jamlab yubormaydi: har
 * qator o'z kategoriyasi bilan ko'rinadi, `amalId` esa ularni bog'lab
 * turadi — tuzatish va bekor qilish butun amalga birdan tegadi.
 */

export interface PulHarakatiDTO {
  id: string;
  /** Amal kaliti — tahrirlash va bekor qilish shu bo'yicha ishlaydi. */
  amalId: string | null;
  yonalish: string;
  summa: number;
  /** ISO — yozuv sanasi (pul kelgan/ketgan kun). */
  sana: string;
  createdAt: string;
  categoryId: string;
  /** Sabab = kategoriya nomi. */
  sabab: string;
  shaxsTuri: ShaxsTuri | null;
  shaxsId: string | null;
  shaxsIsm: string | null;
  /** Tanlangan usul; eski yozuvlarda `tolovTuri`+kassa turidan chiqariladi. */
  usul: PulUsuli;
  kassaId: string | null;
  kassaNomi: string | null;
  kiritganId: string;
  kiritgan: string;
  izoh: string | null;
  /** Qarz to'lovi bilan bog'liq (bekor qilinsa qarz qoldig'i qaytadi). */
  qarzBogliq: boolean;
  /**
   * Moliya oqimidan tahrirlanadimi. Sotuv, oylik, xarid va CRM yozuvlarida
   * `amalId` yo'q — ular O'Z modulidan tuzatiladi, aks holda ombor yoki
   * buyurtma bilan pul bir-biriga zid bo'lib qolardi.
   */
  tahrirlanadi: boolean;
}

/** Eski (usulsiz) yozuv uchun usulni mavjud to'lov guruhidan chiqaradi. */
function usulniChiqar(
  pulUsuli: string | null,
  tolovTuri: string | null,
  kassaTuri: string | null | undefined
): PulUsuli {
  if (isPulUsuli(pulUsuli)) return pulUsuli;
  const guruh = tolovGuruhi(tolovTuri, kassaTuri);
  if (guruh === "naqd" || guruh === "qarz") return "naqd";
  if (guruh === "karta") return kassaTuri === "bank" ? "otkazma" : "terminal";
  return "click";
}

export interface PulHarakatiRoyxati {
  items: PulHarakatiDTO[];
  total: number;
  page: number;
  pageSize: number;
  /** `listTransactions` jamlari — huquqi bo'lmaganda chaqiruvchi olib tashlaydi. */
  totals: Awaited<ReturnType<typeof listTransactions>>["totals"];
}

export async function listPulHarakatlari(
  params: TransactionListParams
): Promise<PulHarakatiRoyxati> {
  const natija = await listTransactions(params);

  // QARZ BOG'LIQLIGI: shu sahifadagi yozuvlarga to'lov yozuvi tegishlimi.
  // Bitta so'rov — sahifadagi IDlar bo'yicha (yozuv soni cheklangan).
  const idlar = natija.items.map((t) => t.id);
  const qarzli = idlar.length
    ? new Set(
        (
          await prisma.debtPayment.findMany({
            where: { businessId: params.businessId, transactionId: { in: idlar } },
            select: { transactionId: true },
          })
        ).map((p) => p.transactionId as string)
      )
    : new Set<string>();

  return {
    items: natija.items.map((t) => ({
      id: t.id,
      amalId: t.amalId,
      yonalish: t.turi,
      summa: t.summa,
      sana: t.sana.toISOString(),
      createdAt: t.createdAt.toISOString(),
      categoryId: t.categoryId,
      sabab: t.category.nomi,
      shaxsTuri: isShaxsTuri(t.shaxsTuri) ? t.shaxsTuri : null,
      shaxsId: t.shaxsId,
      shaxsIsm: t.shaxsIsm,
      usul: usulniChiqar(t.pulUsuli, t.tolovTuri, t.account?.turi),
      kassaId: t.account?.id ?? null,
      kassaNomi: t.account?.nomi ?? null,
      kiritganId: t.user.id,
      kiritgan: t.user.ism,
      izoh: t.izoh,
      qarzBogliq: qarzli.has(t.id),
      tahrirlanadi: Boolean(t.amalId),
    })),
    total: natija.total,
    page: natija.page,
    pageSize: natija.pageSize,
    totals: natija.totals,
  };
}

// ---------------------------------------------------------------------------
// Tomon (shaxs) qidiruvi
// ---------------------------------------------------------------------------

export interface ShaxsTaklif {
  turi: ShaxsTuri;
  id: string;
  ism: string;
  tavsif: string | null;
  /** Shu tomonning ochiq qarzi (so'm) — formada darhol ko'rinadi. */
  qarz: number;
}

const QIDIRUV_LIMITI = 12;

/**
 * TOMON QIDIRUVI — mijoz, ta'minotchi yoki xodim bo'yicha.
 *
 * Manba jadvallar BIRLASHTIRILMAYDI (lib/moliya/shaxs.ts): har tur o'z
 * jadvalidan qidiriladi, natija esa bitta ro'yxat bo'lib qaytadi. Har
 * taklif yonida uning JORIY QARZI ko'rinadi — kassir kimni tanlayotganini
 * ro'yxatning o'zidayoq ko'radi.
 */
export async function shaxsQidiruv(
  businessId: string,
  turi: ShaxsTuri,
  q: string | null
): Promise<ShaxsTaklif[]> {
  const matn = (q ?? "").trim();
  const qidir = matn ? { contains: matn, ...qidiruvRejimi() } : undefined;

  if (turi === "mijoz") {
    const rows = await prisma.contact.findMany({
      where: {
        businessId,
        deletedAt: null,
        ...(qidir ? { OR: [{ ism: qidir }, { tel: qidir }] } : {}),
      },
      select: { id: true, ism: true, tel: true },
      orderBy: { ism: "asc" },
      take: QIDIRUV_LIMITI,
    });
    const qarzlar = await qarzXaritasi(businessId, "olinadigan", rows.map((r) => r.id), null);
    return rows.map((r) => ({
      turi,
      id: r.id,
      ism: r.ism,
      tavsif: r.tel,
      qarz: qarzlar.get(`contact:${r.id}`) ?? 0,
    }));
  }

  if (turi === "taminotchi") {
    const rows = await prisma.supplier.findMany({
      where: {
        businessId,
        deletedAt: null,
        isActive: true,
        ...(qidir ? { OR: [{ nomi: qidir }, { tel: qidir }] } : {}),
      },
      select: { id: true, nomi: true, tel: true },
      orderBy: { nomi: "asc" },
      take: QIDIRUV_LIMITI,
    });
    // Ta'minotchi qarzi kartochkaga bog'lanmaydi (Debt.contactId null) —
    // u ISM bo'yicha jamlanadi, `qarzdorKalit` bilan bir xil qoida.
    const qarzlar = await qarzXaritasi(businessId, "beriladigan", [], rows.map((r) => r.nomi));
    return rows.map((r) => ({
      turi,
      id: r.id,
      ism: r.nomi,
      tavsif: r.tel,
      qarz: qarzlar.get(`ism:${r.nomi.trim().toLowerCase()}`) ?? 0,
    }));
  }

  // Xodim — tenant chegarasi tenant-scoped `prisma` da, biznes chegarasi shu
  // yerda (lib/services/sotuvchi.ts bilan bir xil o'qish).
  const rows = await prisma.user.findMany({
    where: {
      isActive: true,
      rol: { not: "SUPERADMIN" },
      OR: [{ bizneslar: { none: {} } }, { bizneslar: { some: { businessId } } }],
      ...(qidir ? { ism: qidir } : {}),
    },
    select: { id: true, ism: true, rol: true },
    orderBy: { ism: "asc" },
    take: QIDIRUV_LIMITI,
  });
  const olinadigan = await qarzXaritasi(businessId, "olinadigan", [], rows.map((r) => r.ism));
  return rows.map((r) => ({
    turi,
    id: r.id,
    ism: r.ism,
    tavsif: r.rol,
    qarz: olinadigan.get(`ism:${r.ism.trim().toLowerCase()}`) ?? 0,
  }));
}

/**
 * Berilgan kartochkalar va ismlar bo'yicha ochiq qarz qoldig'i.
 * Kalit — `qarzdorKalit()` formati ("contact:<id>" yoki "ism:<kichik harf>").
 */
async function qarzXaritasi(
  businessId: string,
  turi: "olinadigan" | "beriladigan",
  contactIds: string[],
  ismlar: string[] | null
): Promise<Map<string, number>> {
  const xarita = new Map<string, number>();
  if (contactIds.length === 0 && !ismlar?.length) return xarita;

  const rows = await prisma.debt.findMany({
    where: {
      businessId,
      turi,
      isYopilgan: false,
      status: { not: "CANCELLED" },
      ...(contactIds.length ? { contactId: { in: contactIds } } : { contactId: null }),
    },
    select: { contactId: true, mijozNomi: true, jamiSumma: true, tolangan: true },
  });

  const kerakli = ismlar ? new Set(ismlar.map((i) => i.trim().toLowerCase())) : null;
  for (const d of rows) {
    const qoldiq = d.jamiSumma - d.tolangan;
    if (qoldiq <= 0) continue;
    if (d.contactId) {
      const k = `contact:${d.contactId}`;
      xarita.set(k, (xarita.get(k) ?? 0) + qoldiq);
      continue;
    }
    const nom = d.mijozNomi.trim().toLowerCase();
    if (kerakli && !kerakli.has(nom)) continue;
    const k = `ism:${nom}`;
    xarita.set(k, (xarita.get(k) ?? 0) + qoldiq);
  }
  return xarita;
}
