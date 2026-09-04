import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { transactionScopeUserId } from "@/lib/auth/visibility";
import { todayTashkentDateOnlyString } from "@/lib/date";
import { crmYuqoriPanel } from "@/lib/crm/yuqoriPanel";

/**
 * CRM YUQORI PANELI — "Xodim kassasi" va "Chiqim" bloklarini YANGILASH.
 *
 * Sahifa bu ma'lumotni serverda o'zi o'qiydi; bu route faqat chiqim
 * saqlangandan yoki kassa topshirilgandan KEYIN raqamlarni sahifani qayta
 * yuklamasdan yangilash uchun.
 *
 * Huquq tekshirilmaydi — chunki bu yerda foydalanuvchining O'Z kassasi va
 * o'zining ko'rish doirasidagi chiqimlaridan boshqa hech narsa yo'q
 * (`transactionScopeUserId` — mavjud ko'rinuvchanlik qoidasi).
 */
export const GET = withTenant(async (_request, _ctx, { session: user }) => {
  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  return NextResponse.json(
    await crmYuqoriPanel(
      businessId,
      { userId: user.userId, ism: user.ism ?? "Xodim" },
      transactionScopeUserId(user),
      todayTashkentDateOnlyString()
    )
  );
});
