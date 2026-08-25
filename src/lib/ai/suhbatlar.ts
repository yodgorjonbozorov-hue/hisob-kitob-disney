import { rawPrisma } from "@/lib/db/rawPrisma";
import type { Havola } from "./analitika";

/**
 * AI SUHBAT TARIXI — SERVER TOMONDA (S-7 himoyasining davomi).
 *
 * Mijoz FAQAT savolni va suhbat ID'sini yuboradi. Modelga ketadigan tarix
 * shu yerdan o'qiladi — foydalanuvchi soxta `assistant` xabarini yozib
 * modelni chalg'ita olmaydi (prompt injection).
 *
 * EGALIK: har so'rovda `businessId` VA `userId` sharti QO'LDA yoziladi.
 * ID'ni bilgan boshqa foydalanuvchi ham begona suhbatni ocha olmaydi
 * (IDOR himoyasi), boshqa tenant esa `businessId` orqali baribir tashqarida.
 *
 * `rawPrisma` ATAYLAB: bu vaqtinchalik suhbat holati, biznes amali emas —
 * tenant-scoped klient har xabarni audit jurnaliga yozib, jurnalni
 * shovqinga to'ldirardi (`lib/db/tenantDb.ts` dagi TIZIM_MODELLAR izohi).
 */

export interface SuhbatXabar {
  rol: "user" | "assistant";
  matn: string;
  /** Javob ostidagi drill-down havolalar (faqat assistant xabarlarida). */
  havolalar?: Havola[];
  /** Keyingi qadam chiplari (faqat assistant xabarlarida). */
  takliflar?: string[];
}

export interface SuhbatQator {
  id: string;
  sarlavha: string;
  yangilangan: string;
}

/** Bitta suhbatda saqlanadigan maksimal xabar soni. */
export const MAX_XABAR = 40;
/** Bitta foydalanuvchi + biznes uchun saqlanadigan suhbatlar soni. */
export const MAX_SUHBAT = 20;
/** Bitta xabarning saqlanadigan maksimal uzunligi (belgilarda). */
const MAX_UZUNLIK = 4000;

interface Kalit {
  businessId: string;
  userId: string;
}

function xabarlarniOqi(xom: string): SuhbatXabar[] {
  try {
    const parsed = JSON.parse(xom);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is SuhbatXabar =>
          x != null && typeof x.matn === "string" && (x.rol === "user" || x.rol === "assistant")
      )
      .slice(-MAX_XABAR);
  } catch {
    // Buzilgan yozuv — bo'sh suhbat (javob baribir chiqadi).
    return [];
  }
}

/** Foydalanuvchining shu bizneste ochgan suhbatlari (yangisi birinchi). */
export async function suhbatlarRoyxati(kalit: Kalit): Promise<SuhbatQator[]> {
  const rows = await rawPrisma.aiSuhbat.findMany({
    where: { businessId: kalit.businessId, userId: kalit.userId },
    orderBy: { updatedAt: "desc" },
    take: MAX_SUHBAT,
    select: { id: true, sarlavha: true, updatedAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    sarlavha: r.sarlavha,
    yangilangan: r.updatedAt.toISOString(),
  }));
}

/** Bitta suhbat xabarlari. Begona suhbat — null (topilmadi). */
export async function suhbatniOl(
  kalit: Kalit,
  suhbatId: string
): Promise<{ id: string; sarlavha: string; xabarlar: SuhbatXabar[] } | null> {
  const row = await rawPrisma.aiSuhbat.findFirst({
    where: { id: suhbatId, businessId: kalit.businessId, userId: kalit.userId },
  });
  if (!row) return null;
  return { id: row.id, sarlavha: row.sarlavha, xabarlar: xabarlarniOqi(row.xabarlar) };
}

/** Savoldan qisqa sarlavha — model chaqirilmaydi (token sarflashning ma'nosi yo'q). */
export function sarlavhaYasa(savol: string): string {
  const toza = savol.replace(/\s+/g, " ").trim();
  if (toza.length <= 40) return toza || "Yangi suhbat";
  return `${toza.slice(0, 40).trimEnd()}…`;
}

/**
 * Savol va javobni suhbatga yozadi. `suhbatId` berilmasa (yoki begona bo'lsa)
 * yangi suhbat ochiladi va uning ID'si qaytadi.
 */
export async function suhbatgaYoz(
  kalit: Kalit & { tenantId: string },
  suhbatId: string | null,
  savol: SuhbatXabar,
  javob: SuhbatXabar
): Promise<{ id: string; sarlavha: string }> {
  const kes = (x: SuhbatXabar): SuhbatXabar => ({ ...x, matn: x.matn.slice(0, MAX_UZUNLIK) });

  const mavjud = suhbatId ? await suhbatniOl(kalit, suhbatId) : null;
  const xabarlar = JSON.stringify([...(mavjud?.xabarlar ?? []), kes(savol), kes(javob)].slice(-MAX_XABAR));

  if (mavjud) {
    await rawPrisma.aiSuhbat.update({ where: { id: mavjud.id }, data: { xabarlar } });
    return { id: mavjud.id, sarlavha: mavjud.sarlavha };
  }

  const sarlavha = sarlavhaYasa(savol.matn);
  const yangi = await rawPrisma.aiSuhbat.create({
    data: {
      tenantId: kalit.tenantId,
      businessId: kalit.businessId,
      userId: kalit.userId,
      sarlavha,
      xabarlar,
    },
    select: { id: true },
  });
  await eskilarniTozala(kalit);
  return { id: yangi.id, sarlavha };
}

/** Suhbatni o'chiradi (faqat o'ziniki). */
export async function suhbatniOchir(kalit: Kalit, suhbatId: string): Promise<void> {
  await rawPrisma.aiSuhbat.deleteMany({
    where: { id: suhbatId, businessId: kalit.businessId, userId: kalit.userId },
  });
}

/** MAX_SUHBAT dan oshgan eng eski suhbatlarni o'chiradi (cheksiz o'smasin). */
async function eskilarniTozala(kalit: Kalit): Promise<void> {
  const eskilar = await rawPrisma.aiSuhbat.findMany({
    where: { businessId: kalit.businessId, userId: kalit.userId },
    orderBy: { updatedAt: "desc" },
    skip: MAX_SUHBAT,
    select: { id: true },
  });
  if (eskilar.length === 0) return;
  await rawPrisma.aiSuhbat.deleteMany({ where: { id: { in: eskilar.map((e) => e.id) } } });
}
