import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { listAccounts, getAccountBalances } from "@/lib/queries/accounts";
import { createAccount } from "@/lib/services/accounts";
import { createAccountSchema } from "@/lib/validation/account";

/**
 * Kassa/hisob-raqamlar ro'yxati.
 * `?qoldiq=1` — har kassaning joriy qoldig'i bilan (faqat boshqaruvchilar).
 */
export const GET = withTenant(async (request, _ctx, { session: user }) => {
  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json([]);

  const { searchParams } = new URL(request.url);
  if (searchParams.get("qoldiq") === "1") {
    requireManager(user.rol);
    return NextResponse.json(await getAccountBalances(businessId));
  }
  // Yozuv kiritishda kassa tanlash uchun — barcha rollarga faol kassalar.
  return NextResponse.json(await listAccounts(businessId, true));
});

/** Yangi kassa ochish — faqat direktor/admin. */
export const POST = withTenant(async (request, _ctx, { session: user }) => {
  requireManager(user.rol);
  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const parsed = createAccountSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  const account = await createAccount(businessId, parsed.data);
  return NextResponse.json(account, { status: 201 });
});
