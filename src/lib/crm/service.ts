import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { dateOnlyStringToUTCDate, todayTashkentDateOnlyString, utcDateToDateOnlyString } from "@/lib/date";
import { runBusinessTx } from "@/lib/db/businessTx";
import { kirimgaKochirish } from "@/lib/crm/kirim";
// Aylanma import (yakunlash.ts ham shu fayldan `pipelineBosqichlari` ni oladi)
// xavfsiz: ikkala tomon ham faqat CHAQIRUV vaqtida murojaat qiladi.
import { zakazniYakunlash } from "@/lib/crm/yakunlash";
// Aylanma import YO'Q: `qaytarish.ts` bu fayldan hech narsa olmaydi.
import { zakazMoliyasiniQaytarish } from "@/lib/crm/qaytarish";
import {
  tolovHolati,
  yopiqHolat,
  zakazUstuni,
  type TolovHolat,
  type Ustun,
  type ZakazHolat,
} from "@/lib/crm/pipeline";
import { biznesXodimlariWhere } from "@/lib/services/userBiznes";
import {
  tolovlarJami,
  tolovlarniTekshir,
  tolovSatrlariniYoz,
  tolovTuriBelgisi,
  type TolovSatri,
} from "@/lib/crm/tolovlar";
import {
  sotuvchiUserIdTop,
  zakazXodimlariniSaqlash,
  zakazXodimlariniTekshir,
} from "@/lib/services/zakazJamoasi";
import {
  sotuvchiKategoriyaIdlari,
  sotuvchiMajburiymi,
  sotuvchiTekshir,
  zakazSotuvchilari,
  SOTUVCHI_TURI,
} from "@/lib/services/zakazSotuvchi";
import type { ZakazXodimInput } from "@/lib/validation/xodimKategoriya";

/**
 * CRM xizmat qatlami. Barcha funksiyalar tenant kontekstida chaqiriladi —
 * prisma avtomatik izolyatsiyalangan.
 *
 * CRM — KUNLIK BUYURTMALAR doskasi. Buyurtma kategoriyasi Kirim modulidagi
 * AYNAN o'sha `Category` jadvalidan olinadi (alohida CRM kategoriya tizimi
 * yo'q), pul esa faqat "Kirimga o'tkazish" bosilganda yoziladi
 * (`lib/crm/kirim.ts`).
 */

/**
 * ZAKAZ OQIMI BOSQICHLARI.
 *
 * Doskaning ustunlari BOSQICHDAN emas, `Deal.holat` + `Deal.sana` dan
 * hisoblanadi (`lib/crm/pipeline.ts`). Bosqich esa saqlanib qoldi va
 * holatning KO'ZGUSI sifatida sinxron yuritiladi, chunki dashboard, AI
 * analitikasi va xodim reytingi hali `Stage.turi` (OPEN/WON/LOST) ni
 * o'qiydi — ular hech qanday o'zgarishsiz ishlashda davom etadi.
 */
export const JARAYON_BOSQICHI = "Jarayonda";

export const DEFAULT_STAGES: { nomi: string; turi: "OPEN" | "WON" | "LOST" }[] = [
  { nomi: "Kutilayotgan zakazlar", turi: "OPEN" },
  { nomi: JARAYON_BOSQICHI, turi: "OPEN" },
  { nomi: "Yutildi", turi: "WON" },
  { nomi: "Yo'qotildi", turi: "LOST" },
];

/** Biznesda bosqichlar bo'lmasa standart to'plamni yaratadi (idempotent). */
export async function ensureStages(businessId: string) {
  const bor = await prisma.stage.count({ where: { businessId } });
  if (bor > 0) return;
  await prisma.stage.createMany({
    data: DEFAULT_STAGES.map((s, i) => ({ businessId, nomi: s.nomi, turi: s.turi, tartib: i })),
  });
}

/**
 * HOLAT → BOSQICH XARITASI (idempotent).
 *
 * Eski bizneslarda bosqichlar boshqacha nomlangan ("Yangi", "Aloqa
 * qilindi", ...) — ular O'CHIRILMAYDI: eski zakazlar hali ularga
 * bog'langan va tarix buzilmasligi kerak. Yetishmagani (masalan
 * "Jarayonda") shu yerda qo'shiladi.
 */
export async function pipelineBosqichlari(businessId: string): Promise<Record<ZakazHolat, string>> {
  await ensureStages(businessId);
  const stages = await prisma.stage.findMany({
    where: { businessId },
    orderBy: { tartib: "asc" },
    select: { id: true, nomi: true, turi: true, tartib: true },
  });

  const oxirgiTartib = stages.reduce((m, s) => Math.max(m, s.tartib), -1);
  let keyingiTartib = oxirgiTartib + 1;
  const yarat = async (nomi: string, turi: "OPEN" | "WON" | "LOST") => {
    const s = await prisma.stage.create({
      data: { businessId, nomi, turi, tartib: keyingiTartib++ },
      select: { id: true },
    });
    return s.id;
  };

  // KUTILMOQDA — birinchi OPEN bosqich (eski bizneslarda "Yangi").
  const kutilmoqda =
    stages.find((s) => s.turi === "OPEN")?.id ?? (await yarat("Kutilayotgan zakazlar", "OPEN"));
  // JARAYONDA — nomi bo'yicha, chunki `Stage.turi` da "jarayon" turi yo'q
  // (uni qo'shish barcha eski o'quvchilarni sindirardi).
  const jarayonda =
    stages.find((s) => s.turi === "OPEN" && s.nomi === JARAYON_BOSQICHI)?.id ??
    (await yarat(JARAYON_BOSQICHI, "OPEN"));
  const yutildi = stages.find((s) => s.turi === "WON")?.id ?? (await yarat("Yutildi", "WON"));
  const yoqotildi = stages.find((s) => s.turi === "LOST")?.id ?? (await yarat("Yo'qotildi", "LOST"));

  return { KUTILMOQDA: kutilmoqda, JARAYONDA: jarayonda, YUTILDI: yutildi, YOQOTILDI: yoqotildi };
}

/**
 * BOSQICH → HOLAT. Eski yo'l (bosqich berish/sudrash) hali ishlaydi,
 * shuning uchun teskari yo'nalish ham YAGONA joyda yoziladi: `holat`
 * haqiqat manbai bo'lgani uchun bosqich berilganda u ham to'g'ri
 * to'ldirilishi shart, aks holda doska va statistika bir-biriga zid
 * bo'lib qolardi.
 */
export function bosqichdanHolat(stage: { turi: string; nomi: string }): ZakazHolat {
  if (stage.turi === "WON") return "YUTILDI";
  if (stage.turi === "LOST") return "YOQOTILDI";
  if (stage.nomi === JARAYON_BOSQICHI) return "JARAYONDA";
  return "KUTILMOQDA";
}

/**
 * DOSKA FILTRI (12-talab). Sana filtri ZAKAZ SANASI bo'yicha kesadi
 * (`sana` bo'lmagan eski zakazlarda `createdAt`), sotuvchi — mas'ul xodim,
 * kategoriya — Kirim kategoriyasi.
 */
export interface DoskaFiltr {
  /** "YYYY-MM-DD" (inclusive). */
  from?: string | null;
  /** "YYYY-MM-DD" (inclusive). */
  to?: string | null;
  masulId?: string | null;
  categoryId?: string | null;
  /**
   * SOTUVCHI FILTRI (Employee.id). Saralash BAZADA bo'ladi —
   * `DealEmployee(businessId, employeeId)` indeksi bo'yicha, ya'ni 500 ta
   * zakazni olib kelib brauzerda saralash emas.
   */
  sotuvchiId?: string | null;
  /**
   * TO'LOV HOLATI ("TOLANGAN" | "QISMAN" | "QARZ" | "TANLANMAGAN").
   * BAZADA ifodalanmaydi (`summa` va `tolangan` ustunlarini solishtiradi),
   * shuning uchun o'qishdan keyin qo'llanadi.
   */
  tolov?: TolovHolat | null;
  /** Arxiv (yo'qotilgan) zakazlar ham qaytsinmi. */
  yoqotilgan?: boolean;
}

const KUN_MS = 24 * 60 * 60 * 1000;

/** Sana sharti: zakaz sanasi (bo'lmasa `createdAt`) oraliq ichida. */
function sanaShart(from?: string | null, to?: string | null) {
  if (!from && !to) return {};
  const gte = from ? dateOnlyStringToUTCDate(from) : undefined;
  const lt = to ? new Date(dateOnlyStringToUTCDate(to).getTime() + KUN_MS) : undefined;
  const oraliq = { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) };
  return { OR: [{ sana: oraliq }, { sana: null, createdAt: oraliq }] };
}

/**
 * Kanban ma'lumoti: bosqichlar + zakazlar (kontakt, kategoriya, kirim va
 * qarz bog'lanishi bilan).
 *
 * USTUN BU YERDA TANLANMAYDI: har zakaz `holat` + `sana` bilan qaytadi,
 * ustunni `lib/crm/pipeline.ts` dagi `zakazUstuni` hisoblaydi — server ham,
 * brauzer ham ayni qoidadan foydalanadi.
 *
 * Zakaz SOTUVCHILARI bitta qo'shimcha so'rovda o'qiladi (N+1 yo'q) va
 * `sotuvchilar` xaritasida qaytadi.
 */
export async function getBoard(businessId: string, filtr: DoskaFiltr = {}) {
  await ensureStages(businessId);
  const [stages, deals] = await Promise.all([
    prisma.stage.findMany({ where: { businessId }, orderBy: { tartib: "asc" } }),
    prisma.deal.findMany({
      where: {
        businessId,
        deletedAt: null,
        ...(filtr.yoqotilgan ? {} : { holat: { not: "YOQOTILDI" } }),
        ...(filtr.masulId ? { masulId: filtr.masulId } : {}),
        ...(filtr.categoryId ? { categoryId: filtr.categoryId } : {}),
        // SOTUVCHI FILTRI — biriktiruv jadvali orqali, bazada.
        ...(filtr.sotuvchiId
          ? {
              xodimlar: {
                some: { businessId, employeeId: filtr.sotuvchiId, category: { turi: SOTUVCHI_TURI } },
              },
            }
          : {}),
        ...sanaShart(filtr.from, filtr.to),
      },
      include: {
        contact: { select: { id: true, ism: true, tel: true } },
        category: { select: { id: true, nomi: true } },
        // Kirim/qarz summasi YOZUVNING O'ZIDAN o'qiladi: o'chirilgan yoki
        // tahrirlangan tranzaksiya doskada eski raqam bo'lib qolmasin.
        transaction: { select: { id: true, summa: true, deletedAt: true } },
        debt: { select: { id: true, jamiSumma: true, tolangan: true, status: true } },
      },
      // USTUN ICHIDAGI TARTIB bu yerda EMAS: uni `zakazlarniTartibla`
      // (`lib/crm/pipeline.ts`) hisoblaydi — "Yutildi"ga endigina o'tgan
      // zakaz ustun tepasida turadi. Bu yerdagi tartib faqat 500 lik
      // oynani barqaror qiladi.
      orderBy: [{ sana: "asc" }, { createdAt: "desc" }],
      take: 500, // sog'lom chegara; arxiv alohida filtr bilan ochiladi
    }),
  ]);
  const sotuvchilar = await zakazSotuvchilari(businessId, deals.map((d) => d.id));
  return { stages, deals, sotuvchilar };
}

/** Doskada bir marta ko'rsatiladigan zakazlar soni ("Yana ko'rsatish" qadami). */
export const DOSKA_SAHIFA = 10;

/** Doska so'rovlarida takrorlanadigan bog'lanishlar (kirim/qarz raqamlari uchun). */
const ZAKAZ_INCLUDE = {
  contact: { select: { id: true, ism: true, tel: true } },
  category: { select: { id: true, nomi: true } },
  // Kirim/qarz summasi YOZUVNING O'ZIDAN o'qiladi: o'chirilgan yoki
  // tahrirlangan tranzaksiya doskada eski raqam bo'lib qolmasin.
  transaction: { select: { id: true, summa: true, deletedAt: true } },
  debt: { select: { id: true, jamiSumma: true, tolangan: true, status: true } },
  // ARALASH TO'LOV qatorlari: har kanal alohida kirim yozadi, shuning uchun
  // kartadagi "Kirim" raqami qatorlardan yig'iladi.
  tolovlar: {
    select: {
      id: true,
      kanal: true,
      summa: true,
      transaction: { select: { id: true, summa: true, deletedAt: true } },
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.DealInclude;

/** Filtrning BAZADA ifodalanadigan qismi (to'lov holati bundan tashqarida). */
function filtrWhere(businessId: string, filtr: DoskaFiltr): Prisma.DealWhereInput {
  return {
    businessId,
    deletedAt: null,
    ...(filtr.masulId ? { masulId: filtr.masulId } : {}),
    ...(filtr.categoryId ? { categoryId: filtr.categoryId } : {}),
    // SOTUVCHI FILTRI — biriktiruv jadvali orqali, bazada.
    ...(filtr.sotuvchiId
      ? {
          xodimlar: {
            some: { businessId, employeeId: filtr.sotuvchiId, category: { turi: SOTUVCHI_TURI } },
          },
        }
      : {}),
    ...sanaShart(filtr.from, filtr.to),
  };
}

/**
 * USTUN SHARTI — `zakazUstuni` ning SQL ko'rinishi.
 *
 * Ikkalasi AYNI qoidani ifodalaydi, shuning uchun ular yonma-yon turadi:
 * "Bugungi" — alohida holat emas, `KUTILMOQDA` + `sana = bugun`.
 */
function ustunWhere(ustun: Ustun, bugun: string): Prisma.DealWhereInput {
  const bugunUTC = dateOnlyStringToUTCDate(bugun);
  if (ustun === "YUTILDI") return { holat: "YUTILDI" };
  if (ustun === "YOQOTILDI") return { holat: "YOQOTILDI" };
  if (ustun === "JARAYONDA") return { holat: "JARAYONDA" };
  if (ustun === "BUGUNGI") return { holat: "KUTILMOQDA", sana: bugunUTC };
  return { holat: "KUTILMOQDA", NOT: { sana: bugunUTC } };
}

/**
 * USTUN TARTIBI — `zakazlarniTartibla` ning SQL ko'rinishi.
 *
 *   TARIX ustunlari (Yutildi/Jarayonda/Yo'qotildi) — holatga oxirgi o'tgan
 *   zakaz ENG TEPADA (`holatAt` kamayish tartibida);
 *   REJA ustunlari (Kutilayotgan/Bugungi) — yaqin kun tepada, ya'ni
 *   kechikkanlar birinchi bo'lib chiqadi (`sana` o'sish tartibida).
 *
 * Oxirgi kalit — `id`: teng qiymatlarda tartib BARQAROR bo'lsin, aks holda
 * "Yana ko'rsatish" bir zakazni ikki marta yoki umuman ko'rsatmasligi mumkin.
 */
function ustunOrderBy(ustun: Ustun): Prisma.DealOrderByWithRelationInput[] {
  if (ustun === "KUTILAYOTGAN" || ustun === "BUGUNGI") {
    return [{ sana: "asc" }, { holatAt: "desc" }, { id: "desc" }];
  }
  return [{ holatAt: "desc" }, { createdAt: "desc" }, { id: "desc" }];
}

export interface UstunSahifa {
  ustun: Ustun;
  deals: Awaited<ReturnType<typeof zakazlarniOqi>>;
  /** Keyingi sahifa kaliti (oxirgi zakaz id'si). `null` — boshqa zakaz yo'q. */
  kursor: string | null;
  /** Ustundagi JAMI zakaz soni (sahifadan qat'i nazar) — sarlavha uchun. */
  jami: number;
  /** Ustundagi jami summa. */
  summa: number;
  sotuvchilar: Awaited<ReturnType<typeof zakazSotuvchilari>>;
}

async function zakazlarniOqi(where: Prisma.DealWhereInput, orderBy: Prisma.DealOrderByWithRelationInput[], take: number, kursor?: string | null) {
  return prisma.deal.findMany({
    where,
    include: ZAKAZ_INCLUDE,
    orderBy,
    take,
    ...(kursor ? { cursor: { id: kursor }, skip: 1 } : {}),
  });
}

/**
 * BITTA USTUNNING BIR SAHIFASI — server tomonda kesilgan (10 tadan).
 *
 * NEGA SERVER TOMONDA: ilgari doska 500 ta zakazni bir yo'la olib kelib
 * brauzerda ko'rsatardi — sahifa cho'zilib ketar, mobil qurilmada esa
 * ortiqcha ma'lumot yuklanardi. Endi har ustun O'Z kesimini kursor bilan
 * oladi, "Yana ko'rsatish" esa keyingi 10 tasini so'raydi.
 *
 * TO'LOV HOLATI filtri (`filtr.tolov`) BAZADA ifodalanmaydi — u `summa` va
 * `tolangan` ustunlarini SOLISHTIRADI, Prisma esa ustunni ustunga
 * taqqoslay olmaydi. Shu sabab u o'qishdan keyin qo'llanadi va sahifa
 * to'lguncha bir necha bo'lak o'qiladi (chegara bilan, cheksiz aylanish yo'q).
 */
export async function ustunSahifasi(
  businessId: string,
  ustun: Ustun,
  filtr: DoskaFiltr,
  opts: { bugun: string; kursor?: string | null; limit?: number }
): Promise<UstunSahifa> {
  const limit = Math.min(50, Math.max(1, opts.limit ?? DOSKA_SAHIFA));
  const where: Prisma.DealWhereInput = {
    ...filtrWhere(businessId, filtr),
    ...ustunWhere(ustun, opts.bugun),
  };
  const orderBy = ustunOrderBy(ustun);

  let deals: Awaited<ReturnType<typeof zakazlarniOqi>> = [];
  let kursor = opts.kursor ?? null;
  let tugadi = false;

  if (!filtr.tolov) {
    deals = await zakazlarniOqi(where, orderBy, limit, kursor);
    tugadi = deals.length < limit;
  } else {
    // To'lov holati filtri: sahifa to'lguncha bo'laklab o'qiymiz.
    const bolak = limit * 3;
    for (let i = 0; i < 5 && deals.length < limit; i++) {
      const xom = await zakazlarniOqi(where, orderBy, bolak, kursor);
      if (xom.length === 0) {
        tugadi = true;
        break;
      }
      kursor = xom[xom.length - 1].id;
      deals = deals.concat(
        xom.filter((d) => tolovHolati(d.summa, d.tolangan, d.tolovTuri) === (filtr.tolov as TolovHolat))
      );
      if (xom.length < bolak) {
        tugadi = true;
        break;
      }
    }
    deals = deals.slice(0, limit);
  }

  // JAMI: sarlavhadagi "N ta • summa" sahifadan EMAS, butun ustundan.
  // To'lov filtri bazada ifodalanmagani uchun u chegaralangan o'qish bilan
  // sanaladi (500 — doskaning avvalgi chegarasi bilan bir xil).
  let jami: number;
  let summa: number;
  if (!filtr.tolov) {
    const agg = await prisma.deal.aggregate({ where, _count: { _all: true }, _sum: { summa: true } });
    jami = agg._count._all;
    summa = agg._sum.summa ?? 0;
  } else {
    const hammasi = await prisma.deal.findMany({
      where,
      select: { summa: true, tolangan: true, tolovTuri: true },
      take: 500,
    });
    const mos = hammasi.filter(
      (d) => tolovHolati(d.summa, d.tolangan, d.tolovTuri) === (filtr.tolov as TolovHolat)
    );
    jami = mos.length;
    summa = mos.reduce((s, d) => s + d.summa, 0);
  }

  const oxirgi = deals.length > 0 ? deals[deals.length - 1].id : null;
  const sotuvchilar = await zakazSotuvchilari(businessId, deals.map((d) => d.id));
  return {
    ustun,
    deals,
    kursor: tugadi || deals.length === 0 ? null : oxirgi,
    jami,
    summa,
    sotuvchilar,
  };
}

/** Doskaning BOSHLANG'ICH holati: har ustunning birinchi sahifasi. */
export async function doskaSahifalari(
  businessId: string,
  filtr: DoskaFiltr,
  bugun: string,
  ustunlar: Ustun[]
): Promise<UstunSahifa[]> {
  await ensureStages(businessId);
  return Promise.all(ustunlar.map((u) => ustunSahifasi(businessId, u, filtr, { bugun })));
}

/**
 * ZAKAZNI BOSHQA HOLATGA O'TKAZISH — PULSIZ o'tishlar uchun
 * (KUTILMOQDA ↔ JARAYONDA ↔ YOQOTILDI).
 *
 * YUTILDI bu yerda EMAS: u moliyaviy yakun (kirim + qarzdorlik) va
 * `lib/crm/yakunlash.ts` da atomik bajariladi. Shu funksiya YUTILDI
 * so'ralsa ataylab rad etadi — pul yozadigan yo'l bitta bo'lsin.
 *
 * ═══ YUTILDI DAN QAYTARISH (direktor) ═══
 * Moliyaga o'tgan zakaz ilgari umuman qaytarilmasdi. Endi qaytariladi,
 * lekin FAQAT boshqaruvchiga va faqat moliya bilan BIRGA:
 * `lib/crm/qaytarish.ts` kirimni yumshoq o'chiradi va qarzni bekor qiladi,
 * hammasi bitta tranzaksiyada. Oddiy xodimga eski xato saqlanadi — u
 * yutilgan zakazni orqaga sura olmaydi.
 *
 * ═══ YO'QOTISH SABABI ═══
 * YOQOTILDI ga o'tishda `yoqotishSababi` yoziladi, boshqa holatga
 * qaytarilganda esa TOZALANADI: yashab qolgan sabab zakaz ustida yolg'on
 * bo'lib osilib qolardi.
 */
export async function holatniOzgartirish(params: {
  businessId: string;
  dealId: string;
  holat: Exclude<ZakazHolat, "YUTILDI">;
  userId: string;
  /** YOQOTILDI ga o'tishda — "nega qo'ldan ketdi". */
  yoqotishSababi?: string | null;
  /**
   * Amalni bajaruvchi OWNER/ADMIN mi. Faqat shu bayroq moliyaga o'tgan
   * YUTILDI ni qaytarishga yo'l ochadi (route `isManager` dan uzatadi).
   */
  boshqaruvchi?: boolean;
}) {
  const deal = await prisma.deal.findFirst({
    where: { id: params.dealId, businessId: params.businessId, deletedAt: null },
    select: { id: true, contactId: true, holat: true, transactionId: true, debtId: true },
  });
  if (!deal) throw new ForbiddenError("Zakaz topilmadi");

  const bosqichlar = await pipelineBosqichlari(params.businessId);

  // YUTILGAN VA MOLIYAGA O'TGAN ZAKAZ. Oddiy xodim uchun avvalgidek yopiq:
  // kirim/qarz yozilgan zakazni "jarayonda" ga surish moliyani CRM bilan
  // zid holatga tushirardi. Direktor esa moliyani ham qaytaradi.
  if (deal.holat === "YUTILDI" && (deal.transactionId || deal.debtId)) {
    if (!params.boshqaruvchi) {
      throw new BadRequestError(
        "Yutilgan va moliyaga o'tgan zakaz holatini faqat direktor qaytara oladi " +
          "(kirim o'chiriladi va qarz bekor qilinadi)"
      );
    }
    await zakazMoliyasiniQaytarish({
      businessId: params.businessId,
      dealId: deal.id,
      userId: params.userId,
      yangiHolat: params.holat,
      stageId: bosqichlar[params.holat],
      yoqotishSababi: params.yoqotishSababi,
    });
    return prisma.deal.findUniqueOrThrow({ where: { id: deal.id } });
  }

  const updated = await prisma.deal.update({
    where: { id: deal.id },
    data: {
      holat: params.holat,
      stageId: bosqichlar[params.holat],
      yopilganAt: yopiqHolat(params.holat) ? new Date() : null,
      // Doska ustunidagi tartib shu vaqtdan (eng yangi o'tish — eng tepada).
      holatAt: new Date(),
      yoqotishSababi:
        params.holat === "YOQOTILDI" ? params.yoqotishSababi?.trim() || null : null,
    },
  });

  const sabab =
    params.holat === "YOQOTILDI" && updated.yoqotishSababi
      ? ` — sabab: ${updated.yoqotishSababi}`
      : "";
  await prisma.activity.create({
    data: {
      businessId: params.businessId,
      dealId: deal.id,
      contactId: deal.contactId,
      turi: "tizim",
      matn: `Holat: ${params.holat}${sabab}`,
      userId: params.userId,
    },
  });

  return updated;
}

/**
 * ZAKAZNI O'CHIRISH — YUMSHOQ (soft-delete), faqat boshqaruvchi.
 *
 * Yozuv bazadan yo'qolmaydi: `deletedAt` + `deletedBy` qo'yiladi, shuning
 * uchun keyinchalik tiklash mumkin va audit izi uzilmaydi (loyihaning
 * `Transaction` uchun mavjud qoidasi bilan bir xil).
 *
 * MOLIYAGA O'TGAN zakaz o'chirilmaydi: kirim kassada, qarz esa
 * qarzdorlikda turibdi — zakaz jimgina yo'qolsa ular egasiz qolardi.
 * Direktor avval zakazni "Yutildi"dan qaytaradi (moliya ham qaytadi),
 * keyin o'chiradi. Shu tarzda ikkita mustaqil amal ketma-ket bajariladi
 * va har biri auditda alohida ko'rinadi.
 */
export async function zakazniOchirish(params: {
  businessId: string;
  dealId: string;
  userId: string;
}) {
  const deal = await prisma.deal.findFirst({
    where: { id: params.dealId, businessId: params.businessId, deletedAt: null },
    select: { id: true, nomi: true, summa: true, holat: true, transactionId: true, debtId: true },
  });
  if (!deal) throw new ForbiddenError("Zakaz topilmadi");
  if (deal.transactionId || deal.debtId) {
    throw new BadRequestError(
      "Moliyaga o'tgan zakaz o'chirilmaydi — avval uni 'Yutildi' holatidan qaytaring " +
        "(kirim o'chadi, qarz bekor bo'ladi), keyin o'chiring"
    );
  }

  // `deletedAt: null` sharti — ikki marta bosilganda ikkinchi so'rov
  // hech narsani o'zgartirmaydi (va audit ikki marta yozilmaydi).
  const upd = await prisma.deal.updateMany({
    where: { id: deal.id, businessId: params.businessId, deletedAt: null },
    data: { deletedAt: new Date(), deletedBy: params.userId },
  });
  if (upd.count !== 1) throw new BadRequestError("Zakaz allaqachon o'chirilgan");

  return deal;
}

/**
 * ZAKAZ TO'LOVLARINI ALMASHTIRISH (aralash to'lov).
 *
 * ATOMIK: qatorlar va `Deal.tolangan` BITTA tranzaksiyada yoziladi
 * (`runBusinessTx` — loyiha qoidasi). Aks holda qatorlar yangilanib
 * yig'indi eskiligicha qolsa, doska bir raqamni, qatorlar boshqasini
 * ko'rsatardi.
 *
 * MOLIYAGA O'TGAN zakaz QULFLANADI: kirim yoki qarz yozilgan bo'lsa pul
 * allaqachon kassada/qarzdorlikda — uni CRM formasidan o'zgartirish ikki
 * hisobni zid holatga tushirardi (summa/kategoriya bilan bir xil qoida).
 */
export async function zakazTolovlariniAlmashtirish(params: {
  businessId: string;
  dealId: string;
  /** Yangi qatorlar (bo'sh massiv — to'lov qatorlari olib tashlanadi). */
  tolovlar: TolovSatri[];
  /** Qatorsiz holatdagi tanlov: "qarz" — qolgani qarzdorlikka. */
  tolovTuri?: string | null;
  /** Yangi narx berilgan bo'lsa — tekshiruv AYNI shu narxga qarshi. */
  summa?: number;
}): Promise<{ tolangan: number; tolovTuri: string | null }> {
  const deal = await prisma.deal.findFirst({
    where: { id: params.dealId, businessId: params.businessId, deletedAt: null },
    select: { id: true, summa: true, transactionId: true, debtId: true },
  });
  if (!deal) throw new ForbiddenError("Zakaz topilmadi");
  if (deal.transactionId || deal.debtId) {
    throw new BadRequestError(
      "Moliyaga o'tgan zakazning to'lovi o'zgartirilmaydi — Kirim yoki Qarzdorlik bo'limidan tuzating"
    );
  }

  const summa = params.summa ?? deal.summa;
  tolovlarniTekshir(summa, params.tolovlar);
  const tolangan = tolovlarJami(params.tolovlar);
  const tolovTuri = tolovTuriBelgisi(params.tolovlar, params.tolovTuri);

  await runBusinessTx(params.businessId, async (tx) => {
    // Tranzaksiya ichida xom `tx` — HAR so'rovga `businessId` sharti QO'LDA.
    await tolovSatrlariniYoz(tx, params.businessId, params.dealId, params.tolovlar);
    await tx.deal.updateMany({
      where: { id: params.dealId, businessId: params.businessId, deletedAt: null },
      data: { tolangan, tolovTuri },
    });
  });

  return { tolangan, tolovTuri };
}

/**
 * ZAKAZNI BUGUNGA KO'CHIRISH (10-talab, "Bugungi zakazga o'tkazish").
 *
 * Holat o'zgarmaydi — SANA bugunga o'rnatiladi, ustun esa sanadan
 * hisoblanadi. Ya'ni "bugungi" bayrog'i degan ikkinchi haqiqat manbai
 * paydo bo'lmaydi.
 */
export async function bugungaKochirish(params: {
  businessId: string;
  dealId: string;
  userId: string;
  bugun?: string;
}) {
  const bugun = params.bugun ?? todayTashkentDateOnlyString();
  const deal = await prisma.deal.findFirst({
    where: { id: params.dealId, businessId: params.businessId, deletedAt: null },
    select: { id: true, contactId: true, holat: true },
  });
  if (!deal) throw new ForbiddenError("Zakaz topilmadi");
  if (deal.holat !== "KUTILMOQDA") {
    throw new BadRequestError("Faqat kutilayotgan zakaz bugungiga ko'chiriladi");
  }

  const updated = await prisma.deal.update({
    where: { id: deal.id },
    data: { sana: dateOnlyStringToUTCDate(bugun) },
  });
  await prisma.activity.create({
    data: {
      businessId: params.businessId,
      dealId: deal.id,
      contactId: deal.contactId,
      turi: "tizim",
      matn: `Zakaz sanasi bugunga ko'chirildi: ${bugun}`,
      userId: params.userId,
    },
  });
  return updated;
}

/** Zakazning joriy doska ustuni (server tomonda kerak bo'lganda). */
export function dealUstuni(
  deal: { holat: string; sana: Date | null },
  bugun = todayTashkentDateOnlyString()
): Ustun {
  return zakazUstuni(deal.holat, deal.sana ? utcDateToDateOnlyString(deal.sana) : null, bugun);
}

export interface YangiBuyurtma {
  businessId: string;
  /** Xizmat/buyurtma nomi (masalan "Onajon Dekor"). */
  nomi: string;
  summa?: number;
  /** KIRIM kategoriyasi — Kirim modulidagi kategoriya id'si. */
  categoryId?: string | null;
  contactId?: string | null;
  kontaktIsm?: string | null; // berilsa yangi kontakt yaratiladi
  kontaktTel?: string | null;
  /**
   * ZAKAZ SANASI "YYYY-MM-DD" — xizmat qaysi kunga belgilangan.
   * `createdAt` (CRM'ga qachon kiritildi) bilan ARALASHTIRILMAYDI: doskadagi
   * o'rin va UI'dagi asosiy sana aynan shu maydon.
   * Yangi zakazda majburiy (validatsiya qatlami majburlaydi); null — eski
   * yozuvlar bilan moslik uchun.
   */
  sana?: string | null;
  muddat?: string | null; // "YYYY-MM-DD"
  manba?: string | null;
  izoh?: string | null;
  /** Mas'ul xodim. Berilmasa — buyurtmani kiritgan foydalanuvchi. */
  masulId?: string | null;
  /** Boshlang'ich holat (bosqich). Berilmasa — birinchi OPEN bosqich. */
  stageId?: string | null;
  /** Zakazdagi xodimlar (kategoriya kesimida). Berilmasa — biriktiruvsiz. */
  xodimlar?: ZakazXodimInput[];
  /**
   * TO'LANGAN summa (so'm). To'lov holati shundan hisoblanadi:
   * `tolangan >= summa` — to'liq, `0 < tolangan < summa` — qisman, 0 — qarzga.
   */
  tolangan?: number;
  /** Pul kanali: "naqd" | "click" | "qarz" (bir kanalli eski yo'l). */
  tolovTuri?: string | null;
  /**
   * ARALASH TO'LOV qatorlari (naqd + click + terminal...). Berilsa —
   * to'lovning YAGONA manbai: `tolangan` yig'indidan, `tolovTuri` esa
   * kanallardan hisoblanadi (`lib/crm/tolovlar.ts`).
   */
  tolovlar?: TolovSatri[];
  /**
   * ZAKAZNI OLGAN SOTUVCHI (Employee.id) — FAQAT QO'LDA tanlanadi.
   * Berilmasa sotuvchi biriktirilmaydi (biznes sozlamasi majburiy qilsa
   * xato qaytadi). AVTO-TANLASH YO'Q: bitta kompyuterda bitta hisob ochiq
   * turgani "kirgan foydalanuvchi = sotuvchi" degani emas.
   */
  sotuvchiId?: string | null;
  /** Zakazni CRM'ga kiritgan foydalanuvchi (`createdBy`) — sotuvchidan alohida. */
  userId: string;
}

/** Kategoriya shu biznesning KIRIM kategoriyasi ekanini tekshiradi. */
async function kirimKategoriyasi(businessId: string, categoryId: string): Promise<string> {
  const cat = await prisma.category.findFirst({
    where: { id: categoryId, businessId },
    select: { id: true, turi: true },
  });
  if (!cat) throw new ForbiddenError("Kategoriya bu biznesga tegishli emas");
  if (cat.turi !== "kirim") throw new BadRequestError("Buyurtma kategoriyasi kirim turida bo'lishi kerak");
  return cat.id;
}

/**
 * MAS'UL XODIM — shu biznesda ishlaydigan faol foydalanuvchi bo'lishi shart.
 *
 * Tenant filtri o'zi yetarli emas: bir kompaniyada bir necha biznes bo'lsa,
 * A biznesining sotuvchisi buyurtmani B biznesining xodimiga yozib
 * qo'yardi. `biznesXodimlariWhere` uchala holatni qamraydi — biriktirilgan,
 * eski usulda biriktirilgan va umuman biriktirilmagan (direktor).
 */
export async function biznesXodimi(businessId: string, userId: string): Promise<string> {
  const masul = await prisma.user.findFirst({
    where: { id: userId, isActive: true, ...biznesXodimlariWhere(businessId) },
    select: { id: true },
  });
  if (!masul) throw new ForbiddenError("Mas'ul xodim bu biznesda ishlamaydi");
  return masul.id;
}

/** Kontakt: mavjudini qayta ishlatadi (telefon bo'yicha), bo'lmasa yaratadi. */
async function kontaktTop(params: YangiBuyurtma): Promise<string | null> {
  if (params.contactId) {
    const bor = await prisma.contact.findFirst({
      where: { id: params.contactId, businessId: params.businessId, deletedAt: null },
      select: { id: true },
    });
    if (!bor) throw new ForbiddenError("Mijoz bu biznesga tegishli emas");
    return bor.id;
  }
  if (!params.kontaktIsm?.trim()) return null;

  // Telefon bo'yicha mavjud kontaktni qayta ishlatamiz (dublikat oldini olish).
  const tel = params.kontaktTel?.trim() || null;
  const existing = tel
    ? await prisma.contact.findFirst({ where: { businessId: params.businessId, tel, deletedAt: null } })
    : null;
  if (existing) return existing.id;

  const contact = await prisma.contact.create({
    data: {
      businessId: params.businessId,
      ism: params.kontaktIsm.trim(),
      tel,
      createdBy: params.userId,
    },
  });
  return contact.id;
}

/**
 * ZAKAZ MIJOZINI ALMASHTIRISH (direktor tuzatishi).
 *
 * NEGA KERAK: zakaz shoshib kiritilganda mijoz ismi/telefoni xato tushadi
 * yoki umuman qoldirib ketiladi. Ilgari buni tuzatishning yo'li yo'q edi —
 * `kontaktIsm`/`kontaktTel` PATCH sxemasida bor edi, lekin route ularni
 * JIMGINA e'tiborsiz qoldirardi.
 *
 * QOIDA — `kontaktTop` bilan bir xil: telefon bo'yicha mavjud mijoz qayta
 * ishlatiladi (dublikat kartochka yaratilmaydi), topilmasa yangisi ochiladi.
 * Bo'sh ism — mijozni UZISH (zakaz mijozsiz qoladi); mijoz kartochkasining
 * o'zi O'CHIRILMAYDI, chunki unga boshqa zakazlar ham bog'langan bo'lishi
 * mumkin.
 */
export async function zakazMijoziniOzgartirish(params: {
  businessId: string;
  dealId: string;
  userId: string;
  kontaktIsm?: string | null;
  kontaktTel?: string | null;
}) {
  const deal = await prisma.deal.findFirst({
    where: { id: params.dealId, businessId: params.businessId, deletedAt: null },
    select: { id: true, contactId: true, contact: { select: { ism: true, tel: true } } },
  });
  if (!deal) throw new ForbiddenError("Zakaz topilmadi");

  // Berilmagan maydon o'zgarmaydi — mavjud qiymat asos qilib olinadi.
  const ism = (params.kontaktIsm !== undefined ? params.kontaktIsm : deal.contact?.ism)?.trim() || null;
  const tel = (params.kontaktTel !== undefined ? params.kontaktTel : deal.contact?.tel)?.trim() || null;

  if (!ism) {
    if (!deal.contactId) return deal;
    await prisma.deal.update({ where: { id: deal.id }, data: { contact: { disconnect: true } } });
    return deal;
  }

  const mavjud = tel
    ? await prisma.contact.findFirst({
        where: { businessId: params.businessId, tel, deletedAt: null },
        select: { id: true },
      })
    : null;

  let contactId: string;
  if (mavjud) {
    contactId = mavjud.id;
    // Topilgan kartochkaning ISMI yangilanadi: telefon bir xil bo'lsa bu
    // ayni odam, ismi esa tuzatilayotgan bo'lishi mumkin.
    await prisma.contact.update({ where: { id: mavjud.id }, data: { ism } });
  } else if (deal.contactId && !tel) {
    // Telefonsiz tuzatish — mavjud kartochkaning o'zini yangilash yetarli.
    contactId = deal.contactId;
    await prisma.contact.update({ where: { id: deal.contactId }, data: { ism, tel } });
  } else {
    const yangi = await prisma.contact.create({
      data: { businessId: params.businessId, ism, tel, createdBy: params.userId },
      select: { id: true },
    });
    contactId = yangi.id;
  }

  await prisma.deal.update({
    where: { id: deal.id },
    data: { contact: { connect: { id: contactId } } },
  });
  return deal;
}

/**
 * ZAKAZ SOTUVCHISINI ANIQLASH va uni biriktiruvlar ro'yxatiga qo'shish.
 *
 * TANLASH TARTIBI:
 *  1. `sotuvchiId` — birinchi darajali maydon (forma shuni yuboradi);
 *  2. `xodimlar` ro'yxatidagi SOTUVCHI turidagi kategoriya qatori — ESKI
 *     yo'l, buzilmasin (bot/eski integratsiyalar shu ko'rinishda yuboradi).
 * Hech biri bo'lmasa sotuvchi TANLANMAGAN bo'lib qoladi; biznes sozlamasi
 * majburiy qilsa — aniq xato.
 *
 * AVTO-TANLASH ATAYLAB YO'Q. Umumiy kompyuterdan ishlaydigan bo'limda
 * (Disney Navoiy sotuv bo'limi) tizimga kirgan hisob zakazni KIM SOTGANINI
 * bildirmaydi: bitta hisobdan hamma kiritadi. Kirgan foydalanuvchidan
 * sotuvchini taxmin qilish butun sotuv statistikasini bir odamga yig'ib
 * qo'yardi. Kirgan odam `Deal.createdBy` da alohida saqlanadi.
 *
 * HUQUQ TEKSHIRUVI HAM YO'Q (ayni sabab): CRM'ga kira olgan har bir xodim
 * biznesning HAR QAYSI faol sotuvchisini tanlay oladi — "boshqa sotuvchini
 * tanlash" imtiyoz emas, kundalik amal. Cheklov RO'YXATNING O'ZIDA qoladi:
 * server har chaqiruvda xodim shu biznesniki, faol va sotuvchi kategoriyasi
 * a'zosi ekanini tekshiradi (`sotuvchiTekshir`), ya'ni mijoz yuborgan
 * qiymatga baribir ISHONILMAYDI.
 */
async function sotuvchiniQosh(params: YangiBuyurtma): Promise<ZakazXodimInput[]> {
  const boshqalar = params.xodimlar ?? [];
  const sotuvKategoriyalar = new Set(await sotuvchiKategoriyaIdlari(params.businessId));
  // Sotuvchi endi ALOHIDA maydonda — ro'yxatdagi sotuvchi qatorlari shu
  // yerda ajratib olinadi va oxirida bittasi qaytariladi (ikkita sotuvchi
  // biriktirilib qolmasin).
  const ijrochilar = boshqalar.filter((x) => !sotuvKategoriyalar.has(x.categoryId));
  const royxatdagi = boshqalar.find((x) => sotuvKategoriyalar.has(x.categoryId));

  const soralgan = params.sotuvchiId ?? royxatdagi?.employeeId ?? null;

  let tanlangan: { id: string; categoryId: string } | null = null;
  if (soralgan) {
    const s = await sotuvchiTekshir(params.businessId, soralgan);
    tanlangan = { id: s.id, categoryId: s.categoryId };
  }

  if (!tanlangan && (await sotuvchiMajburiymi(params.businessId))) {
    throw new BadRequestError("Buyurtmani olgan sotuvchini tanlang");
  }

  return tanlangan
    ? [...ijrochilar, { categoryId: tanlangan.categoryId, employeeId: tanlangan.id }]
    : ijrochilar;
}

/**
 * Yangi buyurtma: kerak bo'lsa mijoz ham yaratiladi.
 * Holat berilmasa birinchi OPEN bosqichga tushadi.
 */
export async function createDeal(params: YangiBuyurtma) {
  const bosqichlar = await pipelineBosqichlari(params.businessId);

  // YANGI ZAKAZ HAR DOIM "KUTILAYOTGAN" da tug'iladi (1-talab). Sanasi bugun
  // bo'lsa u DARHOL "Bugungi zakazlar" ustunida ko'rinadi — chunki ustun
  // sanadan hisoblanadi, hech qanday qo'shimcha yozuvsiz.
  //
  // ESKI YO'L: `stageId` ataylab berilgan bo'lsa (masalan import yoki
  // tarixiy yozuv) holat O'SHA bosqichdan chiqadi — `holat` va bosqich
  // hech qachon bir-biriga zid bo'lib qolmasin.
  const berilganStage = params.stageId
    ? await prisma.stage.findFirst({ where: { id: params.stageId, businessId: params.businessId } })
    : null;
  if (params.stageId && !berilganStage) throw new BadRequestError("Bosqich topilmadi");
  const stageId = berilganStage?.id ?? bosqichlar.KUTILMOQDA;
  const holat: ZakazHolat = berilganStage ? bosqichdanHolat(berilganStage) : "KUTILMOQDA";

  const summa = params.summa ?? 0;
  // ARALASH TO'LOV: qatorlar berilgan bo'lsa to'lov YAGONA shulardan
  // hisoblanadi — forma yuborgan `tolangan` ga ishonilmaydi (ikki xil
  // raqam paydo bo'lmasin).
  const tolovSatrlari = params.tolovlar ?? null;
  if (tolovSatrlari) tolovlarniTekshir(summa, tolovSatrlari);
  const tolangan = tolovSatrlari
    ? tolovlarJami(tolovSatrlari)
    : Math.max(0, Math.min(params.tolangan ?? 0, summa));
  if (!tolovSatrlari && (params.tolangan ?? 0) > summa) {
    throw new BadRequestError("To'langan summa zakaz narxidan ko'p bo'lmasligi kerak");
  }
  const tolovTuri = tolovSatrlari
    ? tolovTuriBelgisi(tolovSatrlari, params.tolovTuri)
    : params.tolovTuri ?? null;

  const categoryId = params.categoryId ? await kirimKategoriyasi(params.businessId, params.categoryId) : null;

  // SOTUVCHI — mijoz yaratilishidan OLDIN hal qilinadi: xato bo'lsa yon
  // ta'sir (yangi kontakt) qolib ketmasin.
  const xodimlar = await sotuvchiniQosh(params);

  const contactId = await kontaktTop(params);

  // Mas'ul xodim shu BIZNESning faol foydalanuvchisi bo'lishi shart.
  let masulId = params.userId;
  if (params.masulId && params.masulId !== params.userId) {
    masulId = await biznesXodimi(params.businessId, params.masulId);
  }
  // SOTUVCHI biriktiruvi mas'ulni YETAKLAYDI: "sotuvchi" turidagi kategoriyaga
  // tayinlangan, tizim hisobi bog'langan xodim — zakaz o'shaniki. Shunda
  // CRM→Kirim `sotuvchiId` (mavjud xodim statistikasi) ham ayni sotuvchiga
  // yoziladi — ikki hisob bitta haqiqat manbaida qoladi.
  if (xodimlar.length) {
    // Tekshiruv YARATISHDAN OLDIN — xato ro'yxat bilan buyurtma umuman ochilmasin.
    await zakazXodimlariniTekshir(params.businessId, xodimlar);
    const sotuvchiUserId = await sotuvchiUserIdTop(params.businessId, xodimlar);
    if (sotuvchiUserId) {
      const sotuvchi = await prisma.user.findFirst({
        where: { id: sotuvchiUserId, isActive: true, ...biznesXodimlariWhere(params.businessId) },
        select: { id: true },
      });
      if (sotuvchi) masulId = sotuvchi.id;
    }
  }

  const deal = await prisma.deal.create({
    data: {
      businessId: params.businessId,
      nomi: params.nomi.trim(),
      summa,
      tolangan,
      tolovTuri,
      holat,
      yopilganAt: yopiqHolat(holat) ? new Date() : null,
      // Yaratilish — zakazning BIRINCHI holati, shu bois tartib vaqti ham shu.
      holatAt: new Date(),
      categoryId,
      stageId,
      contactId,
      masulId,
      // KIRITGAN ODAM — sotuvchidan ALOHIDA maydon. `masulId` bunga javob
      // bermaydi: u sotuvchining tizim hisobiga sinxronlanadi (pastda).
      createdBy: params.userId,
      manba: params.manba ?? "qolda",
      sana: params.sana ? dateOnlyStringToUTCDate(params.sana) : null,
      muddat: params.muddat ? dateOnlyStringToUTCDate(params.muddat) : null,
      izoh: params.izoh?.trim() || null,
    },
    include: {
      contact: { select: { id: true, ism: true, tel: true } },
      category: { select: { id: true, nomi: true } },
    },
  });

  // Zakaz xodimlari — kategoriya/a'zolik tekshiruvi bilan (xizmat qatlami).
  if (xodimlar.length) {
    await zakazXodimlariniSaqlash(params.businessId, deal.id, xodimlar);
  }

  // ARALASH TO'LOV qatorlari. `Deal.tolangan` allaqachon shu yig'indidan
  // yozilgan — qatorlar va yig'indi bir manbadan chiqadi.
  if (tolovSatrlari?.length) {
    await tolovSatrlariniYoz(prisma, params.businessId, deal.id, tolovSatrlari);
  }

  await prisma.activity.create({
    data: {
      businessId: params.businessId,
      dealId: deal.id,
      contactId,
      turi: "tizim",
      matn: "Buyurtma yaratildi",
      userId: params.userId,
    },
  });

  // To'g'ridan-to'g'ri YUTILDI bosqichida yaratilgan (eski yo'l: import,
  // tarixiy yozuv) zakazning moliyasi ham DARHOL yoziladi — "yutilgan, lekin
  // kirimi yo'q" holat paydo bo'lmasin. To'lov tanlanmagan bo'lsa hech
  // narsa yozilmaydi (yakunlash.ts qoidasi).
  if (holat === "YUTILDI") {
    await zakazniYakunlash({ businessId: params.businessId, dealId: deal.id, userId: params.userId });
    const yangilangan = await prisma.deal.findFirst({
      where: { id: deal.id, businessId: params.businessId },
      include: {
        contact: { select: { id: true, ism: true, tel: true } },
        category: { select: { id: true, nomi: true } },
      },
    });
    return yangilangan ?? deal;
  }

  return deal;
}

/**
 * Buyurtmani boshqa holatga (bosqichga) ko'chirish — ESKI YO'L (bosqichga
 * sudrash / `stageId` bilan PATCH).
 *
 * WON bosqich = YUTILDI: moliya (to'langan qism kirim, qolgani qarz) SHU
 * YERDA emas, `zakazniYakunlash` orqali — atomik va idempotent, dublikatga
 * qarshi himoya YAGONA joyda tursin. Shunda "yutilgan, lekin kirimi yo'q"
 * zakaz bu yo'ldan ham paydo bo'lmaydi.
 *
 * `kirimYoz` (eski xulq): to'lovi TANLANMAGAN zakazda butun summa kirimga
 * (`kirimgaKochirish`). To'lovi belgilangan zakazda u ahamiyatsiz — moliya
 * allaqachon tanlovga ko'ra yozilgan.
 */
export async function moveDeal(params: {
  businessId: string;
  dealId: string;
  stageId: string;
  kirimYoz?: boolean;
  userId: string;
}) {
  const deal = await prisma.deal.findFirst({
    where: { id: params.dealId, businessId: params.businessId, deletedAt: null },
    select: { id: true, contactId: true, transactionId: true, summa: true },
  });
  if (!deal) throw new ForbiddenError("Buyurtma topilmadi");

  const stage = await prisma.stage.findFirst({ where: { id: params.stageId, businessId: params.businessId } });
  if (!stage) throw new ForbiddenError("Bosqich topilmadi");

  // BOSQICH → HOLAT SINXRONI. `Deal.holat` haqiqat manbai, bosqich uning
  // ko'zgusi; eski yo'l (bosqichga sudrash) hali ishlaydi, shuning uchun
  // bu yerda teskari yo'nalish ham yuritiladi.
  const holat = bosqichdanHolat(stage);
  const yopilyapti = yopiqHolat(holat);

  if (holat === "YUTILDI") {
    // YUTILDI → holat, kirim va qarz BITTA tranzaksiyada (yakunlash.ts).
    // Takror chaqiruv yangi yozuv yaratmaydi.
    await zakazniYakunlash({ businessId: params.businessId, dealId: deal.id, userId: params.userId });
    const hozir = await prisma.deal.findFirst({
      where: { id: deal.id, businessId: params.businessId },
      select: { transactionId: true, debtId: true, summa: true },
    });
    if (params.kirimYoz && hozir && !hozir.transactionId && !hozir.debtId && hozir.summa > 0) {
      await kirimgaKochirish({ businessId: params.businessId, dealId: deal.id, userId: params.userId });
    }
    return prisma.deal.findFirst({ where: { id: deal.id, businessId: params.businessId } });
  }

  const updated = await prisma.deal.update({
    where: { id: deal.id },
    data: { stageId: stage.id, holat, yopilganAt: yopilyapti ? new Date() : null, holatAt: new Date() },
  });

  await prisma.activity.create({
    data: {
      businessId: params.businessId,
      dealId: deal.id,
      contactId: deal.contactId,
      turi: "tizim",
      matn: `"${stage.nomi}" holatiga o'tkazildi`,
      userId: params.userId,
    },
  });

  return updated;
}
