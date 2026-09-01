import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { hasPermission } from "@/lib/permissions/tekshir";
import { avtoSotuvchi, sotuvchilarRoyxati, sotuvchiMajburiymi } from "@/lib/services/zakazSotuvchi";

/**
 * CRM "Yangi buyurtma" formasi uchun sotuvchilar (2-talab).
 *
 * Ro'yxatda FAQAT shu biznesning faol va sotuvchi kategoriyasiga tayinlangan
 * xodimlari bo'ladi — direktor/dekorator/haydovchi chiqmaydi.
 * `ozim` — avto-tanlash uchun (4-talab), `almashtira` — boshqa sotuvchini
 * tanlash huquqi (5/27-talab), `majburiy` — biznes sozlamasi (6-talab).
 */
export const GET = withTenant(
  async (_request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) {
      return NextResponse.json({ sotuvchilar: [], ozim: null, majburiy: false, almashtira: false });
    }

    const [sotuvchilar, ozi, majburiy, almashtira] = await Promise.all([
      sotuvchilarRoyxati(businessId),
      avtoSotuvchi(businessId, user.userId),
      sotuvchiMajburiymi(businessId),
      hasPermission(user.userId, "crm.sotuvchi"),
    ]);

    return NextResponse.json({ sotuvchilar, ozim: ozi?.id ?? null, majburiy, almashtira });
  },
  { module: "CRM" }
);
