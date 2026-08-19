import { rawPrisma } from "@/lib/db/rawPrisma";
import { normalizeRol, ROL_LABEL, type Rol } from "@/lib/auth/roles";
import { superRolNormalize, type SuperRol } from "./rbac";
import { skip, sahifaNatija, type SahifaNatija, type SahifaSorovi } from "./sahifalash";

/**
 * GLOBAL FOYDALANUVCHILAR — platformadagi barcha hisoblar (talab 14/15).
 *
 * Filtr va sahifalash bazada; jadval hech qachon to'liq yuklanmaydi.
 * `rawPrisma` — tizim darajasidagi, tenantlar aro kesim.
 */

export interface UserFiltr {
  qidiruv?: string | null;
  /** "OWNER" | "ADMIN" | "CASHIER" | "SELLER" | "SUPERADMIN" */
  rol?: string | null;
  tenantId?: string | null;
  /** true — faqat faol, false — faqat bloklangan. */
  faol?: boolean | null;
  /** Telegram ulaganlar (2FA o'rnini bosuvchi ikkinchi kanal). */
  telegram?: boolean | null;
}

export interface UserQator {
  id: string;
  ism: string;
  login: string;
  rol: Rol;
  rolLabel: string;
  superadminRol: SuperRol | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  telegramUlangan: boolean;
  sessionEpoch: number;
  tenantId: string | null;
  tenantNomi: string | null;
  businessNomi: string | null;
}

function whereBoylab(f: UserFiltr) {
  const AND: Record<string, unknown>[] = [];
  if (f.qidiruv) {
    const q = f.qidiruv.trim();
    AND.push({
      OR: [
        { ism: { contains: q } },
        { ism: { contains: q.toLowerCase() } },
        { login: { contains: q } },
        { login: { contains: q.toLowerCase() } },
        { id: q },
      ],
    });
  }
  if (f.rol) AND.push({ rol: f.rol });
  if (f.tenantId) AND.push({ tenantId: f.tenantId });
  if (f.faol != null) AND.push({ isActive: f.faol });
  if (f.telegram === true) AND.push({ telegramChatId: { not: null } });
  if (f.telegram === false) AND.push({ telegramChatId: null });
  return AND.length > 0 ? { AND } : {};
}

export async function foydalanuvchilarRoyxati(
  filtr: UserFiltr,
  sorov: SahifaSorovi
): Promise<SahifaNatija<UserQator>> {
  const where = whereBoylab(filtr);
  const [jami, users] = await Promise.all([
    rawPrisma.user.count({ where }),
    rawPrisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: skip(sorov),
      take: sorov.limit,
      select: {
        id: true,
        ism: true,
        login: true,
        rol: true,
        superadminRol: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        telegramChatId: true,
        sessionEpoch: true,
        tenantId: true,
        tenant: { select: { name: true } },
        business: { select: { nomi: true } },
      },
    }),
  ]);

  const qatorlar: UserQator[] = users.map((u) => {
    const rol = normalizeRol(u.rol);
    return {
      id: u.id,
      ism: u.ism,
      login: u.login,
      rol,
      rolLabel: ROL_LABEL[rol] ?? u.rol,
      superadminRol: rol === "SUPERADMIN" ? superRolNormalize(u.superadminRol) : null,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      telegramUlangan: !!u.telegramChatId,
      sessionEpoch: u.sessionEpoch,
      tenantId: u.tenantId,
      tenantNomi: u.tenant?.name ?? null,
      businessNomi: u.business?.nomi ?? null,
    };
  });

  return sahifaNatija(qatorlar, jami, sorov);
}

export interface UserTafsiloti extends UserQator {
  /** Maxsus rol (PRO) nomi — bo'lsa. */
  maxsusRol: string | null;
  mustChangePassword: boolean;
  /** Oxirgi 20 ta faoliyat yozuvi (audit jurnalidan). */
  faoliyat: {
    id: string;
    action: string;
    entity: string;
    entityId: string;
    ip: string | null;
    createdAt: Date;
  }[];
  /** Muvaffaqiyatsiz kirish urinishlari soni (oxirgi 30 kun). */
  muvaffaqiyatsizKirish: number;
}

const KUN_MS = 24 * 60 * 60 * 1000;

export async function userTafsiloti(userId: string): Promise<UserTafsiloti | null> {
  const u = await rawPrisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      ism: true,
      login: true,
      rol: true,
      superadminRol: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      telegramChatId: true,
      sessionEpoch: true,
      mustChangePassword: true,
      tenantId: true,
      tenant: { select: { name: true } },
      business: { select: { nomi: true } },
      role: { select: { nomi: true } },
    },
  });
  if (!u) return null;

  const otgan30 = new Date(Date.now() - 30 * KUN_MS);
  const [faoliyat, muvaffaqiyatsizKirish] = await Promise.all([
    rawPrisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, action: true, entity: true, entityId: true, ip: true, createdAt: true },
    }),
    rawPrisma.auditLog.count({
      where: { userId, action: "login_failed", createdAt: { gte: otgan30 } },
    }),
  ]);

  const rol = normalizeRol(u.rol);
  return {
    id: u.id,
    ism: u.ism,
    login: u.login,
    rol,
    rolLabel: ROL_LABEL[rol] ?? u.rol,
    superadminRol: rol === "SUPERADMIN" ? superRolNormalize(u.superadminRol) : null,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    telegramUlangan: !!u.telegramChatId,
    sessionEpoch: u.sessionEpoch,
    tenantId: u.tenantId,
    tenantNomi: u.tenant?.name ?? null,
    businessNomi: u.business?.nomi ?? null,
    maxsusRol: u.role?.nomi ?? null,
    mustChangePassword: u.mustChangePassword,
    faoliyat,
    muvaffaqiyatsizKirish,
  };
}
