import { rawPrisma } from "@/lib/db/rawPrisma";
import { amalLabel } from "./audit";
import { taxminiyFaolSessiyalar } from "./sessiyalar";

/**
 * XAVFSIZLIK MARKAZI (talab 24/25).
 *
 * Manba — audit jurnali (append-only). Bu yerda hech narsa o'ylab
 * topilmaydi: har raqam `AuditLog` dagi haqiqiy yozuvlardan hisoblanadi.
 */

const KUN_MS = 24 * 60 * 60 * 1000;

export interface KirishUrinishi {
  login: string;
  soni: number;
  oxirgi: Date;
  /** Turli IP manzillar soni — tarqoq hujum belgisi. */
  ipSoni: number;
}

export interface ImtiyozliAmal {
  id: string;
  kim: string | null;
  amal: string;
  amalLabel: string;
  entity: string;
  entityId: string;
  ip: string | null;
  userAgent: string | null;
  sabab: string | null;
  createdAt: Date;
}

export interface XavfsizlikXulosa {
  /** Oxirgi 24 soat / 7 kun muvaffaqiyatsiz kirishlar. */
  muvaffaqiyatsiz24: number;
  muvaffaqiyatsiz7kun: number;
  /** Muvaffaqiyatli kirishlar (24 soat). */
  muvaffaqiyatli24: number;
  /** Taxminiy faol sessiyalar (7 kun ichida kirganlar). */
  faolSessiyalar: number;
  /** Telegram ulagan boshqaruvchilar ulushi (ikkinchi kanal — 2FA o'rnida). */
  telegramUlangan: number;
  telegramJami: number;
  /** Bloklangan foydalanuvchilar. */
  bloklanganUser: number;
  /** Superadmin hisoblari soni. */
  superadminSoni: number;
  /** Eng ko'p urinilgan loginlar. */
  shubhaliLoginlar: KirishUrinishi[];
  /** Bir nechta IP dan kirgan foydalanuvchilar (24 soat). */
  kopIpdanKirganlar: KirishUrinishi[];
  /** Oxirgi imtiyozli (superadmin) amallar. */
  imtiyozliAmallar: ImtiyozliAmal[];
}

export async function xavfsizlikXulosa(now: Date = new Date()): Promise<XavfsizlikXulosa> {
  const soat24 = new Date(now.getTime() - KUN_MS);
  const kun7 = new Date(now.getTime() - 7 * KUN_MS);

  const [
    muvaffaqiyatsiz24,
    muvaffaqiyatsiz7kun,
    muvaffaqiyatli24,
    faolSessiyalar,
    telegramUlangan,
    telegramJami,
    bloklanganUser,
    superadminSoni,
    urinishlar,
    kirishlar,
    imtiyozli,
  ] = await Promise.all([
    rawPrisma.auditLog.count({ where: { action: "login_failed", createdAt: { gte: soat24 } } }),
    rawPrisma.auditLog.count({ where: { action: "login_failed", createdAt: { gte: kun7 } } }),
    rawPrisma.auditLog.count({ where: { action: "login", createdAt: { gte: soat24 } } }),
    taxminiyFaolSessiyalar(now),
    rawPrisma.user.count({
      where: { isActive: true, rol: { in: ["OWNER", "ADMIN"] }, telegramChatId: { not: null } },
    }),
    rawPrisma.user.count({ where: { isActive: true, rol: { in: ["OWNER", "ADMIN"] } } }),
    rawPrisma.user.count({ where: { isActive: false } }),
    rawPrisma.user.count({ where: { rol: "SUPERADMIN" } }),
    rawPrisma.auditLog.findMany({
      where: { action: "login_failed", createdAt: { gte: kun7 } },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { userIsm: true, ip: true, createdAt: true },
    }),
    rawPrisma.auditLog.findMany({
      where: { action: "login", createdAt: { gte: soat24 } },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { userIsm: true, ip: true, createdAt: true },
    }),
    rawPrisma.auditLog.findMany({
      where: { userIsm: { startsWith: "[SUPERADMIN" } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        userIsm: true,
        action: true,
        entity: true,
        entityId: true,
        ip: true,
        userAgent: true,
        sabab: true,
        createdAt: true,
      },
    }),
  ]);

  /** Login bo'yicha guruhlash: soni, oxirgi vaqt va turli IP soni. */
  function guruhla(rows: { userIsm: string | null; ip: string | null; createdAt: Date }[]) {
    const map = new Map<string, { soni: number; oxirgi: Date; iplar: Set<string> }>();
    for (const r of rows) {
      const kalit = r.userIsm ?? "(noma'lum)";
      const mavjud = map.get(kalit);
      if (mavjud) {
        mavjud.soni++;
        if (r.createdAt > mavjud.oxirgi) mavjud.oxirgi = r.createdAt;
        if (r.ip) mavjud.iplar.add(r.ip);
      } else {
        map.set(kalit, {
          soni: 1,
          oxirgi: r.createdAt,
          iplar: new Set(r.ip ? [r.ip] : []),
        });
      }
    }
    return [...map.entries()].map(([login, v]) => ({
      login,
      soni: v.soni,
      oxirgi: v.oxirgi,
      ipSoni: v.iplar.size,
    }));
  }

  const shubhaliLoginlar = guruhla(urinishlar)
    .sort((a, b) => b.soni - a.soni)
    .slice(0, 10);

  // Bir sutkada 2+ turli IP dan kirish — sessiya anomaliyasi belgisi.
  const kopIpdanKirganlar = guruhla(kirishlar)
    .filter((r) => r.ipSoni >= 2)
    .sort((a, b) => b.ipSoni - a.ipSoni)
    .slice(0, 10);

  return {
    muvaffaqiyatsiz24,
    muvaffaqiyatsiz7kun,
    muvaffaqiyatli24,
    faolSessiyalar,
    telegramUlangan,
    telegramJami,
    bloklanganUser,
    superadminSoni,
    shubhaliLoginlar,
    kopIpdanKirganlar,
    imtiyozliAmallar: imtiyozli.map((a) => ({
      id: a.id,
      kim: a.userIsm,
      amal: a.action,
      amalLabel: amalLabel(a.action),
      entity: a.entity,
      entityId: a.entityId,
      ip: a.ip,
      userAgent: a.userAgent,
      sabab: a.sabab,
      createdAt: a.createdAt,
    })),
  };
}
