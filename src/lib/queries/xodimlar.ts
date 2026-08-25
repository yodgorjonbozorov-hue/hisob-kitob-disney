import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { qidiruvRejimi } from "@/lib/db/dialect";

/**
 * XODIMLAR RO'YXATI — sahifa va API uchun YAGONA so'rov.
 *
 * Nega server tomonda: ilgari sahifa BARCHA xodimlarni yuklab, qidiruv va
 * filtrni brauzerda bajarardi. 20 xodimda bu sezilmaydi, 500 xodimda esa
 * har ochilishda o'nlab kilobayt DTO va sekin birinchi render bo'ladi.
 *
 * N+1 YO'Q: bitta `findMany` ichida biznes nomlari va rol nomi `select`
 * orqali olinadi; sanoq (`count`) esa alohida, lekin ular PARALLEL ketadi.
 */

/** Holat filtri — UI dagi "Barchasi | Faol | Nofaol" segmenti. */
export type XodimHolat = "hammasi" | "faol" | "nofaol";

export interface XodimlarParams {
  /** Ism yoki login bo'yicha qidiruv (bo'sh — filtrsiz). */
  q?: string;
  holat?: XodimHolat;
  /** Tizim roli ("OWNER" | "CASHIER" | "SELLER") yoki "custom:<roleId>". */
  rol?: string | null;
  /** Shu biznesga biriktirilganlar (biriktirilmaganlar — barcha bizneslarda). */
  biznes?: string | null;
  page?: number;
  pageSize?: number;
}

const XODIM_SELECT = {
  id: true,
  ism: true,
  login: true,
  rol: true,
  isActive: true,
  createdAt: true,
  lastLoginAt: true,
  businessId: true,
  business: { select: { nomi: true } },
  bizneslar: { select: { businessId: true, business: { select: { nomi: true } } } },
  roleId: true,
  role: { select: { nomi: true } },
} as const;

export interface XodimDTO {
  id: string;
  ism: string;
  login: string;
  /** Tizim roli: "OWNER" | "ADMIN" | "CASHIER" | "SELLER". */
  rol: string;
  /** Maxsus rol (PRO) tayinlangan bo'lsa uning id'si. */
  roleId: string | null;
  /** Ko'rsatiladigan rol nomi — maxsus rol bo'lsa uning nomi. */
  rolNomi: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  /** Biriktirilgan bizneslar. Bo'sh — cheklov yo'q ("Barcha bizneslar"). */
  bizneslar: { id: string; nomi: string }[];
}

/** Filtr shartlarini `where` ga aylantiradi (sanoq va ro'yxat bir xil shartda). */
function whereQur(params: XodimlarParams): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};
  const q = params.q?.trim();
  if (q) {
    // SQLite'da `mode: "insensitive"` yo'q — shu bois kichik harfli nusxa ham
    // qidiriladi (lib/db/dialect.ts izohiga qarang).
    const rejim = qidiruvRejimi();
    where.OR = [
      { ism: { contains: q, ...rejim } },
      { ism: { contains: q.toLowerCase(), ...rejim } },
      { login: { contains: q, ...rejim } },
      { login: { contains: q.toLowerCase(), ...rejim } },
      { role: { nomi: { contains: q, ...rejim } } },
    ];
  }
  if (params.holat === "faol") where.isActive = true;
  if (params.holat === "nofaol") where.isActive = false;

  if (params.rol) {
    if (params.rol.startsWith("custom:")) {
      where.roleId = params.rol.slice(7);
    } else {
      // Maxsus rolli xodim bazaRol orqali shu tizim roliga tushadi, lekin
      // foydalanuvchi uchun u BOSHQA rol — shuning uchun chiqarib tashlanadi.
      where.rol = params.rol;
      where.roleId = null;
    }
  }
  if (params.biznes) {
    where.bizneslar = { some: { businessId: params.biznes } };
  }
  return where;
}

/** Rol ustuni uchun ko'rsatiladigan nom (maxsus rol ustun turadi). */
export const TIZIM_ROL_NOMI: Record<string, string> = {
  OWNER: "Direktor",
  ADMIN: "Administrator",
  CASHIER: "Kassir",
  SELLER: "Sotuvchi",
};

export async function listXodimlar(params: XodimlarParams) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
  const where = whereQur(params);

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: XODIM_SELECT,
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return { items: rows.map(toDTO), total, page, pageSize };
}

/** Prisma yozuvidan UI DTO — bitta joyda, sahifa ham API ham shundan. */
export function toDTO(u: {
  id: string;
  ism: string;
  login: string;
  rol: string;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt?: Date | null;
  businessId?: string | null;
  business?: { nomi: string } | null;
  bizneslar?: { businessId: string; business?: { nomi: string } | null }[];
  roleId?: string | null;
  role?: { nomi: string } | null;
}): XodimDTO {
  const bizneslar = (u.bizneslar ?? [])
    .map((b) => ({ id: b.businessId, nomi: b.business?.nomi ?? "" }))
    .filter((b) => b.nomi !== "");
  // Eski hisob: biriktiruv qatori yo'q, `businessId` esa to'lgan.
  if (bizneslar.length === 0 && u.businessId && u.business?.nomi) {
    bizneslar.push({ id: u.businessId, nomi: u.business.nomi });
  }
  return {
    id: u.id,
    ism: u.ism,
    login: u.login,
    rol: u.rol,
    roleId: u.roleId ?? null,
    rolNomi: u.role?.nomi ?? TIZIM_ROL_NOMI[u.rol] ?? u.rol,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    bizneslar: bizneslar.sort((a, b) => a.nomi.localeCompare(b.nomi, "uz")),
  };
}

/**
 * Bitta xodimni DTO shaklida o'qiydi (yaratish/tahrirlash javobi uchun).
 *
 * Biriktiruvlar alohida jadvalda yozilgani sabab, javobni yozish amalining
 * NATIJASIDAN yig'ib bo'lmaydi — u eski holatni ko'rsatadi.
 */
export async function xodimniOqi(id: string): Promise<XodimDTO> {
  const u = await prisma.user.findUnique({ where: { id }, select: XODIM_SELECT });
  if (!u) throw new Error("Xodim topilmadi");
  return toDTO(u);
}

/** Tepadagi KPI raqamlari — filtrdan MUSTAQIL (jami holat ko'rsatkichi). */
export async function xodimSanoqlari() {
  const [jami, faol, boshqaruvchi, biriktiruvlar] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    // Faol boshqaruvchilar soni — UI "oxirgi direktor" amalini oldindan
    // o'chirib qo'yishi uchun. HIMOYA emas: himoya serverda
    // (lib/services/userGuard.ts), bu faqat tugmani bosishdan oldin tushuntirish.
    prisma.user.count({ where: { isActive: true, rol: { in: ["OWNER", "ADMIN"] } } }),
    // Ko'p bizneslilar: 2+ biriktiruvi bor xodimlar.
    prisma.userBusiness.groupBy({ by: ["userId"], _count: { userId: true } }),
  ]);
  return {
    jami,
    faol,
    nofaol: jami - faol,
    boshqaruvchi,
    kopBiznes: biriktiruvlar.filter((g) => g._count.userId > 1).length,
  };
}
