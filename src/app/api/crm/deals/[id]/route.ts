import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/auth/tenant";
import { ForbiddenError, BadRequestError } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { moveDeal, biznesXodimi } from "@/lib/crm/service";
import { buyurtmaPatchSchema } from "@/lib/validation/crm";
import { dashboardYangilandi } from "@/lib/cache";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import {
  sotuvchiUserIdTop,
  zakazXodimlari,
  zakazXodimlariniSaqlash,
} from "@/lib/services/xodimKategoriya";
import { biznesXodimlariWhere } from "@/lib/services/userBiznes";
import type { Prisma } from "@prisma/client";

/** Buyurtma tafsiloti + faoliyat tarixi (timeline) + bog'langan kirim. */
export const GET = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    const deal = await prisma.deal.findFirst({
      where: { id: params.id, businessId: businessId ?? "-", deletedAt: null },
      include: {
        contact: true,
        stage: true,
        category: { select: { id: true, nomi: true } },
        transaction: { select: { id: true, summa: true, sana: true, deletedAt: true } },
        activities: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
    if (!deal) return NextResponse.json({ error: "Buyurtma topilmadi" }, { status: 404 });
    // Zakazdagi xodimlar (kategoriya kesimida) — tafsilot oynasi ko'rsatadi.
    const xodimlar = await zakazXodimlari(businessId ?? "-", deal.id);
    return NextResponse.json({ ...deal, xodimlar });
  },
  { module: "CRM" }
);

/**
 * Buyurtmani tahrirlash / holatga ko'chirish.
 *
 * DIQQAT: kirim yozilgandan keyin SUMMA va KATEGORIYA qulflanadi — aks holda
 * CRM bir raqamni, Kirim boshqasini ko'rsatardi (yozilgan tranzaksiya
 * o'zgarmaydi). Ularni o'zgartirish uchun avval Kirimdagi yozuv tahrirlanadi.
 */
export const PATCH = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = buyurtmaPatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    const data = parsed.data;

    const maydonlar =
      data.nomi !== undefined ||
      data.summa !== undefined ||
      data.izoh !== undefined ||
      data.sana !== undefined ||
      data.categoryId !== undefined ||
      data.masulId !== undefined;

    if (maydonlar) {
      const existing = await prisma.deal.findFirst({
        where: { id: params.id, businessId, deletedAt: null },
        select: { id: true, transactionId: true },
      });
      if (!existing) throw new ForbiddenError("Buyurtma topilmadi");

      if (existing.transactionId && (data.summa !== undefined || data.categoryId !== undefined)) {
        throw new BadRequestError(
          "Kirim yozilgan buyurtmaning summasi va kategoriyasi o'zgartirilmaydi"
        );
      }

      if (data.categoryId) {
        const cat = await prisma.category.findFirst({
          where: { id: data.categoryId, businessId },
          select: { turi: true },
        });
        if (!cat) throw new ForbiddenError("Kategoriya bu biznesga tegishli emas");
        if (cat.turi !== "kirim") throw new BadRequestError("Kategoriya kirim turida bo'lishi kerak");
      }
      // Mas'ul xodim — shu BIZNESning xodimi (tenant filtri o'zi yetarli emas:
      // bir kompaniyaning ikkinchi biznesidagi xodim ham o'tib ketardi).
      if (data.masulId) await biznesXodimi(businessId, data.masulId);

      const patch: Prisma.DealUpdateInput = {};
      if (data.nomi !== undefined) patch.nomi = data.nomi;
      if (data.summa !== undefined) patch.summa = data.summa;
      if (data.izoh !== undefined) patch.izoh = data.izoh;
      if (data.masulId !== undefined) patch.masulId = data.masulId;
      if (data.sana !== undefined) patch.sana = data.sana ? dateOnlyStringToUTCDate(data.sana) : null;
      if (data.categoryId !== undefined) {
        patch.category = data.categoryId ? { connect: { id: data.categoryId } } : { disconnect: true };
      }
      await prisma.deal.update({ where: { id: params.id }, data: patch });
    }

    // Zakaz xodimlarini almashtirish — kirim yozilgan buyurtmada xizmat
    // qatlami o'zi qulflaydi. Sotuvchi biriktiruvi mas'ulni yetaklaydi
    // (createDeal bilan bir xil qoida): keyin kirim yozilsa `sotuvchiId`
    // ayni sotuvchiga tushadi.
    if (data.xodimlar !== undefined) {
      await zakazXodimlariniSaqlash(businessId, params.id, data.xodimlar);
      const sotuvchiUserId = await sotuvchiUserIdTop(businessId, data.xodimlar);
      if (sotuvchiUserId) {
        const sotuvchi = await prisma.user.findFirst({
          where: { id: sotuvchiUserId, isActive: true, ...biznesXodimlariWhere(businessId) },
          select: { id: true },
        });
        if (sotuvchi) {
          await prisma.deal.update({ where: { id: params.id }, data: { masulId: sotuvchi.id } });
        }
      }
    }

    // Holat ko'chirish maydonlardan KEYIN: WON + kirimYoz bo'lsa kirim yangi
    // summa/kategoriya bilan yozilsin.
    if (data.stageId) {
      await moveDeal({
        businessId,
        dealId: params.id,
        stageId: data.stageId,
        kirimYoz: data.kirimYoz,
        userId: user.userId,
      });
    }

    // Dashboardga uch yo'l bilan ta'sir qiladi: summa/sana tahriri
    // "yangi buyurtmalar" ni, WON bosqichiga ko'chirish "yutilgan" ni,
    // `kirimYoz` esa KIRIM tranzaksiyasini o'zgartiradi.
    dashboardYangilandi(businessId);

    const deal = await prisma.deal.findFirst({
      where: { id: params.id, businessId },
      include: {
        contact: { select: { ism: true, tel: true } },
        stage: true,
        category: { select: { id: true, nomi: true } },
      },
    });
    return NextResponse.json(deal);
  },
  { module: "CRM" }
);
