import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/auth/guard";
import { isManager } from "@/lib/auth/roles";
import { hasPermission, requirePermission } from "@/lib/permissions/tekshir";
import type { SessionData } from "@/lib/auth/session";

/**
 * KPI MODULI RUXSATLARI — server tomonda, bitta joyda.
 *
 * FRONTENDDA YASHIRISH XAVFSIZLIK EMAS. Sahifada tugma ko'rinmasligi
 * so'rovni to'smaydi, shuning uchun har API route shu funksiyalardan
 * birini chaqiradi.
 *
 * IDOR HIMOYASI: mijozdan kelgan `employeeId` ga hech qachon ko'r-ko'rona
 * ishonilmaydi. Boshqaruvchi bo'lmagan foydalanuvchi uchun xodim yozuvi
 * SERVERDA `userId` orqali topiladi va so'ralgan id o'sha bilan
 * solishtiriladi — begona xodim id'si 403 bilan qaytadi.
 */

/** Xodim ko'rish darajasi. */
export interface KpiKirish {
  /** Barcha xodimlarni ko'radimi (rahbar ko'rinishi, reyting). */
  hammasi: boolean;
  /** O'z xodim yozuvi (bog'langan bo'lsa) — o'zini ko'rish uchun. */
  ozEmployeeId: string | null;
}

/** Foydalanuvchining shu bizneste bog'langan xodim yozuvi. */
export async function ozEmployeeId(
  businessId: string,
  userId: string
): Promise<string | null> {
  const x = await prisma.employee.findFirst({
    where: { businessId, userId, deletedAt: null },
    select: { id: true },
  });
  return x?.id ?? null;
}

/**
 * Kirish darajasini aniqlaydi.
 *
 * OWNER/ADMIN + `kpi.korish` — hammasi. Boshqalar (SELLER/CASHIER va
 * huquqi olib qo'yilgan ADMIN) — faqat o'zi. Hech biri bo'lmasa
 * `ForbiddenError` (fail-closed).
 */
export async function kpiKirish(
  session: SessionData & { userId: string; rol: string },
  businessId: string
): Promise<KpiKirish> {
  const oz = await ozEmployeeId(businessId, session.userId);

  if (isManager(session.rol) && (await hasPermission(session.userId, "kpi.korish"))) {
    return { hammasi: true, ozEmployeeId: oz };
  }
  if (oz) return { hammasi: false, ozEmployeeId: oz };

  throw new ForbiddenError("Bu bo'limni ko'rish uchun sizda huquq yo'q");
}

/**
 * So'ralgan xodimni ko'rish mumkinmi. Mumkin bo'lmasa `ForbiddenError`.
 * Qaytadigan qiymat — tekshirilgan `employeeId` (chaqiruvchi shuni ishlatadi).
 */
export async function xodimKirishTekshir(
  session: SessionData & { userId: string; rol: string },
  businessId: string,
  employeeId: string
): Promise<string> {
  const kirish = await kpiKirish(session, businessId);
  if (kirish.hammasi) return employeeId;
  if (kirish.ozEmployeeId === employeeId) return employeeId;
  throw new ForbiddenError("Faqat o'z ma'lumotingizni ko'ra olasiz");
}

/** Ball ayirish/qaytarish — boshqaruvchi va `kpi.ball` huquqi. */
export async function ballHuquqi(session: { userId: string; rol: string }): Promise<void> {
  if (!isManager(session.rol)) {
    throw new ForbiddenError("Ball faqat boshqaruvchi tomonidan o'zgartiriladi");
  }
  await requirePermission(session.userId, "kpi.ball");
}

/** Vazifa/preset/sozlama tahriri — boshqaruvchi va `kpi.sozlash` huquqi. */
export async function sozlashHuquqi(session: { userId: string; rol: string }): Promise<void> {
  if (!isManager(session.rol)) {
    throw new ForbiddenError("Sozlamalarni faqat boshqaruvchi o'zgartiradi");
  }
  await requirePermission(session.userId, "kpi.sozlash");
}

/** Oyni yopish / tasdiqlash — boshqaruvchi va `kpi.oylik.tasdiq` huquqi. */
export async function tasdiqHuquqi(session: { userId: string; rol: string }): Promise<void> {
  if (!isManager(session.rol)) {
    throw new ForbiddenError("Oylikni faqat boshqaruvchi tasdiqlaydi");
  }
  await requirePermission(session.userId, "kpi.oylik.tasdiq");
}

/** To'landi deb belgilash — boshqaruvchi va `kpi.oylik.tolash` huquqi. */
export async function tolovHuquqi(session: { userId: string; rol: string }): Promise<void> {
  if (!isManager(session.rol)) {
    throw new ForbiddenError("To'lovni faqat boshqaruvchi belgilaydi");
  }
  await requirePermission(session.userId, "kpi.oylik.tolash");
}
