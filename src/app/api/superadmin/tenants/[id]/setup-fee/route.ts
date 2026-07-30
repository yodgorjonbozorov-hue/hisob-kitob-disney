import { NextResponse } from "next/server";
import { z } from "zod";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { setSetupFee, logSuperadminAction } from "@/lib/superadmin/service";
import { SETUP_FEE_USD } from "@/lib/billing/constants";

const schema = z.object({
  tolandi: z.boolean(),
  summaUsd: z.number().int().min(0).max(100_000).default(SETUP_FEE_USD),
});

/** Bir martalik o'rnatish to'lovi holatini belgilash. */
export const POST = withSuperadmin<{ params: { id: string } }>(async (request, { params }, session) => {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Xato ma'lumot" }, { status: 400 });
  }

  const tenant = await setSetupFee(params.id, parsed.data.tolandi, parsed.data.summaUsd);
  await logSuperadminAction({
    superadminId: session.userId,
    superadminIsm: session.ism,
    action: "setup_fee",
    entity: "tenant",
    entityId: params.id,
    detail: { tolandi: parsed.data.tolandi, summaUsd: parsed.data.tolandi ? parsed.data.summaUsd : null },
  });

  return NextResponse.json({
    ok: true,
    setupFeePaidAt: tenant.setupFeePaidAt,
    setupFeeAmountUsd: tenant.setupFeeAmountUsd,
  });
});
