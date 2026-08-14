import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { currentTenantId } from "@/lib/db/tenantContext";
import { logAudit } from "@/lib/services/audit";
import type { CreateRoleInput, UpdateRoleInput } from "@/lib/validation/rol";

/**
 * MAXSUS ROLLAR XIZMATI (PRO).
 *
 * Rol — tenant darajasidagi obyekt (Role TENANT_DIRECT ro'yxatida), shuning
 * uchun tenant-scoped `prisma` bilan ishlanadi: boshqa tenant rollari bu
 * yerda umuman ko'rinmaydi, create'da tenantId avtomatik yoziladi.
 */

const ROLE_SELECT = {
  id: true,
  nomi: true,
  izoh: true,
  huquqlar: true,
  bazaRol: true,
  isActive: true,
  createdAt: true,
  _count: { select: { users: { where: { isActive: true } } } },
} as const;

export async function listRoles() {
  return prisma.role.findMany({
    where: { deletedAt: null },
    select: ROLE_SELECT,
    orderBy: { createdAt: "asc" },
  });
}

export async function createRole(data: CreateRoleInput) {
  const band = await prisma.role.findFirst({
    where: { nomi: data.nomi, deletedAt: null },
    select: { id: true },
  });
  if (band) throw new BadRequestError("Bu nomdagi rol allaqachon bor");

  const created = await prisma.role.create({
    data: {
      // Extension ham majburan yozadi — TS uchun ochiq ko'rsatiladi.
      tenantId: currentTenantId(),
      nomi: data.nomi,
      izoh: data.izoh?.trim() || undefined,
      huquqlar: JSON.stringify(data.huquqlar),
      bazaRol: data.bazaRol,
    },
    select: ROLE_SELECT,
  });

  await logAudit({
    action: "create",
    entity: "role",
    entityId: created.id,
    after: { nomi: data.nomi, huquqlar: data.huquqlar, bazaRol: data.bazaRol },
  });
  return created;
}

export async function updateRole(id: string, data: UpdateRoleInput) {
  const mavjud = await prisma.role.findFirst({ where: { id, deletedAt: null } });
  if (!mavjud) throw new ForbiddenError("Rol topilmadi");

  if (data.nomi && data.nomi !== mavjud.nomi) {
    const band = await prisma.role.findFirst({
      where: { nomi: data.nomi, deletedAt: null },
      select: { id: true },
    });
    if (band) throw new BadRequestError("Bu nomdagi rol allaqachon bor");
  }

  const yangilangan = await prisma.role.update({
    where: { id },
    data: {
      ...(data.nomi ? { nomi: data.nomi } : {}),
      ...(data.izoh !== undefined ? { izoh: data.izoh?.trim() || null } : {}),
      ...(data.huquqlar ? { huquqlar: JSON.stringify(data.huquqlar) } : {}),
      ...(data.bazaRol ? { bazaRol: data.bazaRol } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
    select: ROLE_SELECT,
  });

  // bazaRol o'zgargan bo'lsa — shu roldagi foydalanuvchilarning nav skeleti
  // (User.rol) ham sinxron yangilanadi, aks holda eski skelet bilan qoladi.
  if (data.bazaRol && data.bazaRol !== mavjud.bazaRol) {
    await prisma.user.updateMany({
      where: { roleId: id },
      data: { rol: data.bazaRol },
    });
  }

  await logAudit({
    action: "update",
    entity: "role",
    entityId: id,
    before: { nomi: mavjud.nomi, huquqlar: mavjud.huquqlar, bazaRol: mavjud.bazaRol },
    after: data,
  });
  return yangilangan;
}

/** Rolni o'chirish — yumshoq. Faol foydalanuvchisi bor rol o'chirilmaydi. */
export async function deleteRole(id: string) {
  const mavjud = await prisma.role.findFirst({ where: { id, deletedAt: null } });
  if (!mavjud) throw new ForbiddenError("Rol topilmadi");

  const foydalanuvchilar = await prisma.user.count({
    where: { roleId: id, isActive: true },
  });
  if (foydalanuvchilar > 0) {
    throw new BadRequestError(
      `Bu rolda ${foydalanuvchilar} ta faol foydalanuvchi bor — avval ularni boshqa rolga o'tkazing`
    );
  }

  await prisma.role.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  await logAudit({
    action: "delete",
    entity: "role",
    entityId: id,
    before: { nomi: mavjud.nomi },
  });
  return { ok: true };
}
