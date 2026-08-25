import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx, type BusinessTx } from "@/lib/db/businessTx";
import { dateOnlyStringToUTCDate, TOSHKENT_OFFSET_MS } from "@/lib/date";
import { logAudit } from "@/lib/services/audit";
import { getKunlikRuxsat, kunlikBugun, type KunlikAktor } from "@/lib/services/kunlik";
import type { SmenaYopishInput } from "@/lib/validation/smena";

/**
 * SMENA YAKUNI XIZMATI — kun ichida kassani bir necha marta sanab topshirish.
 *
 * Invariantlar:
 *  - kirim/chiqimga TEGMAYDI: bu yerda Transaction ham, DailyTransaction ham
 *    yozilmaydi va o'zgartirilmaydi. Smena — kun ichidagi KESIM, hosila
 *    ko'rinish; kunlik va oylik raqamlar avvalgidek qoladi;
 *  - bazada faqat YOPILGAN smena qatori bo'ladi. Joriy (ochiq) smena hosila:
 *    oxirgi yopilgan smenaning `tugashAt` idan hozirgacha bo'lgan oyna;
 *  - oyna `createdAt` bo'yicha kesiladi (`boshlanishAt` < createdAt <=
 *    `tugashAt`), chunki kassadagi pul yozuvning `sana` siga emas, KIRITILGAN
 *    paytiga qarab to'planadi;
 *  - yopish paytida summalar MUZLATILADI — keyin tushum tahrirlansa ham
 *    yopilgan smenaning raqamlari o'zgarmaydi (nazorat ma'nosi shunda);
 *  - keyingi smena `qoldirilganNaqd` dan boshlanadi (odatda 0 — pul topshirildi).
 */

/** Toshkent kalendar kunining boshlanish payti (UTC instant). */
export function toshkentKunBoshi(sanaStr: string): Date {
  return new Date(dateOnlyStringToUTCDate(sanaStr).getTime() - TOSHKENT_OFFSET_MS);
}

/** Bitta smena oynasidagi tushum va naqd chiqim jamlari. */
export interface SmenaOynaSummasi {
  naqd: number;
  click: number;
  qarz: number;
  naqdChiqim: number;
}

/**
 * Chiqim naqdmi? Yozuvda to'lov turi aniq ko'rsatilgan bo'lsa — o'sha;
 * ko'rsatilmagan eski yozuvlarda kassa turidan chiqariladi (kunlik sinxron
 * bilan bir xil qoida). Click/qarz chiqimi kassadagi naqdga tegmaydi.
 */
export function naqdChiqimmi(tolovTuri: string | null, kassaTuri: string | null): boolean {
  if (tolovTuri) return tolovTuri === "naqd";
  return (kassaTuri ?? "naqd") === "naqd";
}

/** Oyna hisobiga tushadigan bitta yozuv (kirim yoki chiqim). */
export interface OynaYozuvi {
  summa: number;
  tolovTuri: string | null;
  account: { turi: string } | null;
}

/**
 * Xom so'rov natijalaridan oyna summalarini yig'adi.
 *
 * ═══ NEGA MANBA `Transaction` (audit tuzatishi) ═══
 * Ilgari KIRIM `DailyTransaction` dan, CHIQIM esa `Transaction` dan
 * olinardi. Ikki manba nosimmetrik edi:
 *   - `DailyTransaction` faqat BUGUNGI sanali va kun OCHIQ bo'lgandagina
 *     yaratilardi (`kunlikSinxron`), chiqim esa `createdAt` bo'yicha
 *     hech qanday sana shartisiz sanalardi;
 *   - demak kechagi sana bilan kiritilgan kirim oynaga TUSHMASDI, xuddi
 *     shu paytda kiritilgan chiqim esa TUSHARDI.
 * Natijada "Kassada bo'lishi kerak" katta MANFIY songa aylanib qolardi
 * (masalan −12 679 000) — hisob xatosi, real pul emas.
 *
 * Endi ikkala tomon ham BITTA manbadan (`Transaction`) va BITTA qoidadan
 * (`naqdChiqimmi`) o'tadi: oyna ichida kiritilgan naqd kirim minus oyna
 * ichida kiritilgan naqd chiqim. Simmetriya tiklanadi.
 *
 * Ataylab SO'ROVSIZ (sof funksiya): bir xil hisob ikki joyda kerak —
 * tranzaksiya ichida (yopish paytida, xom `tx` bilan) va sahifada jonli
 * ko'rsatish uchun (tenant-scoped `prisma` bilan). Formula esa bitta.
 */
export function oynaJamla(
  kirimlar: OynaYozuvi[],
  chiqimlar: OynaYozuvi[]
): SmenaOynaSummasi {
  let naqd = 0;
  let click = 0;
  let qarz = 0;
  for (const k of kirimlar) {
    if (k.tolovTuri === "qarz") qarz += k.summa;
    else if (naqdChiqimmi(k.tolovTuri, k.account?.turi ?? null)) naqd += k.summa;
    else click += k.summa;
  }
  return {
    naqd,
    click,
    qarz,
    naqdChiqim: chiqimlar
      .filter((c) => naqdChiqimmi(c.tolovTuri, c.account?.turi ?? null))
      .reduce((a, c) => a + c.summa, 0),
  };
}

/** Oyna yozuvlarini o'qish uchun yagona `select` — ikki joyda bir xil. */
export const OYNA_SELECT = {
  summa: true,
  tolovTuri: true,
  account: { select: { turi: true } },
} as const;

/** Kutilgan naqd — kassada SHU PAYT bo'lishi kerak bo'lgan pul. */
export function kutilganNaqdHisobi(boshlangichQoldiq: number, oyna: SmenaOynaSummasi): number {
  return boshlangichQoldiq + oyna.naqd - oyna.naqdChiqim;
}

/** Joriy (hali yopilmagan) smenaning chegaralari. */
export interface JoriySmenaChegarasi {
  raqam: number;
  boshlanishAt: Date;
  boshlangichQoldiq: number;
}

/**
 * Oxirgi yopilgan smena va bugungi smenalar sonidan joriy oyna chegarasini
 * chiqaradi.
 *
 * Oyna boshi — oxirgi yopilgan smenaning tugash payti. Hech qachon
 * yopilmagan bo'lsa — bugungi Toshkent kun boshi. Kechagi tugash payti
 * ATAYLAB kun boshi bilan almashtirilmaydi: kecha smena yopilgandan keyin
 * kiritilgan kech tushum ham kassada yotibdi, demak u joriy smenaga kirishi
 * kerak — aks holda o'sha pul hech qaysi smenaga tushmay yo'qoladi.
 */
export function joriyChegara(
  oxirgi: { tugashAt: Date; qoldirilganNaqd: number } | null,
  bugungiSoni: number,
  bugunStr: string
): JoriySmenaChegarasi {
  return {
    raqam: bugungiSoni + 1,
    boshlanishAt: oxirgi?.tugashAt ?? toshkentKunBoshi(bugunStr),
    boshlangichQoldiq: oxirgi?.qoldirilganNaqd ?? 0,
  };
}

/**
 * SMENANI YOPISH — xodim kassadagi naqdni sanab kiritadi.
 *
 * Har qanday faol xodim o'z smenasini yopa oladi (kassa topshirish bilan bir
 * xil qoida): nazorat "kim topshirdi" ismida va farq raqamida.
 *
 * ATOMIK: oyna summalari ham, qator yozuvi ham bitta tranzaksiyada — o'rtada
 * yangi tushum kirsa ham muzlatilgan raqam va oyna chegarasi mos qoladi.
 * Tranzaksiya ichida xom `tx` ishlatiladi, shuning uchun HAR so'rovda
 * `businessId` va soft-delete sharti qo'lda yozilgan (CLAUDE.md kelishuvi).
 */
export async function smenaYop(businessId: string, aktor: KunlikAktor, data: SmenaYopishInput) {
  const bugunStr = kunlikBugun();
  const qoldirilgan = data.qoldirilganNaqd ?? 0;

  const smena = await runBusinessTx(businessId, async (tx: BusinessTx) => {
    const [oxirgi, bugungiSoni] = await Promise.all([
      tx.smena.findFirst({
        where: { businessId },
        orderBy: { tugashAt: "desc" },
        select: { tugashAt: true, qoldirilganNaqd: true },
      }),
      tx.smena.count({ where: { businessId, sana: dateOnlyStringToUTCDate(bugunStr) } }),
    ]);
    const chegara = joriyChegara(oxirgi, bugungiSoni, bugunStr);
    const tugashAt = new Date();
    const oynaFiltri = { gt: chegara.boshlanishAt, lte: tugashAt };

    const [kirimlar, chiqimlar] = await Promise.all([
      tx.transaction.findMany({
        where: { businessId, turi: "kirim", deletedAt: null, createdAt: oynaFiltri },
        select: OYNA_SELECT,
      }),
      tx.transaction.findMany({
        where: { businessId, turi: "chiqim", deletedAt: null, createdAt: oynaFiltri },
        select: OYNA_SELECT,
      }),
    ]);

    const oyna = oynaJamla(kirimlar, chiqimlar);
    const kutilganNaqd = kutilganNaqdHisobi(chegara.boshlangichQoldiq, oyna);

    return tx.smena.create({
      data: {
        businessId,
        sana: dateOnlyStringToUTCDate(bugunStr),
        raqam: chegara.raqam,
        boshlanishAt: chegara.boshlanishAt,
        tugashAt,
        yopganUserId: aktor.userId,
        yopganIsm: aktor.ism,
        naqd: oyna.naqd,
        click: oyna.click,
        qarz: oyna.qarz,
        naqdChiqim: oyna.naqdChiqim,
        boshlangichQoldiq: chegara.boshlangichQoldiq,
        kutilganNaqd,
        sanalganNaqd: data.sanalganNaqd,
        farq: data.sanalganNaqd - kutilganNaqd,
        qoldirilganNaqd: qoldirilgan,
        izoh: data.izoh?.trim() || undefined,
      },
    });
  });

  await logAudit({
    businessId,
    action: "create",
    entity: "smena",
    entityId: smena.id,
    after: {
      raqam: smena.raqam,
      yopganIsm: smena.yopganIsm,
      kutilganNaqd: smena.kutilganNaqd,
      sanalganNaqd: smena.sanalganNaqd,
      farq: smena.farq,
      qoldirilganNaqd: smena.qoldirilganNaqd,
    },
  });
  return smena;
}

/**
 * SMENANI QAYTA OCHISH — xato yopilgan smenani bekor qiladi.
 *
 * Faqat OXIRGI yopilgan smena o'chiriladi: o'rtadagisi olib tashlansa
 * qo'shni oynalar ustma-ust tushib, bir pul ikki smenaga hisoblanardi.
 * Qator o'chiriladi (u — hosila surat), lekin audit jurnalida barcha
 * raqamlari bilan qolib ketadi.
 */
export async function smenaQaytaOch(businessId: string, aktor: KunlikAktor, smenaId: string) {
  const ruxsat = await getKunlikRuxsat(businessId, aktor);
  if (!ruxsat.tahrirlaydi) {
    throw new ForbiddenError("Smenani faqat direktor yoki boshqaruvchi qayta ochadi");
  }

  const eski = await runBusinessTx(businessId, async (tx: BusinessTx) => {
    const mavjud = await tx.smena.findFirst({ where: { id: smenaId, businessId } });
    if (!mavjud) throw new BadRequestError("Smena topilmadi");

    const keyingi = await tx.smena.count({
      where: { businessId, tugashAt: { gt: mavjud.tugashAt } },
    });
    if (keyingi > 0) {
      throw new BadRequestError(
        "Faqat oxirgi smenani qayta ochish mumkin — avval undan keyingilarini qayta oching"
      );
    }

    await tx.smena.deleteMany({ where: { id: mavjud.id, businessId } });
    return mavjud;
  });

  await logAudit({
    businessId,
    action: "delete",
    entity: "smena",
    entityId: eski.id,
    before: {
      raqam: eski.raqam,
      yopganIsm: eski.yopganIsm,
      kutilganNaqd: eski.kutilganNaqd,
      sanalganNaqd: eski.sanalganNaqd,
      farq: eski.farq,
    },
  });
  return { ok: true };
}
