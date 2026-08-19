import { rawPrisma } from "@/lib/db/rawPrisma";
import { planByCode } from "@/lib/billing/plans";

/**
 * EKSPORT (talab 36).
 *
 * CSV — chunki u har joyda ochiladi va qo'shimcha kutubxona talab qilmaydi
 * (loyihada `exceljs` bor, lekin u tenant hisobotlari uchun og'ir yo'l).
 *
 * XAVFSIZLIK:
 *  · eksport `eksport.VIEW` ruxsatini talab qiladi (READ_ONLY roliga yopiq);
 *  · har eksport auditga SABAB bilan yoziladi (route qatlamida);
 *  · parol hash, token va Telegram chat ID kabi maydonlar CHIQMAYDI;
 *  · qator soni cheklangan — bitta so'rov butun bazani so'rib ololmaydi.
 */

/** Bitta eksportdagi maksimal qator soni. */
export const EKSPORT_LIMIT = 10_000;

export type EksportTuri = "bizneslar" | "foydalanuvchilar" | "obunalar" | "billing" | "audit";

/** CSV katakchasi: qo'shtirnoq, vergul va yangi qator xavfsiz belgilanadi. */
function katak(v: unknown): string {
  if (v == null) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  // Formula injection: `=`, `+`, `-`, `@` bilan boshlanadigan matn Excel'da
  // formula sifatida bajarilishi mumkin — apostrof bilan neytrallanadi.
  const xavfsiz = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${xavfsiz.replace(/"/g, '""')}"`;
}

function csv(sarlavhalar: string[], qatorlar: unknown[][]): string {
  const satrlar = [sarlavhalar.map(katak).join(",")];
  for (const q of qatorlar) satrlar.push(q.map(katak).join(","));
  // BOM — Excel UTF-8 ni to'g'ri o'qishi uchun (o'zbekcha harflar buzilmasin).
  return `﻿${satrlar.join("\r\n")}\r\n`;
}

export interface EksportNatija {
  faylNomi: string;
  csv: string;
  qatorSoni: number;
}

export async function eksportQil(turi: EksportTuri, now: Date = new Date()): Promise<EksportNatija> {
  const sana = now.toISOString().slice(0, 10);

  if (turi === "bizneslar") {
    const rows = await rawPrisma.tenant.findMany({
      take: EKSPORT_LIMIT,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        plan: true,
        bepul: true,
        createdAt: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
        _count: { select: { users: true, businesses: true } },
      },
    });
    return {
      faylNomi: `balansa-bizneslar-${sana}.csv`,
      qatorSoni: rows.length,
      csv: csv(
        ["ID", "Nomi", "Slug", "Holat", "Tarif", "Bepul", "Foydalanuvchi", "Biznes", "Yaratilgan", "Sinov tugashi", "Obuna tugashi"],
        rows.map((t) => [
          t.id,
          t.name,
          t.slug,
          t.status,
          t.plan,
          t.bepul ? "ha" : "yo'q",
          t._count.users,
          t._count.businesses,
          t.createdAt,
          t.trialEndsAt,
          t.currentPeriodEnd,
        ])
      ),
    };
  }

  if (turi === "foydalanuvchilar") {
    const rows = await rawPrisma.user.findMany({
      take: EKSPORT_LIMIT,
      orderBy: { createdAt: "desc" },
      // Parol hash va Telegram chat ID ATAYLAB tanlanmaydi.
      select: {
        id: true,
        ism: true,
        login: true,
        rol: true,
        superadminRol: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        tenant: { select: { name: true } },
      },
    });
    return {
      faylNomi: `balansa-foydalanuvchilar-${sana}.csv`,
      qatorSoni: rows.length,
      csv: csv(
        ["ID", "Ism", "Login", "Rol", "Superadmin roli", "Faol", "Kompaniya", "Yaratilgan", "Oxirgi kirish"],
        rows.map((u) => [
          u.id,
          u.ism,
          u.login,
          u.rol,
          u.superadminRol ?? "",
          u.isActive ? "ha" : "yo'q",
          u.tenant?.name ?? "",
          u.createdAt,
          u.lastLoginAt,
        ])
      ),
    };
  }

  if (turi === "obunalar") {
    const rows = await rawPrisma.tenant.findMany({
      take: EKSPORT_LIMIT,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        plan: true,
        status: true,
        bepul: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
      },
    });
    return {
      faylNomi: `balansa-obunalar-${sana}.csv`,
      qatorSoni: rows.length,
      csv: csv(
        ["Kompaniya ID", "Nomi", "Tarif", "Holat", "Bepul", "Oylik narx", "Muddat"],
        rows.map((t) => [
          t.id,
          t.name,
          t.plan,
          t.status,
          t.bepul ? "ha" : "yo'q",
          t.bepul ? 0 : (planByCode(t.plan)?.oylikNarx ?? 0),
          t.status === "TRIAL" ? t.trialEndsAt : t.currentPeriodEnd,
        ])
      ),
    };
  }

  if (turi === "billing") {
    const rows = await rawPrisma.payment.findMany({
      take: EKSPORT_LIMIT,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        provider: true,
        status: true,
        plan: true,
        externalId: true,
        paidAt: true,
        createdAt: true,
        tenant: { select: { name: true } },
      },
    });
    return {
      faylNomi: `balansa-tolovlar-${sana}.csv`,
      qatorSoni: rows.length,
      csv: csv(
        ["ID", "Kompaniya", "Summa (so'm)", "Provayder", "Holat", "Tarif", "Tashqi ID", "To'langan", "Yaratilgan"],
        rows.map((p) => [
          p.id,
          p.tenant.name,
          p.amount,
          p.provider,
          p.status,
          p.plan ?? "",
          p.externalId ?? "",
          p.paidAt,
          p.createdAt,
        ])
      ),
    };
  }

  const rows = await rawPrisma.auditLog.findMany({
    take: EKSPORT_LIMIT,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      userIsm: true,
      action: true,
      entity: true,
      entityId: true,
      tenantId: true,
      ip: true,
      sabab: true,
    },
  });
  return {
    faylNomi: `balansa-audit-${sana}.csv`,
    qatorSoni: rows.length,
    csv: csv(
      ["ID", "Vaqt", "Kim", "Amal", "Obyekt", "Obyekt ID", "Kompaniya ID", "IP", "Sabab"],
      rows.map((a) => [
        a.id,
        a.createdAt,
        a.userIsm ?? "",
        a.action,
        a.entity,
        a.entityId,
        a.tenantId ?? "",
        a.ip ?? "",
        a.sabab ?? "",
      ])
    ),
  };
}
