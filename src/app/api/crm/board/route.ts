import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { ustunSahifasi, DOSKA_SAHIFA } from "@/lib/crm/service";
import { ustunSahifaDTO } from "@/lib/crm/dto";
import { doskaFiltrSchema } from "@/lib/validation/crm";
import { USTUNLAR, type Ustun } from "@/lib/crm/pipeline";
import { biznesXodimlariWhere } from "@/lib/services/userBiznes";
import { todayTashkentDateOnlyString } from "@/lib/date";

/**
 * DOSKA USTUNINING BIR SAHIFASI — "Yana ko'rsatish" shu yerdan oladi.
 *
 * Sahifalash SERVER TOMONDA: brauzerga faqat kerakli 10 ta zakaz keladi
 * (ilgari 500 tasi kelib, ortiqchasi shunchaki ko'rsatilmasdi). Kursor —
 * oxirgi zakaz id'si; tartib `lib/crm/service.ts` da ustun qoidasi bo'yicha
 * (u `lib/crm/pipeline.ts` dagi `zakazlarniTartibla` ning SQL ko'rinishi).
 *
 * `?ustun=` MAJBURIY: doska endi ustun-ustun o'qiladi.
 */
export const GET = withTenant(
  async (request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    const q = new URL(request.url).searchParams;
    const ustun = q.get("ustun") as Ustun | null;
    if (!ustun || !USTUNLAR.includes(ustun)) {
      return NextResponse.json({ error: "Ustun ko'rsatilmagan" }, { status: 400 });
    }
    if (!businessId) {
      return NextResponse.json({ ustun, zakazlar: [], kursor: null, jami: 0, summa: 0 });
    }

    const parsed = doskaFiltrSchema.safeParse({
      from: q.get("from"),
      to: q.get("to"),
      masulId: q.get("masulId"),
      categoryId: q.get("categoryId"),
      sotuvchiId: q.get("sotuvchiId"),
      tolov: q.get("tolov"),
      yoqotilgan: q.get("yoqotilgan") === "1",
    });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato filtr" }, { status: 400 });
    }

    const limit = Number(q.get("limit") ?? DOSKA_SAHIFA);
    const sahifa = await ustunSahifasi(businessId, ustun, parsed.data, {
      bugun: todayTashkentDateOnlyString(),
      kursor: q.get("kursor"),
      limit: Number.isFinite(limit) ? limit : DOSKA_SAHIFA,
    });

    // Mas'ul ismlari — kartadagi "Mas'ul" qatori uchun (sahifa bilan bir xil
    // manba: faqat SHU biznesda ishlaydiganlar).
    const xodimlar = await prisma.user.findMany({
      where: { isActive: true, ...biznesXodimlariWhere(businessId) },
      select: { id: true, ism: true },
    });
    return NextResponse.json(ustunSahifaDTO(sahifa, new Map(xodimlar.map((x) => [x.id, x.ism]))));
  },
  { module: "CRM" }
);
