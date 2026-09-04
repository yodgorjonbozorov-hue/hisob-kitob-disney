import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { sotuvchilarRoyxati, sotuvchiMajburiymi } from "@/lib/services/zakazSotuvchi";

/**
 * CRM "Yangi buyurtma" formasi uchun sotuvchilar (2-talab).
 *
 * Ro'yxatda FAQAT shu biznesning faol va sotuvchi kategoriyasiga tayinlangan
 * xodimlari bo'ladi — direktor/dekorator/haydovchi chiqmaydi. `majburiy` —
 * biznes sozlamasi (6-talab).
 *
 * AVTO-TANLASH VA HUQUQ MAYDONLARI YO'Q: sotuvchi har doim qo'lda tanlanadi
 * va ro'yxat CRM'ga kira olgan har bir xodim uchun bir xil ochiladi.
 */
export const GET = withTenant(
  async (_request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ sotuvchilar: [], majburiy: false });

    const [sotuvchilar, majburiy] = await Promise.all([
      sotuvchilarRoyxati(businessId),
      sotuvchiMajburiymi(businessId),
    ]);

    return NextResponse.json({ sotuvchilar, majburiy });
  },
  { module: "CRM" }
);
