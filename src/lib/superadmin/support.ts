import { rawPrisma } from "@/lib/db/rawPrisma";
import { BadRequestError } from "@/lib/auth/guard";
import { skip, sahifaNatija, type SahifaNatija, type SahifaSorovi } from "./sahifalash";
import type { TiketHolat as THolat, TiketMuhimlik as TMuhimlik } from "./turlar";

/**
 * SUPPORT MARKAZI (talab 21).
 *
 * Tiket har doim KOMPANIYAGA (tenant) bog'lanadi — "kimning muammosi"
 * degan savol javobsiz qolmasligi uchun. Yozishmada `ichki = true` bo'lgan
 * qayd faqat superadminlarga mo'ljallangan.
 */

// Yorliqlar va turlar CLIENT'ga ham kerak, shuning uchun ular sof
// `turlar.ts` faylida yashaydi va shu yerdan qayta eksport qilinadi.
export {
  HOLATLAR,
  MUHIMLIKLAR,
  HOLAT_LABEL,
  MUHIMLIK_LABEL,
  type TiketHolat,
  type TiketMuhimlik,
} from "./turlar";

export interface TiketFiltr {
  qidiruv?: string | null;
  holat?: string | null;
  muhimlik?: string | null;
  tenantId?: string | null;
  masulId?: string | null;
}

export interface TiketQator {
  id: string;
  tenantId: string;
  tenantNomi: string;
  mavzu: string;
  holat: string;
  muhimlik: string;
  masulIsm: string | null;
  muallifIsm: string | null;
  xabarSoni: number;
  createdAt: Date;
  updatedAt: Date;
}

function whereBoylab(f: TiketFiltr) {
  const AND: Record<string, unknown>[] = [];
  if (f.holat) AND.push({ holat: f.holat });
  if (f.muhimlik) AND.push({ muhimlik: f.muhimlik });
  if (f.tenantId) AND.push({ tenantId: f.tenantId });
  if (f.masulId) AND.push({ masulId: f.masulId });
  if (f.qidiruv) {
    const q = f.qidiruv.trim();
    AND.push({
      OR: [
        { mavzu: { contains: q } },
        { mavzu: { contains: q.toLowerCase() } },
        { tavsif: { contains: q } },
        { id: q },
      ],
    });
  }
  return AND.length > 0 ? { AND } : {};
}

export async function tiketlarRoyxati(
  filtr: TiketFiltr,
  sorov: SahifaSorovi
): Promise<SahifaNatija<TiketQator>> {
  const where = whereBoylab(filtr);
  const [jami, rows] = await Promise.all([
    rawPrisma.supportTicket.count({ where }),
    rawPrisma.supportTicket.findMany({
      where,
      // Ochiq va kritik tiketlar tepada bo'lishi uchun oxirgi harakat bo'yicha.
      orderBy: { updatedAt: "desc" },
      skip: skip(sorov),
      take: sorov.limit,
      select: {
        id: true,
        tenantId: true,
        mavzu: true,
        holat: true,
        muhimlik: true,
        createdAt: true,
        updatedAt: true,
        tenant: { select: { name: true } },
        masul: { select: { ism: true } },
        user: { select: { ism: true } },
        _count: { select: { xabarlar: true } },
      },
    }),
  ]);

  const qatorlar: TiketQator[] = rows.map((t) => ({
    id: t.id,
    tenantId: t.tenantId,
    tenantNomi: t.tenant.name,
    mavzu: t.mavzu,
    holat: t.holat,
    muhimlik: t.muhimlik,
    masulIsm: t.masul?.ism ?? null,
    muallifIsm: t.user?.ism ?? null,
    xabarSoni: t._count.xabarlar,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));

  return sahifaNatija(qatorlar, jami, sorov);
}

export async function tiketTafsiloti(id: string) {
  return rawPrisma.supportTicket.findUnique({
    where: { id },
    select: {
      id: true,
      tenantId: true,
      mavzu: true,
      tavsif: true,
      holat: true,
      muhimlik: true,
      createdAt: true,
      updatedAt: true,
      yopilganAt: true,
      tenant: { select: { name: true, slug: true, plan: true, status: true } },
      masul: { select: { id: true, ism: true } },
      user: { select: { id: true, ism: true, login: true } },
      xabarlar: {
        orderBy: { createdAt: "asc" },
        select: { id: true, muallifIsm: true, matn: true, ichki: true, createdAt: true },
      },
    },
  });
}

export interface TiketKirish {
  tenantId: string;
  mavzu: string;
  tavsif: string;
  muhimlik: TMuhimlik;
  /** Tiketni ochgan superadmin. */
  yaratuvchiId: string;
  yaratuvchiIsm: string;
}

export async function tiketYarat(kirish: TiketKirish) {
  const tenant = await rawPrisma.tenant.findUnique({
    where: { id: kirish.tenantId },
    select: { id: true, name: true },
  });
  if (!tenant) throw new BadRequestError("Kompaniya topilmadi");

  const tiket = await rawPrisma.supportTicket.create({
    data: {
      tenantId: kirish.tenantId,
      mavzu: kirish.mavzu,
      tavsif: kirish.tavsif,
      muhimlik: kirish.muhimlik,
      holat: "OCHIQ",
      masulId: kirish.yaratuvchiId,
    },
  });
  await rawPrisma.supportMessage.create({
    data: {
      ticketId: tiket.id,
      muallifId: kirish.yaratuvchiId,
      muallifIsm: kirish.yaratuvchiIsm,
      matn: kirish.tavsif,
      ichki: false,
    },
  });
  return { tiket, tenantNomi: tenant.name };
}

export interface TiketYangilash {
  holat?: THolat;
  muhimlik?: TMuhimlik;
  masulId?: string | null;
  xabar?: string;
  ichki?: boolean;
  muallifId: string;
  muallifIsm: string;
}

export async function tiketYangila(id: string, kirish: TiketYangilash) {
  const eski = await rawPrisma.supportTicket.findUnique({ where: { id } });
  if (!eski) throw new BadRequestError("Tiket topilmadi");

  const yopildi = kirish.holat === "YOPILDI" || kirish.holat === "YECHILDI";
  const yangi = await rawPrisma.supportTicket.update({
    where: { id },
    data: {
      holat: kirish.holat ?? eski.holat,
      muhimlik: kirish.muhimlik ?? eski.muhimlik,
      masulId: kirish.masulId === undefined ? eski.masulId : kirish.masulId,
      yopilganAt: yopildi ? (eski.yopilganAt ?? new Date()) : null,
    },
  });

  if (kirish.xabar) {
    await rawPrisma.supportMessage.create({
      data: {
        ticketId: id,
        muallifId: kirish.muallifId,
        muallifIsm: kirish.muallifIsm,
        matn: kirish.xabar,
        ichki: kirish.ichki ?? false,
      },
    });
  }

  return { oldingi: eski, yangi };
}

export interface SupportXulosa {
  ochiq: number;
  kutilmoqda: number;
  yechildi: number;
  yopilgan: number;
  kritik: number;
}

export async function supportXulosa(): Promise<SupportXulosa> {
  const holatlar = await rawPrisma.supportTicket.groupBy({
    by: ["holat"],
    _count: { _all: true },
  });
  const map = new Map(holatlar.map((h) => [h.holat, h._count._all]));
  const kritik = await rawPrisma.supportTicket.count({
    where: { muhimlik: "KRITIK", holat: { in: ["OCHIQ", "KUTILMOQDA"] } },
  });
  return {
    ochiq: map.get("OCHIQ") ?? 0,
    kutilmoqda: map.get("KUTILMOQDA") ?? 0,
    yechildi: map.get("YECHILDI") ?? 0,
    yopilgan: map.get("YOPILDI") ?? 0,
    kritik,
  };
}
