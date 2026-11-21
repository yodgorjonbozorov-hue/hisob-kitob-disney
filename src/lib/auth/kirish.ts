/**
 * KIRISHNING UMUMIY QISMI — parol bilan ham, Telegram bilan ham bir xil:
 * sessiya cookie'si va audit yozuvi. Ikki yo'l ajralib ketmasligi uchun
 * (masalan biri `sessionEpoch` ni unutsa, "barcha sessiyalarni bekor qilish"
 * o'sha yo'l uchun ishlamay qolardi) — yagona joy shu.
 */
// Login global (tenantlar aro) — rawPrisma.
import { rawPrisma as prisma } from "@/lib/db/rawPrisma";
import type { User } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { normalizeRol } from "@/lib/auth/roles";

/**
 * Kirish urinishini audit jurnaliga yozadi. HECH QACHON xato tashlamaydi —
 * jurnal yozib bo'lmagani login oqimini buzmasligi kerak.
 */
export async function loginUrinishiYoz(p: {
  login: string;
  ip: string;
  ok: boolean;
  userId: string | null;
  tenantId: string | null;
  /** Kirish usuli: "login" (parol) yoki "login_telegram". */
  amal?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: p.tenantId,
        businessId: null,
        userId: p.userId,
        userIsm: p.login,
        action: p.ok ? (p.amal ?? "login") : "login_failed",
        entity: "auth",
        entityId: p.userId ?? p.login,
        ip: p.ip === "unknown" ? null : p.ip,
      },
    });
  } catch (error) {
    console.error("Kirish urinishini yozib bo'lmadi:", error);
  }
}

/** Veb sessiyani ochadi (shifrlangan httpOnly cookie) va oxirgi kirish vaqtini yozadi. */
export async function webSessiyaOch(user: User): Promise<void> {
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});

  const session = await getSession();
  session.userId = user.id;
  session.login = user.login;
  session.ism = user.ism;
  session.rol = normalizeRol(user.rol);
  session.tenantId = user.tenantId ?? null;
  session.businessId = user.businessId ?? null;
  session.mustChangePassword = user.mustChangePassword ?? false;
  session.sessionEpoch = user.sessionEpoch ?? 0;
  await session.save();
}
