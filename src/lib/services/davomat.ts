import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx, type BusinessTx } from "@/lib/db/businessTx";
import { logAudit } from "@/lib/services/audit";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import { masofaM } from "@/lib/davomat/geo";
import {
  kechikishHisobla,
  ketishHisobla,
  sanaHaftaKuni,
  toshkentSana,
  toshkentVaqtniUTCga,
} from "@/lib/davomat/vaqt";
import { avtoJarimaTx, kelmadiJarimaTx } from "@/lib/services/jarima";
import {
  GPS_MAX_ANIQLIK_M,
  SELFIE_MAX_BAYT,
  type CheckInput,
  type TuzatishInput,
} from "@/lib/validation/davomat";

// ---------------------------------------------------------------------------
// Xodim / jadval / ish joyi rezolyutsiyasi
// ---------------------------------------------------------------------------

/** Sessiya foydalanuvchisiga bog'langan xodim kartochkasi (o'zim rejimi). */
export async function xodimniUserdanTop(businessId: string, userId: string) {
  return prisma.employee.findFirst({
    where: { businessId, userId, deletedAt: null, isActive: true },
    include: {
      workSchedule: { include: { kunlar: true } },
      workLocation: true,
    },
  });
}

export interface EffektivJadval {
  scheduleId: string;
  nomi: string;
  imtiyozDaqiqa: number;
  ishKuni: boolean;
  boshlanish: string | null;
  tugash: string | null;
}

type JadvalRow = {
  id: string;
  nomi: string;
  imtiyozDaqiqa: number;
  kuchgaKirgan: Date | null;
  kunlar: { hafta: number; ishKuni: boolean; boshlanish: string | null; tugash: string | null }[];
};

/** Jadvaldan berilgan sana uchun kun rejimini oladi (kuchga kirish sanasi hisobga olinadi). */
export function jadvalKunini(jadval: JadvalRow | null, sana: string): EffektivJadval | null {
  if (!jadval) return null;
  if (jadval.kuchgaKirgan && dateOnlyStringToUTCDate(sana) < jadval.kuchgaKirgan) return null;
  const kun = jadval.kunlar.find((k) => k.hafta === sanaHaftaKuni(sana));
  if (!kun) return null;
  return {
    scheduleId: jadval.id,
    nomi: jadval.nomi,
    imtiyozDaqiqa: jadval.imtiyozDaqiqa,
    ishKuni: kun.ishKuni,
    boshlanish: kun.boshlanish,
    tugash: kun.tugash,
  };
}

/** Xodimning shu sanadagi amaldagi jadvali: shaxsiy, bo'lmasa biznes standarti. */
export async function xodimJadvaliTx(
  tx: BusinessTx,
  businessId: string,
  xodim: { workScheduleId: string | null },
  sana: string
): Promise<EffektivJadval | null> {
  const where = xodim.workScheduleId
    ? { id: xodim.workScheduleId, businessId, deletedAt: null }
    : { businessId, standart: true, isActive: true, deletedAt: null };
  const jadval = await tx.workSchedule.findFirst({ where, include: { kunlar: true } });
  return jadvalKunini(jadval, sana);
}

/** Xodimning amaldagi ish joyi: shaxsiy, bo'lmasa biznes standarti. */
async function xodimIshJoyiTx(
  tx: BusinessTx,
  businessId: string,
  xodim: { workLocationId: string | null }
) {
  const where = xodim.workLocationId
    ? { id: xodim.workLocationId, businessId, deletedAt: null }
    : { businessId, standart: true, isActive: true, deletedAt: null };
  return tx.workLocation.findFirst({ where });
}

// ---------------------------------------------------------------------------
// Tekshiruv (selfie + GPS) — siyosatga qarab
// ---------------------------------------------------------------------------

interface TekshiruvNatijasi {
  lat: number | null;
  lng: number | null;
  aniqlikM: number | null;
  masofa: number | null;
  ruxsatRadius: number | null;
  workLocationId: string | null;
  selfie: { mazmun: string; mimeType: string; hajm: number } | null;
}

/**
 * Siyosat bo'yicha selfie/GPS/radius tekshiruvi. Hammasi SERVER tomonda:
 * frontend tekshiruvi faqat qulaylik, ishonch manbai emas.
 */
async function tekshiruvOtkaz(
  tx: BusinessTx,
  businessId: string,
  xodim: {
    workLocationId: string | null;
    selfieTalab: boolean;
    gpsTalab: boolean;
    radiusTalab: boolean;
  },
  input: CheckInput
): Promise<TekshiruvNatijasi> {
  const natija: TekshiruvNatijasi = {
    lat: null,
    lng: null,
    aniqlikM: null,
    masofa: null,
    ruxsatRadius: null,
    workLocationId: null,
    selfie: null,
  };

  if (xodim.selfieTalab) {
    if (!input.selfieBase64 || !input.selfieMime) {
      throw new BadRequestError("Davomatni tasdiqlash uchun selfie talab qilinadi");
    }
    let bayt: Buffer;
    try {
      bayt = Buffer.from(input.selfieBase64, "base64");
    } catch {
      throw new BadRequestError("Selfie o'qib bo'lmadi — qaytadan urinib ko'ring");
    }
    if (bayt.byteLength === 0) throw new BadRequestError("Selfie bo'sh — qaytadan suratga oling");
    if (bayt.byteLength > SELFIE_MAX_BAYT) {
      throw new BadRequestError("Selfie hajmi katta — qaytadan suratga oling");
    }
    natija.selfie = {
      mazmun: bayt.toString("base64"),
      mimeType: input.selfieMime,
      hajm: bayt.byteLength,
    };
  }

  if (xodim.gpsTalab) {
    if (input.lat == null || input.lng == null) {
      throw new BadRequestError("Davomatni tasdiqlash uchun lokatsiyaga ruxsat bering");
    }
    if (input.aniqlikM != null && input.aniqlikM > GPS_MAX_ANIQLIK_M) {
      throw new BadRequestError(
        "GPS aniqligi juda past — ochiq joyga chiqib qaytadan urinib ko'ring"
      );
    }
    natija.lat = input.lat;
    natija.lng = input.lng;
    natija.aniqlikM = input.aniqlikM != null ? Math.round(input.aniqlikM) : null;

    const joy = await xodimIshJoyiTx(tx, businessId, xodim);
    if (joy) {
      natija.workLocationId = joy.id;
      natija.ruxsatRadius = joy.radiusM;
      natija.masofa = masofaM(input.lat, input.lng, joy.lat, joy.lng);
    }
    if (xodim.radiusTalab) {
      if (!joy) {
        throw new BadRequestError(
          "Ish joyi sozlanmagan — administrator avval ish joyini belgilashi kerak"
        );
      }
      if ((natija.masofa ?? Infinity) > joy.radiusM) {
        throw new BadRequestError("Siz belgilangan ish joyi hududida emassiz");
      }
    }
  }

  return natija;
}

// ---------------------------------------------------------------------------
// CHECK-IN — ishni boshlash
// ---------------------------------------------------------------------------

export interface CheckJavobi {
  attendanceId: string;
  sana: string;
  vaqt: string; // ISO (UTC)
  kechikishDaqiqa: number;
  jarimaDaqiqa: number;
  vaqtida: boolean;
  ishlanganDaqiqa?: number;
  ertaKetishDaqiqa?: number;
  ortiqchaDaqiqa?: number;
}

export async function ishniBoshla(params: {
  businessId: string;
  employeeId: string;
  input: CheckInput;
  /** FAQAT test uchun: server vaqti in'eksiyasi. Production'da berilmaydi. */
  hozir?: Date;
}): Promise<CheckJavobi> {
  // SERVER VAQTI — yagona haqiqat manbai (mijoz vaqti umuman o'qilmaydi).
  const hozir = params.hozir ?? new Date();
  const sana = toshkentSana(hozir);
  const sanaUTC = dateOnlyStringToUTCDate(sana);

  try {
    return await runBusinessTx(params.businessId, async (tx) => {
      const xodim = await tx.employee.findFirst({
        where: { id: params.employeeId, businessId: params.businessId, deletedAt: null, isActive: true },
      });
      if (!xodim) throw new ForbiddenError("Xodim topilmadi");

      const mavjud = await tx.attendance.findFirst({
        where: { businessId: params.businessId, employeeId: xodim.id, sana: sanaUTC },
      });
      if (mavjud?.kelganVaqt) {
        throw new BadRequestError("Bugun ish allaqachon boshlangan");
      }

      const tekshiruv = await tekshiruvOtkaz(tx, params.businessId, xodim, params.input);
      const jadval = await xodimJadvaliTx(tx, params.businessId, xodim, sana);

      // Kechikish faqat ish kuni va boshlanish vaqti aniq bo'lganda hisoblanadi.
      const kechikish =
        jadval?.ishKuni && jadval.boshlanish
          ? kechikishHisobla({
              kelgan: hozir,
              sana,
              boshlanish: jadval.boshlanish,
              imtiyozDaqiqa: jadval.imtiyozDaqiqa,
            })
          : { xomDaqiqa: 0, jarimaDaqiqa: 0, vaqtida: true };

      const qiymatlar = {
        holat: "keldi",
        kelganVaqt: hozir,
        kechikishDaqiqa: kechikish.xomDaqiqa,
        jarimaDaqiqa: kechikish.jarimaDaqiqa,
        rejaBoshlanish: jadval?.ishKuni ? jadval.boshlanish : null,
        rejaTugash: jadval?.ishKuni ? jadval.tugash : null,
        rejaImtiyoz: jadval?.imtiyozDaqiqa ?? null,
        manba: "selfie_gps",
      };

      const attendance = mavjud
        ? await tx.attendance.update({ where: { id: mavjud.id }, data: qiymatlar })
        : await tx.attendance.create({
            data: {
              businessId: params.businessId,
              employeeId: xodim.id,
              sana: sanaUTC,
              ...qiymatlar,
            },
          });

      const selfie = tekshiruv.selfie
        ? await tx.attendanceSelfie.create({
            data: {
              businessId: params.businessId,
              employeeId: xodim.id,
              turi: "kelish",
              saqlagich: "db",
              mazmun: tekshiruv.selfie.mazmun,
              mimeType: tekshiruv.selfie.mimeType,
              hajm: tekshiruv.selfie.hajm,
            },
          })
        : null;

      await tx.attendanceCheck.create({
        data: {
          businessId: params.businessId,
          attendanceId: attendance.id,
          employeeId: xodim.id,
          turi: "kelish",
          vaqt: hozir,
          manba: "selfie_gps",
          lat: tekshiruv.lat,
          lng: tekshiruv.lng,
          aniqlikM: tekshiruv.aniqlikM,
          masofaM: tekshiruv.masofa,
          ruxsatRadiusM: tekshiruv.ruxsatRadius,
          workLocationId: tekshiruv.workLocationId,
          selfieId: selfie?.id ?? null,
        },
      });

      // Kechikish jarima qoidasiga tushsa — KUTILMOQDA holatida jarima ochiladi.
      if (kechikish.jarimaDaqiqa > 0) {
        await avtoJarimaTx(tx, {
          businessId: params.businessId,
          employeeId: xodim.id,
          attendanceId: attendance.id,
          sana: sanaUTC,
          kechikishDaqiqa: kechikish.xomDaqiqa,
        });
      }

      return {
        attendanceId: attendance.id,
        sana,
        vaqt: hozir.toISOString(),
        kechikishDaqiqa: kechikish.xomDaqiqa,
        jarimaDaqiqa: kechikish.jarimaDaqiqa,
        vaqtida: kechikish.vaqtida,
      };
    });
  } catch (e) {
    // Ikki parallel bosishda unique(employeeId, sana) ikkinchisini rad etadi.
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002") {
      throw new BadRequestError("Bugun ish allaqachon boshlangan");
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// CHECK-OUT — ishni tugatish
// ---------------------------------------------------------------------------

export async function ishniTugat(params: {
  businessId: string;
  employeeId: string;
  input: CheckInput;
  /** FAQAT test uchun: server vaqti in'eksiyasi. Production'da berilmaydi. */
  hozir?: Date;
}): Promise<CheckJavobi> {
  const hozir = params.hozir ?? new Date();
  const sana = toshkentSana(hozir);
  const sanaUTC = dateOnlyStringToUTCDate(sana);

  return runBusinessTx(params.businessId, async (tx) => {
    const xodim = await tx.employee.findFirst({
      where: { id: params.employeeId, businessId: params.businessId, deletedAt: null, isActive: true },
    });
    if (!xodim) throw new ForbiddenError("Xodim topilmadi");

    const attendance = await tx.attendance.findFirst({
      where: { businessId: params.businessId, employeeId: xodim.id, sana: sanaUTC },
    });
    if (!attendance?.kelganVaqt) {
      throw new BadRequestError("Avval ishni boshlang — bugun check-in qilinmagan");
    }
    if (attendance.ketganVaqt) {
      throw new BadRequestError("Bugun ish allaqachon tugatilgan");
    }

    const tekshiruv = await tekshiruvOtkaz(tx, params.businessId, xodim, params.input);
    const ketish = ketishHisobla({
      kelgan: attendance.kelganVaqt,
      ketgan: hozir,
      sana,
      tugash: attendance.rejaTugash,
    });

    // Parallel ikki bosishdan himoya: faqat ketganVaqt hali NULL bo'lsa yoziladi.
    const yangilandi = await tx.attendance.updateMany({
      where: { id: attendance.id, businessId: params.businessId, ketganVaqt: null },
      data: {
        ketganVaqt: hozir,
        ishlanganDaqiqa: ketish.ishlanganDaqiqa,
        ertaKetishDaqiqa: ketish.ertaKetishDaqiqa,
        ortiqchaDaqiqa: ketish.ortiqchaDaqiqa,
      },
    });
    if (yangilandi.count === 0) throw new BadRequestError("Bugun ish allaqachon tugatilgan");

    const selfie = tekshiruv.selfie
      ? await tx.attendanceSelfie.create({
          data: {
            businessId: params.businessId,
            employeeId: xodim.id,
            turi: "ketish",
            saqlagich: "db",
            mazmun: tekshiruv.selfie.mazmun,
            mimeType: tekshiruv.selfie.mimeType,
            hajm: tekshiruv.selfie.hajm,
          },
        })
      : null;

    await tx.attendanceCheck.create({
      data: {
        businessId: params.businessId,
        attendanceId: attendance.id,
        employeeId: xodim.id,
        turi: "ketish",
        vaqt: hozir,
        manba: "selfie_gps",
        lat: tekshiruv.lat,
        lng: tekshiruv.lng,
        aniqlikM: tekshiruv.aniqlikM,
        masofaM: tekshiruv.masofa,
        ruxsatRadiusM: tekshiruv.ruxsatRadius,
        workLocationId: tekshiruv.workLocationId,
        selfieId: selfie?.id ?? null,
      },
    });

    return {
      attendanceId: attendance.id,
      sana,
      vaqt: hozir.toISOString(),
      kechikishDaqiqa: attendance.kechikishDaqiqa,
      jarimaDaqiqa: attendance.jarimaDaqiqa,
      vaqtida: attendance.jarimaDaqiqa === 0,
      ishlanganDaqiqa: ketish.ishlanganDaqiqa,
      ertaKetishDaqiqa: ketish.ertaKetishDaqiqa,
      ortiqchaDaqiqa: ketish.ortiqchaDaqiqa,
    };
  });
}

// ---------------------------------------------------------------------------
// ADMIN TUZATISHI — asl dalil o'chmaydi, tuzatish alohida yozuv bo'lib qoladi
// ---------------------------------------------------------------------------

export async function davomatTuzat(params: {
  businessId: string;
  userId: string;
  data: TuzatishInput;
}) {
  const { data } = params;
  const sanaUTC = dateOnlyStringToUTCDate(data.sana);

  const natija = await runBusinessTx(params.businessId, async (tx) => {
    const xodim = await tx.employee.findFirst({
      where: { id: data.employeeId, businessId: params.businessId, deletedAt: null },
    });
    if (!xodim) throw new ForbiddenError("Xodim topilmadi");

    const mavjud = await tx.attendance.findFirst({
      where: { businessId: params.businessId, employeeId: xodim.id, sana: sanaUTC },
    });

    const jadval = await xodimJadvaliTx(tx, params.businessId, xodim, data.sana);
    const kelgan =
      data.kelganVaqt !== undefined && data.kelganVaqt !== null
        ? toshkentVaqtniUTCga(data.sana, data.kelganVaqt)
        : mavjud?.kelganVaqt ?? null;
    const ketgan =
      data.ketganVaqt !== undefined && data.ketganVaqt !== null
        ? toshkentVaqtniUTCga(data.sana, data.ketganVaqt)
        : mavjud?.ketganVaqt ?? null;
    if (kelgan && ketgan && ketgan < kelgan) {
      throw new BadRequestError("Ketish vaqti kelish vaqtidan oldin bo'lmasligi kerak");
    }

    const kechikish =
      kelgan && jadval?.ishKuni && jadval.boshlanish
        ? kechikishHisobla({
            kelgan,
            sana: data.sana,
            boshlanish: jadval.boshlanish,
            imtiyozDaqiqa: jadval.imtiyozDaqiqa,
          })
        : { xomDaqiqa: 0, jarimaDaqiqa: 0, vaqtida: true };
    const ketish =
      kelgan && ketgan
        ? ketishHisobla({ kelgan, ketgan, sana: data.sana, tugash: jadval?.tugash ?? null })
        : { ishlanganDaqiqa: 0, ertaKetishDaqiqa: 0, ortiqchaDaqiqa: 0 };

    const holat = data.holat ?? (kelgan ? "keldi" : mavjud?.holat ?? "keldi");
    const qiymatlar = {
      holat,
      kelganVaqt: kelgan,
      ketganVaqt: ketgan,
      kechikishDaqiqa: kechikish.xomDaqiqa,
      jarimaDaqiqa: kechikish.jarimaDaqiqa,
      ishlanganDaqiqa: ketish.ishlanganDaqiqa,
      ertaKetishDaqiqa: ketish.ertaKetishDaqiqa,
      ortiqchaDaqiqa: ketish.ortiqchaDaqiqa,
      rejaBoshlanish: jadval?.ishKuni ? jadval.boshlanish : mavjud?.rejaBoshlanish ?? null,
      rejaTugash: jadval?.ishKuni ? jadval.tugash : mavjud?.rejaTugash ?? null,
      rejaImtiyoz: jadval?.imtiyozDaqiqa ?? mavjud?.rejaImtiyoz ?? null,
      manba: "admin",
    };

    const attendance = mavjud
      ? await tx.attendance.update({ where: { id: mavjud.id }, data: qiymatlar })
      : await tx.attendance.create({
          data: {
            businessId: params.businessId,
            employeeId: xodim.id,
            sana: sanaUTC,
            ...qiymatlar,
          },
        });

    // Tuzatish dalili: kim, qachon, nima sababdan, avvalgi qiymat.
    if (data.kelganVaqt != null) {
      await tx.attendanceCheck.create({
        data: {
          businessId: params.businessId,
          attendanceId: attendance.id,
          employeeId: xodim.id,
          turi: "kelish",
          vaqt: kelgan!,
          manba: "admin",
          userId: params.userId,
          sabab: data.sabab,
          oldingiVaqt: mavjud?.kelganVaqt ?? null,
        },
      });
    }
    if (data.ketganVaqt != null) {
      await tx.attendanceCheck.create({
        data: {
          businessId: params.businessId,
          attendanceId: attendance.id,
          employeeId: xodim.id,
          turi: "ketish",
          vaqt: ketgan!,
          manba: "admin",
          userId: params.userId,
          sabab: data.sabab,
          oldingiVaqt: mavjud?.ketganVaqt ?? null,
        },
      });
    }

    // Avto-jarima yangi hisobga moslanadi: KUTILMOQDA jarima yangilanadi,
    // kechikish endi qoidaga tushmasa — O'CHIRILADI (tasdiqlangan/rad
    // etilganlarga tegilmaydi). Shu bois shartsiz chaqiriladi.
    if (kelgan) {
      await avtoJarimaTx(tx, {
        businessId: params.businessId,
        employeeId: xodim.id,
        attendanceId: attendance.id,
        sana: sanaUTC,
        kechikishDaqiqa: kechikish.xomDaqiqa,
      });
    }

    return attendance;
  });

  await logAudit({
    businessId: params.businessId,
    action: "update",
    entity: "attendance",
    entityId: natija.id,
    after: {
      sana: data.sana,
      kelganVaqt: data.kelganVaqt ?? null,
      ketganVaqt: data.ketganVaqt ?? null,
      sabab: data.sabab,
    },
  });
  return natija;
}

// ---------------------------------------------------------------------------
// KELMAGANLARNI BELGILASH — kun yopilgach (cron) ishlaydi
// ---------------------------------------------------------------------------

/**
 * O'tgan Toshkent kuni uchun: jadvalda ISH KUNI bo'lgan, lekin davomat yozuvi
 * yo'q faol xodimlar "kelmadi" deb belgilanadi va (qoida bo'lsa) KUTILMOQDA
 * jarima ochiladi. Dam olish kuni hech qachon "kelmadi" bo'lmaydi.
 * Idempotent: mavjud yozuvga tegilmaydi.
 */
export async function kelmaganlarniBelgila(businessId: string, sana: string) {
  const sanaUTC = dateOnlyStringToUTCDate(sana);
  let belgilandi = 0;

  const xodimlar = await prisma.employee.findMany({
    where: { businessId, deletedAt: null, isActive: true },
    select: { id: true, workScheduleId: true },
  });

  for (const xodim of xodimlar) {
    await runBusinessTx(businessId, async (tx) => {
      const jadval = await xodimJadvaliTx(tx, businessId, xodim, sana);
      // Jadvalsiz yoki dam olish kuni — kelmaganlik yozilmaydi.
      if (!jadval?.ishKuni) return;

      const mavjud = await tx.attendance.findFirst({
        where: { businessId, employeeId: xodim.id, sana: sanaUTC },
        select: { id: true },
      });
      if (mavjud) return;

      const attendance = await tx.attendance.create({
        data: {
          businessId,
          employeeId: xodim.id,
          sana: sanaUTC,
          holat: "kelmadi",
          rejaBoshlanish: jadval.boshlanish,
          rejaTugash: jadval.tugash,
          rejaImtiyoz: jadval.imtiyozDaqiqa,
          manba: "admin",
          izoh: "Avtomatik: kun yakunida kelmagan deb belgilandi",
        },
      });
      await kelmadiJarimaTx(tx, {
        businessId,
        employeeId: xodim.id,
        attendanceId: attendance.id,
        sana: sanaUTC,
      });
      belgilandi += 1;
    });
  }

  return { belgilandi, jami: xodimlar.length };
}
