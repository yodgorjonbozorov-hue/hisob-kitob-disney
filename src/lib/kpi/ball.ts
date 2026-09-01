import { prisma } from "@/lib/prisma";
import { runBusinessTx, type BusinessTx } from "@/lib/db/businessTx";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { dateOnlyStringToUTCDate, utcDateToDateOnlyString } from "@/lib/date";
import { ballChegarasi } from "./hisob";

/**
 * BALL TIZIMI — ayirish va qaytarish.
 *
 * QOIDA: ball bajarilgan ish uchun QO'SHILMAYDI, bajarilmagan ish uchun
 * AYIRILADI. Har vazifa har oy boshlang'ich balldan (odatda 100) boshlanadi
 * va keyingi oyga KO'CHMAYDI — `oy` ustuni shu kesimni beradi.
 *
 * BALL ALOHIDA USTUNDA SAQLANMAYDI. Joriy ball = boshlang'ich + shu oydagi
 * `KpiPointLog` yozuvlari yig'indisi. Shu sababli jurnal bilan ball hech
 * qachon ajralib qolmaydi va yozuvni "jimgina tahrirlash" imkonsiz:
 * tuzatishning yagona yo'li — QAYTARISH yozuvi (`ballQaytar`), asl yozuv
 * esa tarixda ko'rinib turadi.
 *
 * KUNLIK LIMIT SERVERDA. Oddiy jarimalarda bir vazifa uchun bir kunda
 * ko'pi bilan `kunlikLimit` (odatda 5) ball tushadi. Frontend cheklovi
 * xavfsizlik emas — shuning uchun tekshiruv tranzaksiya ICHIDA, ayni
 * yozuvdan oldin bajariladi (parallel ikki so'rov limitdan oshib ketmasin).
 * KRITIK (ishonch) holatlari — yolg'on ma'lumot, qo'ng'iroq qilmasdan
 * "qildim" deyish, pul hisobi to'g'ri kelmasligi — limitga KIRMAYDI.
 */

export interface BallAyirishParams {
  businessId: string;
  employeeId: string;
  taskId: string;
  userId: string;
  userIsm: string | null;
  /** "YYYY-MM-DD". */
  sana: string;
  /** Ayiriladigan ball — MUSBAT son. */
  ball: number;
  sabab: string;
  izoh?: string | null;
  kritik?: boolean;
  presetId?: string | null;
}

export interface BallNatijasi {
  id: string;
  ballOldin: number;
  ballKeyin: number;
  oy: string;
}

/** "YYYY-MM-DD" → "YYYY-MM". */
function oyKaliti(sana: string): string {
  return sana.slice(0, 7);
}

/**
 * Tranzaksiya ichidagi joriy ball. HAR so'rovga `businessId` sharti QO'LDA
 * yozilgan — xom `tx` delegatida tenant filtri avtomatik EMAS.
 */
async function joriyBallTx(
  tx: BusinessTx,
  businessId: string,
  employeeId: string,
  taskId: string,
  oy: string,
  boshlangich: number
): Promise<number> {
  const agg = await tx.kpiPointLog.aggregate({
    where: { businessId, employeeId, taskId, oy },
    _sum: { ball: true },
  });
  return ballChegarasi(boshlangich + (agg._sum.ball ?? 0), boshlangich);
}

/** Oy yopilgan bo'lsa ball yozib bo'lmaydi — snapshot o'zgarib ketmasin. */
async function oyOchiqTx(
  tx: BusinessTx,
  businessId: string,
  employeeId: string,
  oy: string
): Promise<void> {
  const yopiq = await tx.kpiPayroll.findFirst({
    where: { businessId, employeeId, oy },
    select: { id: true },
  });
  if (yopiq) {
    throw new BadRequestError(
      "Bu oy yopilgan — ball o'zgartirib bo'lmaydi. Tuzatish uchun oylikka tuzatish qatorini qo'shing."
    );
  }
}

/**
 * BALL AYIRISH. Vazifa xodimga biriktirilgan bo'lishi, oy ochiq bo'lishi
 * va (oddiy jarimada) kunlik limitga sig'ishi shart.
 */
export async function ballAyir(params: BallAyirishParams): Promise<BallNatijasi> {
  if (!Number.isInteger(params.ball) || params.ball <= 0) {
    throw new BadRequestError("Ayiriladigan ball musbat butun son bo'lishi kerak");
  }
  const sabab = params.sabab.trim();
  if (!sabab) throw new BadRequestError("Sabab yozilishi shart");

  const oy = oyKaliti(params.sana);
  const sanaDate = dateOnlyStringToUTCDate(params.sana);

  return runBusinessTx(params.businessId, async (tx) => {
    const sozlama = await tx.kpiSetting.findFirst({ where: { businessId: params.businessId } });
    const boshlangich = sozlama?.boshlangichBall ?? 100;
    const kunlikLimit = sozlama?.kunlikLimit ?? 5;

    // Biriktiruv tekshiruvi — begona xodim/vazifa juftligiga yozib bo'lmaydi.
    const biriktiruv = await tx.kpiTaskAssignment.findFirst({
      where: {
        businessId: params.businessId,
        employeeId: params.employeeId,
        taskId: params.taskId,
        aktiv: true,
      },
      select: { id: true },
    });
    if (!biriktiruv) {
      throw new BadRequestError("Bu vazifa xodimga biriktirilmagan");
    }

    await oyOchiqTx(tx, params.businessId, params.employeeId, oy);

    const kritik = params.kritik ?? false;
    if (!kritik) {
      // KUNLIK LIMIT: shu kun, shu vazifa bo'yicha ODDIY jarimalar yig'indisi.
      // Kritik yozuvlar hisobga OLINMAYDI (ular limitdan tashqarida).
      const kunYozuvlari = await tx.kpiPointLog.findMany({
        where: {
          businessId: params.businessId,
          employeeId: params.employeeId,
          taskId: params.taskId,
          sana: sanaDate,
          turi: "jarima",
          kritik: false,
        },
        select: { id: true, ball: true },
      });

      // QAYTARILGANLAR LIMITNI BAND QILMAYDI. Aks holda xato kiritilgan
      // jarimani qaytarib, to'g'risini o'sha kuni qayta yozib bo'lmasdi:
      // limit allaqachon "to'lgan" bo'lardi va tuzatish ertaga qolardi.
      const qaytarilgan = await tx.kpiPointLog.findMany({
        where: {
          businessId: params.businessId,
          bekorQilinganId: { in: kunYozuvlari.map((y) => y.id) },
        },
        select: { bekorQilinganId: true },
      });
      const bekorIdlar = new Set(qaytarilgan.map((q) => q.bekorQilinganId));

      const bugungi = kunYozuvlari
        .filter((y) => !bekorIdlar.has(y.id))
        .reduce((s, y) => s + Math.abs(y.ball), 0);

      if (bugungi + params.ball > kunlikLimit) {
        const qolgan = Math.max(0, kunlikLimit - bugungi);
        throw new BadRequestError(
          `Kunlik limit: bir vazifa uchun kuniga ${kunlikLimit} balldan ko'p ayirib bo'lmaydi. ` +
            `Bugun allaqachon ${bugungi} ball ayrilgan, qolgani ${qolgan} ball.`
        );
      }
    }

    const ballOldin = await joriyBallTx(
      tx,
      params.businessId,
      params.employeeId,
      params.taskId,
      oy,
      boshlangich
    );
    const ballKeyin = ballChegarasi(ballOldin - params.ball, boshlangich);

    const yozuv = await tx.kpiPointLog.create({
      data: {
        businessId: params.businessId,
        employeeId: params.employeeId,
        taskId: params.taskId,
        oy,
        sana: sanaDate,
        ball: -params.ball,
        ballOldin,
        ballKeyin,
        sabab,
        izoh: params.izoh?.trim() || null,
        turi: "jarima",
        kritik,
        presetId: params.presetId ?? null,
        userId: params.userId,
        userIsm: params.userIsm,
      },
    });

    return { id: yozuv.id, ballOldin, ballKeyin, oy };
  });
}

/**
 * BALLNI QAYTARISH — xato kiritilgan yozuvni bekor qiladi.
 *
 * Asl yozuv TEGILMAYDI: uning ustiga teskari ishorali yangi yozuv
 * qo'yiladi va `bekorQilinganId` bilan bog'lanadi. `@unique` cheklovi
 * bitta yozuvni ikki marta qaytarishga baza darajasida yo'l bermaydi
 * (parallel ikki so'rovda ikkinchisi cheklovga uriladi).
 */
export async function ballQaytar(params: {
  businessId: string;
  logId: string;
  userId: string;
  userIsm: string | null;
  izoh?: string | null;
}): Promise<BallNatijasi> {
  return runBusinessTx(params.businessId, async (tx) => {
    const asl = await tx.kpiPointLog.findFirst({
      where: { id: params.logId, businessId: params.businessId },
    });
    if (!asl) throw new ForbiddenError("Ball yozuvi topilmadi");
    if (asl.turi === "qaytarish") {
      throw new BadRequestError("Qaytarish yozuvini qaytarib bo'lmaydi");
    }

    const bor = await tx.kpiPointLog.findFirst({
      where: { businessId: params.businessId, bekorQilinganId: asl.id },
      select: { id: true },
    });
    if (bor) throw new BadRequestError("Bu yozuv allaqachon qaytarilgan");

    await oyOchiqTx(tx, params.businessId, asl.employeeId, asl.oy);

    const sozlama = await tx.kpiSetting.findFirst({ where: { businessId: params.businessId } });
    const boshlangich = sozlama?.boshlangichBall ?? 100;

    const ballOldin = await joriyBallTx(
      tx,
      params.businessId,
      asl.employeeId,
      asl.taskId,
      asl.oy,
      boshlangich
    );
    const qaytariladi = -asl.ball; // asl manfiy edi → musbat qaytadi
    const ballKeyin = ballChegarasi(ballOldin + qaytariladi, boshlangich);

    const yozuv = await tx.kpiPointLog.create({
      data: {
        businessId: params.businessId,
        employeeId: asl.employeeId,
        taskId: asl.taskId,
        oy: asl.oy,
        // Qaytarish BUGUNGI sana bilan yoziladi (asl sana bilan emas):
        // tarixda "qachon tuzatildi" ko'rinib tursin.
        sana: dateOnlyStringToUTCDate(utcDateToDateOnlyString(new Date())),
        ball: qaytariladi,
        ballOldin,
        ballKeyin,
        sabab: `Qaytarildi: ${asl.sabab}`,
        izoh: params.izoh?.trim() || null,
        turi: "qaytarish",
        kritik: false,
        bekorQilinganId: asl.id,
        userId: params.userId,
        userIsm: params.userIsm,
      },
    });

    return { id: yozuv.id, ballOldin, ballKeyin, oy: asl.oy };
  });
}

export interface BallTarixDTO {
  id: string;
  taskId: string;
  taskNomi: string;
  sana: string;
  ball: number;
  ballOldin: number;
  ballKeyin: number;
  sabab: string;
  izoh: string | null;
  turi: string;
  kritik: boolean;
  userIsm: string | null;
  /** Bu yozuv qaytarilganmi (UI tugmani yashiradi va "qaytarilgan" deb belgilaydi). */
  qaytarilgan: boolean;
}

/** Xodimning oy ichidagi ball tarixi (eng yangisi birinchi). */
export async function ballTarixi(
  businessId: string,
  employeeId: string,
  oy: string
): Promise<BallTarixDTO[]> {
  const rows = await prisma.kpiPointLog.findMany({
    where: { businessId, employeeId, oy },
    include: { task: { select: { nomi: true } } },
    orderBy: [{ sana: "desc" }, { createdAt: "desc" }],
  });

  const qaytarilgan = new Set(
    rows.map((r) => r.bekorQilinganId).filter((id): id is string => Boolean(id))
  );

  return rows.map((r) => ({
    id: r.id,
    taskId: r.taskId,
    taskNomi: r.task.nomi,
    sana: utcDateToDateOnlyString(r.sana),
    ball: r.ball,
    ballOldin: r.ballOldin,
    ballKeyin: r.ballKeyin,
    sabab: r.sabab,
    izoh: r.izoh,
    turi: r.turi,
    kritik: r.kritik,
    userIsm: r.userIsm,
    qaytarilgan: qaytarilgan.has(r.id),
  }));
}
