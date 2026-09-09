import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * QARZ AUDIT TARIXI — direktor bajargan tuzatish va o'chirishlar (7-talab).
 *
 * MANBA — MAVJUD `AuditLog` jadvali. Yangi "qarz tarixi" jadvali ochilmadi:
 * audit allaqachon butun tizimda bitta joyda yig'iladi (kim, qachon, qaysi
 * IP, eski→yangi qiymat), ikkinchi jurnal esa ikkita haqiqat manbai
 * bo'lardi.
 *
 * O'CHIRILGAN QARZ YOZUVI YO'QOLMAYDI: `AuditLog` da qarzga FK YO'Q —
 * `entityId` shunchaki matn. Shu bois qarz o'chirilsa ham jurnal joyida
 * qoladi, mijoz nomi va summa esa `before` suratida saqlanadi
 * (lib/services/qarzTuzatish.ts).
 */

/** Bitta maydonning eski→yangi o'zgarishi (audit kartasida ko'rsatiladi). */
export interface QarzAuditOzgarish {
  /** Maydon kaliti — `MAYDON_NOMI` dagi o'zbekcha yorliq shu bo'yicha olinadi. */
  maydon: string;
  /** Ko'rsatishga tayyor matn ("—" — qiymat bo'lmagan). */
  eski: string;
  yangi: string;
  /** Pul maydonimi — interfeys uni "so'm" bilan ko'rsatadi. */
  pulmi: boolean;
}

export interface QarzAuditDTO {
  id: string;
  /** "update" — tuzatildi, "delete" — o'chirildi, "create" — yaratildi. */
  amal: string;
  /** Qarz IDsi (o'chirilgan bo'lsa ham matn sifatida qoladi). */
  debtId: string;
  /** Mijoz yoki ta'minotchi nomi — suratdan (o'chirilgandan keyin ham o'qiladi). */
  qarzdor: string | null;
  /** "olinadigan" (mijoz) | "beriladigan" (ta'minotchi). */
  turi: string | null;
  /** Eski summa (so'm) — bo'lmasa null. */
  eskiSumma: number | null;
  /** Yangi summa (so'm) — bo'lmasa null. */
  yangiSumma: number | null;
  /**
   * MAYDONMA-MAYDON O'ZGARISHLAR — "eski qiymat → yangi qiymat" talabi.
   * Faqat HAQIQATAN o'zgarganlari; o'zgarmagan maydon ro'yxatga tushmaydi.
   */
  ozgarishlar: QarzAuditOzgarish[];
  /** To'liq eski/yangi surat — tafsilot uchun (JSON matn). */
  oldin: string | null;
  keyin: string | null;
  /** Amalni bajargan foydalanuvchi (snapshot — o'chirilsa ham o'qiladi). */
  kim: string | null;
  kimId: string | null;
  /** Direktor kiritgan sabab/izoh. */
  sabab: string | null;
  vaqt: string;
}

function son(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function matn(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function xavfsizParse(s: string | null): Record<string, unknown> | null {
  if (!s) return null;
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * TAQQOSLANADIGAN MAYDONLAR — direktor tahrirlay oladigan hammasi.
 *
 * Tartib ataylab: interfeysdagi forma tartibi bilan bir xil, ya'ni
 * kartadagi ro'yxat direktor ko'rgan ekranni takrorlaydi.
 */
const MAYDONLAR: { kalit: string; nomi: string; pulmi?: boolean; sanami?: boolean }[] = [
  { kalit: "jamiSumma", nomi: "Summa", pulmi: true },
  { kalit: "mijozNomi", nomi: "Mijoz" },
  { kalit: "mijozTel", nomi: "Telefon" },
  { kalit: "sana", nomi: "Berilgan sana", sanami: true },
  { kalit: "muddat", nomi: "Muddat", sanami: true },
  { kalit: "izoh", nomi: "Izoh" },
  { kalit: "status", nomi: "Holat" },
];

/** ISO sanadan "YYYY-MM-DD" — vaqt qismi audit kartasida shovqin. */
function sanaMatn(v: unknown): string {
  const s = matn(v);
  return s ? s.slice(0, 10) : "—";
}

function qiymatMatn(v: unknown, sanami: boolean): string {
  if (sanami) return sanaMatn(v);
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return String(v);
  return typeof v === "string" ? v : "—";
}

/**
 * ESKI → YANGI farqi. `update` amalida ikkala surat ham bor; `create` va
 * `delete` da bitta tomon yo'q, u yerda ro'yxat bo'sh qoladi (karta
 * o'rniga summani ko'rsatadi).
 */
function ozgarishlarniHisobla(
  oldin: Record<string, unknown> | null,
  keyin: Record<string, unknown> | null
): QarzAuditOzgarish[] {
  if (!oldin || !keyin) return [];
  const natija: QarzAuditOzgarish[] = [];
  for (const m of MAYDONLAR) {
    if (!(m.kalit in oldin) && !(m.kalit in keyin)) continue;
    const a = oldin[m.kalit] ?? null;
    const b = keyin[m.kalit] ?? null;
    // Sanani KUN aniqligida taqqoslaymiz: ayni kun turli ISO satr bilan
    // yozilgan bo'lsa (vaqt qismi) uni "o'zgardi" deb ko'rsatmaslik kerak.
    const eski = qiymatMatn(a, !!m.sanami);
    const yangi = qiymatMatn(b, !!m.sanami);
    if (eski === yangi) continue;
    natija.push({ maydon: m.nomi, eski, yangi, pulmi: !!m.pulmi });
  }
  return natija;
}

export interface QarzAuditFiltr {
  businessId: string;
  /** "update" | "delete" | "create" — bo'lmasa hammasi. */
  amal?: string | null;
  /** Qarzdor nomi bo'yicha qidiruv (suratdagi nom). */
  q?: string | null;
  page?: number;
  pageSize?: number;
}

export async function listQarzAudit(filtr: QarzAuditFiltr) {
  if (!filtr.businessId) throw new Error("listQarzAudit: businessId majburiy");
  const page = Math.max(1, filtr.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filtr.pageSize ?? 30));

  const where: Prisma.AuditLogWhereInput = {
    businessId: filtr.businessId,
    entity: "debt",
    // Yaratish ham tarixning bir qismi, lekin sahifaning MAQSADI —
    // tuzatish va o'chirish (direktor amallari). Filtr berilmasa
    // uchalasi ham ko'rinadi: "bu qarz qayerdan paydo bo'ldi" savoli
    // ham shu lentada javob topsin.
    ...(filtr.amal ? { action: filtr.amal } : {}),
  };

  const [xom, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const items: QarzAuditDTO[] = xom.map((a) => {
    const oldin = xavfsizParse(a.before);
    const keyin = xavfsizParse(a.after);
    return {
      id: a.id,
      amal: a.action,
      debtId: a.entityId,
      qarzdor: matn(keyin?.mijozNomi) ?? matn(oldin?.mijozNomi),
      turi: matn(oldin?.turi) ?? matn(keyin?.turi),
      eskiSumma: son(oldin?.jamiSumma),
      yangiSumma: son(keyin?.jamiSumma),
      ozgarishlar: ozgarishlarniHisobla(oldin, keyin),
      oldin: a.before,
      keyin: a.after,
      kim: a.userIsm,
      kimId: a.userId,
      // Sabab ustunda (yangi yozuvlar) yoki eski yozuvlarda `after.sabab` da.
      sabab: matn(a.sabab) ?? matn(keyin?.sabab),
      vaqt: a.createdAt.toISOString(),
    };
  });

  // Qidiruv suratdagi NOM bo'yicha — u JSON ichida, shuning uchun bazada
  // emas, o'qilgandan keyin filtrlanadi (sahifa hajmi cheklangan).
  const q = filtr.q?.trim().toLowerCase();
  const natija = q
    ? items.filter((i) => (i.qarzdor ?? "").toLowerCase().includes(q))
    : items;

  return { items: natija, total, page, pageSize };
}
