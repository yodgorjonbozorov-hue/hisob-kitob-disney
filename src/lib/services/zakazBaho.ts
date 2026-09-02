import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx } from "@/lib/db/businessTx";
import type { ZakazBahoInput } from "@/lib/validation/xodimKategoriya";

/**
 * ZAKAZ SIFAT NAZORATI (24/25-talab).
 *
 * Ikki daraja, ikki joy:
 *  - ZAKAZ darajasi (`DealFeedback`, bir zakazga bitta): umumiy servis
 *    bahosi, mijoz e'tirozi, "nimani yaxshilash kerak";
 *  - XODIM darajasi (`DealEmployee.baho`): aynan shu biriktiruvga baho —
 *    "Videochi: Sardor — 9/10". Xodim profilidagi "O'rtacha baho" shundan
 *    AVG bilan hisoblanadi, hisoblagich saqlanmaydi.
 *
 * Faqat YAKUNLANGAN (YUTILDI) zakaz baholanadi — bajarilmagan ishga baho
 * berilmaydi. Pul yozilmaydi; huquq route qatlamida (`crm.baho`).
 */

export interface ZakazXodimBahoDTO {
  /** DealEmployee.id */
  id: string;
  employeeId: string;
  ism: string;
  kategoriyaNomi: string;
  kategoriyaTuri: string;
  baho: number | null;
  izoh: string | null;
}

export interface ZakazBahoDTO {
  servisBahosi: number | null;
  etiroz: string | null;
  yaxshilash: string | null;
  /** Oxirgi yozilgan vaqt (ISO) — hali baholanmagan bo'lsa null. */
  yozilganAt: string | null;
  xodimlar: ZakazXodimBahoDTO[];
}

/** Zakazning joriy bahosi (tafsilot oynasi uchun). */
export async function zakazBahosi(businessId: string, dealId: string): Promise<ZakazBahoDTO> {
  const [fb, xodimlar] = await Promise.all([
    prisma.dealFeedback.findFirst({ where: { businessId, dealId } }),
    prisma.dealEmployee.findMany({
      where: { businessId, dealId },
      include: {
        category: { select: { nomi: true, turi: true, tartib: true } },
        employee: { select: { ism: true } },
      },
    }),
  ]);
  return {
    servisBahosi: fb?.servisBahosi ?? null,
    etiroz: fb?.etiroz ?? null,
    yaxshilash: fb?.yaxshilash ?? null,
    yozilganAt: fb ? fb.updatedAt.toISOString() : null,
    xodimlar: xodimlar
      .sort((a, b) => a.category.tartib - b.category.tartib || a.employee.ism.localeCompare(b.employee.ism))
      .map((x) => ({
        id: x.id,
        employeeId: x.employeeId,
        ism: x.employee.ism,
        kategoriyaNomi: x.category.nomi,
        kategoriyaTuri: x.category.turi,
        baho: x.baho,
        izoh: x.bahoIzoh,
      })),
  };
}

/**
 * BAHONI SAQLASH — atomik. Berilmagan maydon tegilmaydi; `null` — tozalash.
 * Xodim baholari faqat SHU zakazning SHU biznesdagi biriktiruvlariga
 * yoziladi (id'lar tekshiriladi — begona biriktiruvga baho tushmaydi).
 */
export async function zakazBahosiniSaqlash(params: {
  businessId: string;
  dealId: string;
  userId: string;
  data: ZakazBahoInput;
}): Promise<ZakazBahoDTO> {
  const { businessId, dealId, userId, data } = params;

  const deal = await prisma.deal.findFirst({
    where: { id: dealId, businessId, deletedAt: null },
    select: { id: true, contactId: true, holat: true },
  });
  if (!deal) throw new ForbiddenError("Buyurtma topilmadi");
  if (deal.holat !== "YUTILDI") {
    throw new BadRequestError("Faqat yakunlangan (yutilgan) zakaz baholanadi");
  }

  const xodimBaholari = data.xodimBaholari ?? [];
  if (xodimBaholari.length) {
    const biriktiruvlar = await prisma.dealEmployee.findMany({
      where: { businessId, dealId, id: { in: xodimBaholari.map((b) => b.id) } },
      select: { id: true },
    });
    const bor = new Set(biriktiruvlar.map((b) => b.id));
    for (const b of xodimBaholari) {
      if (!bor.has(b.id)) throw new ForbiddenError("Biriktiruv bu zakazga tegishli emas");
    }
  }

  const zakazDarajasi =
    data.servisBahosi !== undefined || data.etiroz !== undefined || data.yaxshilash !== undefined;

  await runBusinessTx(businessId, async (tx) => {
    if (zakazDarajasi) {
      const mavjud = await tx.dealFeedback.findFirst({ where: { businessId, dealId }, select: { id: true } });
      const maydonlar = {
        ...(data.servisBahosi !== undefined ? { servisBahosi: data.servisBahosi } : {}),
        ...(data.etiroz !== undefined ? { etiroz: data.etiroz || null } : {}),
        ...(data.yaxshilash !== undefined ? { yaxshilash: data.yaxshilash || null } : {}),
        userId,
      };
      if (mavjud) {
        await tx.dealFeedback.updateMany({ where: { id: mavjud.id, businessId }, data: maydonlar });
      } else {
        await tx.dealFeedback.create({ data: { businessId, dealId, ...maydonlar } });
      }
    }
    for (const b of xodimBaholari) {
      await tx.dealEmployee.updateMany({
        where: { id: b.id, businessId, dealId },
        data: {
          baho: b.baho,
          ...(b.izoh !== undefined ? { bahoIzoh: b.izoh || null } : {}),
          bahoAt: b.baho === null ? null : new Date(),
        },
      });
    }
    await tx.activity.create({
      data: {
        businessId,
        dealId,
        contactId: deal.contactId,
        turi: "tizim",
        matn:
          data.servisBahosi !== undefined && data.servisBahosi !== null
            ? `Sifat nazorati: servis ${data.servisBahosi}/10`
            : "Sifat nazorati yangilandi",
        userId,
      },
    });
  });

  return zakazBahosi(businessId, dealId);
}
