import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { csvniOqi, csvniYoz, MAX_QATOR } from "@/lib/services/csvImport";
import { dashboardYangilandi } from "@/lib/cache";
import { z } from "zod";

const schema = z.object({
  csv: z.string().min(1, "Fayl bo'sh").max(1_000_000, "Fayl juda katta"),
  /** true bo'lsa faqat tekshiradi va oldindan ko'rish qaytaradi (yozmaydi). */
  tekshirish: z.boolean().optional(),
});

/**
 * CSV import — faqat direktor/admin.
 *
 * Ikki bosqichli: avval `tekshirish: true` bilan yuboriladi (foydalanuvchi
 * natijani ko'radi), keyin tasdiqlash uchun `tekshirish` siz. Shu tufayli
 * mijoz 200 qatorni ko'r-ko'rona yozib yubormaydi.
 */
export const POST = withTenant(async (request, _ctx, { session: user }) => {
  requireManager(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  const { qatorlar, xatolar } = csvniOqi(parsed.data.csv);

  if (parsed.data.tekshirish) {
    return NextResponse.json({
      jami: qatorlar.length,
      xatolar,
      namuna: qatorlar.slice(0, 10),
      maxQator: MAX_QATOR,
    });
  }

  if (qatorlar.length === 0) {
    return NextResponse.json(
      { error: "Import qilinadigan to'g'ri qator topilmadi", xatolar },
      { status: 400 }
    );
  }

  const yozildi = await csvniYoz({ businessId, userId: user.userId, qatorlar });
  dashboardYangilandi(businessId);
  return NextResponse.json({ yozildi, xatolar }, { status: 201 });
});
