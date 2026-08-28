import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { ForbiddenError } from "@/lib/auth/guard";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId } from "@/lib/business";
import { prisma } from "@/lib/prisma";

/**
 * SELFIE — maxfiy shaxsiy ma'lumot. Ochiq URL yo'q: rasm faqat shu route
 * orqali, avtorizatsiya tekshiruvidan keyin beriladi:
 *   - boshqaruvchi (OWNER/ADMIN) — o'z biznesidagi istalgan selfie;
 *   - oddiy xodim — FAQAT o'z selfiesi (Employee.userId orqali).
 * Boshqa biznes/tenant yozuvi tenant-scoped prisma tufayli umuman ko'rinmaydi.
 */
export const GET = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) throw new ForbiddenError("Biznes topilmadi");

    const selfie = await prisma.attendanceSelfie.findFirst({
      where: { id: params.id, businessId },
      include: { employee: { select: { userId: true } } },
    });
    if (!selfie) throw new ForbiddenError("Rasm topilmadi");

    if (!isManager(user.rol) && selfie.employee.userId !== user.userId) {
      throw new ForbiddenError("Bu rasm sizga tegishli emas");
    }

    if (selfie.saqlagich === "db" && selfie.mazmun) {
      const bayt = Buffer.from(selfie.mazmun, "base64");
      return new NextResponse(new Uint8Array(bayt), {
        headers: {
          "Content-Type": selfie.mimeType,
          "Content-Length": String(bayt.byteLength),
          "Cache-Control": "private, max-age=3600",
        },
      });
    }
    if (selfie.url) {
      // Kelajakdagi saqlagichlar uchun: avtorizatsiyadan keyin yo'naltirish.
      return NextResponse.redirect(selfie.url);
    }
    throw new ForbiddenError("Rasm topilmadi");
  },
  { module: "HR" }
);
