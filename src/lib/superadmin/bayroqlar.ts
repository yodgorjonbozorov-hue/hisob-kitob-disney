import { rawPrisma } from "@/lib/db/rawPrisma";
import { BadRequestError } from "@/lib/auth/guard";

/**
 * FEATURE FLAG'LAR (talab 31).
 *
 * Bayroq global tizim sozlamasi: `doira = "GLOBAL"` bo'lsa hammaga, `"TENANT"`
 * bo'lsa faqat `tenantIdlar` ro'yxatidagi kompaniyalarga ta'sir qiladi.
 *
 * Har o'zgarish auditga tushadi (route qatlamida) — bayroq mahsulot
 * xatti-harakatini o'zgartiradi, ya'ni u imtiyozli amal.
 */

export interface Bayroq {
  id: string;
  kalit: string;
  nomi: string;
  tavsif: string | null;
  doira: string;
  yoqilgan: boolean;
  tenantIdlar: string[];
  createdAt: Date;
  updatedAt: Date;
}

function parseIdlar(xom: string): string[] {
  try {
    const v: unknown = JSON.parse(xom);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function bayroqlarRoyxati(): Promise<Bayroq[]> {
  const rows = await rawPrisma.featureFlag.findMany({ orderBy: { kalit: "asc" } });
  return rows.map((r) => ({ ...r, tenantIdlar: parseIdlar(r.tenantIdlar) }));
}

export async function bayroqniOl(kalit: string): Promise<Bayroq | null> {
  const r = await rawPrisma.featureFlag.findUnique({ where: { kalit } });
  return r ? { ...r, tenantIdlar: parseIdlar(r.tenantIdlar) } : null;
}

export interface BayroqKirish {
  kalit: string;
  nomi: string;
  tavsif?: string | null;
  doira: "GLOBAL" | "TENANT";
  yoqilgan: boolean;
  tenantIdlar: string[];
}

export async function bayroqYarat(kirish: BayroqKirish): Promise<Bayroq> {
  const mavjud = await rawPrisma.featureFlag.findUnique({ where: { kalit: kirish.kalit } });
  if (mavjud) throw new BadRequestError(`'${kirish.kalit}' bayrog'i allaqachon mavjud`);
  const r = await rawPrisma.featureFlag.create({
    data: {
      kalit: kirish.kalit,
      nomi: kirish.nomi,
      tavsif: kirish.tavsif ?? null,
      doira: kirish.doira,
      yoqilgan: kirish.yoqilgan,
      tenantIdlar: JSON.stringify(kirish.tenantIdlar),
    },
  });
  return { ...r, tenantIdlar: parseIdlar(r.tenantIdlar) };
}

export async function bayroqYangila(
  id: string,
  kirish: Partial<BayroqKirish>
): Promise<{ oldingi: Bayroq; yangi: Bayroq }> {
  const eski = await rawPrisma.featureFlag.findUnique({ where: { id } });
  if (!eski) throw new BadRequestError("Bayroq topilmadi");

  const r = await rawPrisma.featureFlag.update({
    where: { id },
    data: {
      nomi: kirish.nomi ?? eski.nomi,
      tavsif: kirish.tavsif === undefined ? eski.tavsif : kirish.tavsif,
      doira: kirish.doira ?? eski.doira,
      yoqilgan: kirish.yoqilgan ?? eski.yoqilgan,
      tenantIdlar:
        kirish.tenantIdlar === undefined ? eski.tenantIdlar : JSON.stringify(kirish.tenantIdlar),
    },
  });
  return {
    oldingi: { ...eski, tenantIdlar: parseIdlar(eski.tenantIdlar) },
    yangi: { ...r, tenantIdlar: parseIdlar(r.tenantIdlar) },
  };
}

/**
 * Bayroq shu kompaniya uchun yoqilganmi.
 *
 * Mahsulot kodi shu funksiyani chaqiradi. Bayroq topilmasa — YOQILMAGAN
 * (fail-closed): yozilmagan bayroq hech qachon yangi xatti-harakatni
 * o'z-o'zidan ochib yubormaydi.
 */
export async function bayroqYoqilganmi(kalit: string, tenantId?: string | null): Promise<boolean> {
  const b = await bayroqniOl(kalit);
  if (!b || !b.yoqilgan) return false;
  if (b.doira === "GLOBAL") return true;
  return !!tenantId && b.tenantIdlar.includes(tenantId);
}
