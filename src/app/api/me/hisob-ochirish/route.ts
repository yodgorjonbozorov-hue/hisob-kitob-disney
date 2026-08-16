import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { ForbiddenError, BadRequestError } from "@/lib/auth/guard";
import { ochirishBekor, ochirishSora, OYLASH_KUNI } from "@/lib/db/hisobOchirish";
import { hisobOchirishSchema } from "@/lib/validation/hisobOchirish";

/**
 * Hisobni o'chirishni SO'RASH (App Store 5.1.1(v)).
 *
 * Faqat OWNER: bu butun kompaniyani — barcha xodimlar, yozuvlar, ombor va
 * hisobotlar bilan — o'chiradi. Xodim o'z ishini o'chirib yubormasligi kerak.
 *
 * Tasdiq: foydalanuvchi kompaniya NOMINI aynan yozadi. Bir bosishda
 * o'chib ketmasligi uchun ataylab og'ir qilingan.
 *
 * Bu yerda ma'lumot O'CHIRILMAYDI — faqat belgi qo'yiladi va kirish yopiladi.
 * Haqiqiy o'chirish 30 kundan keyin cron orqali bo'ladi.
 */
export const POST = withTenant(async (request, _routeCtx, ctx) => {
  if (ctx.session.rol !== "OWNER") {
    throw new ForbiddenError("Hisobni faqat kompaniya egasi o'chira oladi");
  }

  const parsed = hisobOchirishSchema.safeParse(await request.json());
  if (!parsed.success) {
    throw new BadRequestError("Tasdiq matni noto'g'ri");
  }
  // Bo'sh joylar va registr farqi kechiriladi, matnning o'zi emas.
  const kiritilgan = parsed.data.tasdiq.trim().toLowerCase();
  if (kiritilgan !== ctx.tenant.name.trim().toLowerCase()) {
    throw new BadRequestError("Kompaniya nomi mos kelmadi");
  }

  const soralgan = await ochirishSora(ctx.tenantId, ctx.session.userId);
  return NextResponse.json({ ok: true, soralgan, kun: OYLASH_KUNI });
});

/**
 * O'chirishni BEKOR QILISH — 30 kunlik muddat ichida.
 * `ochirishOk`: hisob o'chirilayotgan bo'lsa ham bu route ishlashi shart.
 */
export const DELETE = withTenant(
  async (_request, _routeCtx, ctx) => {
    if (ctx.session.rol !== "OWNER") {
      throw new ForbiddenError("Buni faqat kompaniya egasi qila oladi");
    }
    await ochirishBekor(ctx.tenantId);
    return NextResponse.json({ ok: true });
  },
  { ochirishOk: true, billing: true, readonlyOk: true },
);
