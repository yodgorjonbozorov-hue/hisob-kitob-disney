import { prisma } from "@/lib/prisma";
import { biznesXodimlariWhere } from "@/lib/services/userBiznes";

/**
 * BITTA BIZNESNING TAFSILOTI (Bizneslar → biznes sahifasi).
 *
 * Barcha so'rovlar tenant-scoped `@/lib/prisma` orqali: begona tenant
 * biznesining id'si berilsa `null` qaytadi va sahifa 404 ko'rsatadi
 * (IDOR himoyasi ORM qavatida — lib/db/tenantDb.ts).
 */

export interface BiznesXodim {
  id: string;
  ism: string;
  rol: string;
  /** Shu biznesga ANIQ biriktirilganmi (aks holda — barcha bizneslarga kiradi). */
  biriktirilgan: boolean;
}

export interface BiznesKassa {
  id: string;
  nomi: string;
  turi: string;
  /** Shaxsiy kassa egasining ismi (umumiy kassada null). */
  egasi: string | null;
}

export interface BiznesTafsilot {
  id: string;
  nomi: string;
  isActive: boolean;
  turi: string;
  omborli: boolean;
  magazin: boolean;
  shaxsiyKassa: boolean;
  createdAt: string;
  kategoriyalar: number;
  tranzaksiyalar: number;
  mahsulotlar: number;
  oxirgiFaollik: string | null;
  xodimlar: BiznesXodim[];
  kassalar: BiznesKassa[];
}

export async function biznesTafsiloti(id: string): Promise<BiznesTafsilot | null> {
  const biznes = await prisma.business.findUnique({
    where: { id },
    select: {
      id: true,
      nomi: true,
      isActive: true,
      turi: true,
      omborli: true,
      magazin: true,
      shaxsiyKassa: true,
      createdAt: true,
    },
  });
  if (!biznes) return null;

  const [kategoriyalar, tranzaksiyalar, mahsulotlar, oxirgiTx, oxirgiAudit, xodimlar, kassalar] =
    await Promise.all([
      prisma.category.count({ where: { businessId: id } }),
      prisma.transaction.count({ where: { businessId: id, deletedAt: null } }),
      prisma.product.count({ where: { businessId: id } }),
      prisma.transaction.findFirst({
        where: { businessId: id, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.auditLog.findFirst({
        where: { businessId: id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.user.findMany({
        where: { isActive: true, ...biznesXodimlariWhere(id) },
        orderBy: { ism: "asc" },
        select: { id: true, ism: true, rol: true, businessId: true, bizneslar: { select: { businessId: true } } },
      }),
      prisma.account.findMany({
        where: { businessId: id },
        orderBy: [{ tartib: "asc" }, { nomi: "asc" }],
        select: { id: true, nomi: true, turi: true, user: { select: { ism: true } } },
      }),
    ]);

  const faolliklar = [oxirgiTx?.createdAt, oxirgiAudit?.createdAt].filter(
    (d): d is Date => d instanceof Date
  );
  const oxirgiFaollik = faolliklar.length
    ? new Date(Math.max(...faolliklar.map((d) => d.getTime()))).toISOString()
    : null;

  return {
    ...biznes,
    createdAt: biznes.createdAt.toISOString(),
    kategoriyalar,
    tranzaksiyalar,
    mahsulotlar,
    oxirgiFaollik,
    xodimlar: xodimlar.map((x) => ({
      id: x.id,
      ism: x.ism,
      rol: x.rol,
      biriktirilgan: x.businessId === id || x.bizneslar.some((b) => b.businessId === id),
    })),
    kassalar: kassalar.map((k) => ({
      id: k.id,
      nomi: k.nomi,
      turi: k.turi,
      egasi: k.user?.ism ?? null,
    })),
  };
}
