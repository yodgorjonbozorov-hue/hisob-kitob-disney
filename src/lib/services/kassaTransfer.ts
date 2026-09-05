import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx, type BusinessTx } from "@/lib/db/businessTx";
import { isManager } from "@/lib/auth/roles";
import { logAudit } from "@/lib/services/audit";
import {
  ensureUserKassaTx,
  kassaQoldiqTx,
  mavjudQoldiqTx,
} from "@/lib/services/userKassa";
import type { KassaTransferInput, TransferQarorInput } from "@/lib/validation/account";

/**
 * KASSADAN KASSAGA PUL O'TKAZISH — QABUL TASDIG'I BILAN.
 *
 * ═══ NEGA MAVJUD `createUserTransfer` YETMAYDI ═══
 * U o'tkazmani DARHOL yakunlaydi. Smena topshirishda esa pul qo'ldan qo'lga
 * o'tadi va qabul qiluvchi uni SANAB olishi kerak — tasdiqlanmaguncha
 * o'tkazma yakunlangan hisoblanmaydi.
 *
 * ═══ PUL QAYERDA TURADI ═══
 * Tasdiq kutilayotganda pul YUBORUVCHIDA qoladi. Ya'ni "kutilmoqda" qatori
 * qoldiqqa umuman kirmaydi (lib/validation/account.ts → QOLDIQ_HOLATLARI).
 * Aks holda pul limbo'da — hech kimning kassasida bo'lmagan holatda — qolardi
 * va "jami kassalar" kamayib ketardi.
 *
 * Buning evaziga bir pulni ikki marta jo'natish xavfi paydo bo'ladi, shuning
 * uchun MAVJUD qoldiq = qoldiq − kutilayotgan chiqim (`mavjudQoldiqTx`).
 *
 * ═══ KASSA FARQI ═══
 * `turi = "smena"` (kassani topshirish) da qatorga ikkita raqam muzlatiladi:
 * `hisoblangan` — topshirish paytida TIZIM hisoblagan mavjud qoldiq, va
 * `farq = summa − hisoblangan`. Farq manfiy bo'ladi (kamomad) yoki nol;
 * musbat bo'lishi mumkin emas, chunki mavjud qoldiqdan ko'p pul o'tkazishga
 * yo'l qo'yilmaydi. Kamomad kassirning kassasida OCHIQ qoladi — u yerdan
 * pul o'z-o'zidan yo'qolmaydi, direktor uni ko'radi va sababini o'qiydi.
 *
 * ═══ NEGA "bekor" EMAS, "rad" ═══
 * `holat = "bekor"` yakunlangan o'tkazmani STORNO bilan qaytarish uchun va u
 * qoldiqda QOLADI (storno qatori uni nolga chiqaradi). Tasdiqlanmagan
 * o'tkazmada esa pul umuman ko'chmagan — u `holat = "rad"` bo'ladi va
 * qoldiqqa hech qachon kirmaydi. Kim rad etgani `tasdiqlaganId` da: agar u
 * yuboruvchining o'zi bo'lsa UI "Bekor qilindi", aks holda "Rad etildi" deydi.
 */

export interface TransferAktor {
  userId: string;
  ism: string;
  rol: string;
}

interface KassaMalumot {
  id: string;
  nomi: string;
  userId: string | null;
  isActive: boolean;
}

/** Kassani biznes ichidan topadi (tranzaksiya ichida, businessId qo'lda). */
async function kassaTopTx(
  tx: BusinessTx,
  businessId: string,
  accountId: string
): Promise<KassaMalumot> {
  const kassa = await tx.account.findFirst({
    where: { id: accountId, businessId },
    select: { id: true, nomi: true, userId: true, isActive: true },
  });
  if (!kassa) throw new ForbiddenError("Kassa topilmadi yoki boshqa biznesga tegishli");
  if (!kassa.isActive) throw new BadRequestError("Nofaol kassa bilan pul ko'chirib bo'lmaydi");
  return kassa;
}

/**
 * BU SO'ROV XODIMNING O'Z KASSASINI TOPSHIRISHIMI?
 *
 * "Kassa topshirish" — huquq emas, MAJBURIYAT: xodim kun oxirida qo'lidagi
 * naqdni topshirmasa pul hisobda osilib qoladi. Shuning uchun route bu
 * holatda "pul.berish" huquqini talab qilmaydi (sotuvchi rolida u yo'q).
 *
 * Shart: `turi = "smena"` VA manba kassa berilmagan (server o'zi xodimning
 * shaxsiy kassasini oladi) yoki berilgani aynan shu xodimniki. Boshqa
 * odamning kassasidan pul chiqarish bu yerdan o'tmaydi — `kassaTransferYarat`
 * ham buni mustaqil rad etadi (ikki qatlamli tekshiruv).
 */
export async function ozKassaTopshirishimi(
  businessId: string,
  userId: string,
  data: KassaTransferInput
): Promise<boolean> {
  if (data.turi !== "smena") return false;
  if (!data.fromAccountId) return true;
  const kassa = await prisma.account.findFirst({
    where: { id: data.fromAccountId, businessId },
    select: { userId: true },
  });
  return kassa?.userId === userId;
}

/**
 * O'TKAZMA YARATISH.
 *
 * KASSA TOPSHIRISH (`turi = "smena"`) HAR DOIM tasdiq kutadi — topshirish va
 * qabul qilish ikkita alohida operatsiya (pastdagi `tasdiqKerak` izohi).
 *
 * ODDIY O'TKAZMADA tasdiq faqat qabul qiluvchi kassa BOSHQA odamniki
 * bo'lganda: pul o'sha odamning qo'liga o'tadi va u sanab olishi kerak.
 * Umumiy kassaga (bank, terminal) yoki o'z kassasiga oddiy o'tkazma darhol
 * yakunlanadi — u yerda tasdiqlaydigan ikkinchi tomon yo'q.
 */
export async function kassaTransferYarat(
  businessId: string,
  aktor: TransferAktor,
  data: KassaTransferInput
) {
  const turi = data.turi ?? "transfer";

  const transfer = await runBusinessTx(businessId, async (tx) => {
    // Yuboruvchi kassa: tanlangani yoki aktorning shaxsiy kassasi.
    const from = data.fromAccountId
      ? await kassaTopTx(tx, businessId, data.fromAccountId)
      : {
          ...(await ensureUserKassaTx(tx, businessId, { id: aktor.userId, ism: aktor.ism })),
          userId: aktor.userId,
          isActive: true,
        };
    const to = await kassaTopTx(tx, businessId, data.toAccountId);

    if (from.id === to.id) {
      throw new BadRequestError("Bitta kassaning o'ziga o'tkazib bo'lmaydi");
    }
    // Birovning shaxsiy kassasidan faqat boshqaruvchi pul chiqara oladi.
    if (from.userId && from.userId !== aktor.userId && !isManager(aktor.rol)) {
      throw new ForbiddenError("Bu kassa boshqa foydalanuvchiga tegishli");
    }

    // KASSADA YO'Q PULNI O'TKAZIB BO'LMAYDI (kutilayotgan chiqim ham ayriladi).
    const { mavjud } = await mavjudQoldiqTx(tx, businessId, from.id);
    if (mavjud < data.summa) {
      throw new BadRequestError(
        `Kassada yetarli mablag' mavjud emas. ` +
          `Mavjud: ${mavjud.toLocaleString("ru-RU")} so'm, ` +
          `o'tkazilayotgan: ${data.summa.toLocaleString("ru-RU")} so'm`
      );
    }

    // ═══ KASSA FARQI (faqat topshirishda) ═══
    // "Tizim bo'yicha qoldiq" — aynan SHU paytdagi mavjud pul (kutilayotgan
    // chiqim ayrilgan). U qatorga muzlatiladi: qaror kutayotganda kassaga
    // yangi yozuv tushsa ham direktor tasdiqlaydigan farq o'zgarmaydi.
    // Farq hech qachon musbat bo'lmaydi — yuqoridagi tekshiruv mavjuddan
    // ko'p pul o'tkazishga yo'l qo'ymaydi (manfiy qoldiq taqiqlangan).
    const hisoblangan = turi === "smena" ? mavjud : null;
    const farq = hisoblangan === null ? null : data.summa - hisoblangan;
    if (farq !== null && farq !== 0 && !data.izoh?.trim()) {
      throw new BadRequestError(
        "Kassa farqi bor — sababini yozing (masalan: mijozga qaytim ortiqcha berildi)"
      );
    }

    /*
     * TASDIQ QACHON KERAK.
     *
     * KASSA TOPSHIRISH (`turi = "smena"`) — HAR DOIM. Topshirish ikkita
     * ALOHIDA operatsiya: xodim topshiradi, direktor QABUL QILADI. Ilgari
     * shart faqat "qabul qiluvchi kassa boshqa odamniki" edi, shuning uchun
     * umumiy (egasiz) direktor/asosiy kassaga topshirish DARHOL yakunlanardi
     * — xodimning kassasi hech kim sanamasdan turib nolga tushardi. Endi
     * bunday topshiriq ham "Qabul kutilmoqda" holatida turadi va uni faqat
     * boshqaruvchi yopadi (`kassaTransferQaror`: egasiz kassada
     * `qabulQiluvchi` bo'lmaydi, faqat `isManager` o'tadi).
     *
     * ODDIY O'TKAZMA — avvalgidek: tasdiq faqat pul BOSHQA odamning qo'liga
     * o'tganda. O'z kassalari orasidagi yoki umumiy kassaga (bank, terminal)
     * ko'chirishda tasdiqlaydigan ikkinchi tomon yo'q.
     */
    const tasdiqKerak = turi === "smena" || (!!to.userId && to.userId !== aktor.userId);

    // IKKI MARTA YUBORISHDAN HIMOYA: aynan shu yo'nalish va summa bilan
    // tasdiq kutayotgan o'tkazma bo'lsa — ikkinchisi yaratilmaydi.
    if (tasdiqKerak) {
      const takror = await tx.accountTransfer.findFirst({
        where: {
          businessId,
          fromAccountId: from.id,
          toAccountId: to.id,
          summa: data.summa,
          holat: "kutilmoqda",
        },
        select: { id: true },
      });
      if (takror) {
        throw new BadRequestError(
          "Aynan shunday o'tkazma allaqachon tasdiq kutmoqda — qabul qiluvchi tasdiqlashini kuting"
        );
      }
      // Smena topshirishda bir vaqtda bittadan ortiq ochiq topshiriq bo'lmaydi.
      if (turi === "smena") {
        const ochiq = await tx.accountTransfer.findFirst({
          where: { businessId, fromAccountId: from.id, turi: "smena", holat: "kutilmoqda" },
          select: { id: true },
        });
        if (ochiq) {
          throw new BadRequestError(
            "Sizda tasdiq kutayotgan smena topshirig'i bor — avval u qabul qilinsin yoki bekor qiling"
          );
        }
      }
    }

    // Ism snapshotlari — foydalanuvchi keyin o'chirilsa ham tarix o'qiladi.
    const egalar = await tx.user.findMany({
      where: { id: { in: [from.userId, to.userId].filter((x): x is string => !!x) } },
      select: { id: true, ism: true },
    });
    const ism = (id: string | null) => (id ? egalar.find((u) => u.id === id)?.ism ?? null : null);
    const endi = new Date();

    return tx.accountTransfer.create({
      data: {
        businessId,
        fromAccountId: from.id,
        toAccountId: to.id,
        summa: data.summa,
        valyuta: "UZS",
        // O'tkazma KIRITILGAN kunga yoziladi — kassadagi pul sanaga emas,
        // haqiqiy paytga qarab harakatlanadi.
        sana: endi,
        izoh: data.izoh?.trim() || undefined,
        userId: aktor.userId,
        turi,
        fromUserId: from.userId,
        fromUserIsm: ism(from.userId),
        toUserId: to.userId,
        toUserIsm: ism(to.userId),
        hisoblangan,
        farq,
        holat: tasdiqKerak ? "kutilmoqda" : "bajarildi",
        ...(tasdiqKerak
          ? {}
          : { tasdiqlaganId: aktor.userId, tasdiqlaganIsm: aktor.ism, tasdiqlanganAt: endi }),
      },
    });
  });

  await logAudit({
    businessId,
    action: "create",
    entity: "accountTransfer",
    entityId: transfer.id,
    after: {
      turi: transfer.turi,
      fromAccountId: transfer.fromAccountId,
      toAccountId: transfer.toAccountId,
      fromUserIsm: transfer.fromUserIsm,
      toUserIsm: transfer.toUserIsm,
      summa: transfer.summa,
      // Kassa farqi auditga TUSHADI — "kim qancha kam topshirdi" savoliga
      // javob tarixda qoladi (izoh = kamomad sababi).
      hisoblangan: transfer.hisoblangan,
      farq: transfer.farq,
      izoh: transfer.izoh,
      holat: transfer.holat,
    },
  });
  return transfer;
}

/**
 * KUTILAYOTGAN O'TKAZMA BO'YICHA QAROR.
 *
 * Atomik va takrorlashga chidamli: qator faqat `holat = "kutilmoqda"`
 * bo'lgandagina yangilanadi (`updateMany` + `count` tekshiruvi). Ikki
 * foydalanuvchi bir vaqtda bossa yoki tugma ikki marta bosilsa — ikkinchisi
 * xato oladi va pul ikki marta ko'chmaydi.
 */
export async function kassaTransferQaror(
  businessId: string,
  aktor: TransferAktor,
  transferId: string,
  qaror: TransferQarorInput
) {
  const natija = await runBusinessTx(businessId, async (tx) => {
    const mavjud = await tx.accountTransfer.findFirst({
      where: { id: transferId, businessId },
    });
    if (!mavjud) throw new BadRequestError("O'tkazma topilmadi");
    if (mavjud.holat !== "kutilmoqda") {
      throw new BadRequestError("Bu o'tkazma bo'yicha qaror allaqachon qabul qilingan");
    }

    const qabulQiluvchi = mavjud.toUserId === aktor.userId;
    const yuboruvchi = mavjud.fromUserId === aktor.userId;

    if (qaror.amal === "bekor") {
      // Bekor qilish — YUBORUVCHINING o'zi yoki boshqaruvchi.
      if (!yuboruvchi && !isManager(aktor.rol)) {
        throw new ForbiddenError("Bu o'tkazmani bekor qila olmaysiz");
      }
    } else if (!qabulQiluvchi && !isManager(aktor.rol)) {
      // Qabul/rad — QABUL QILUVCHINING o'zi yoki boshqaruvchi.
      throw new ForbiddenError("Bu o'tkazma sizga yuborilmagan");
    }

    const endi = new Date();

    if (qaror.amal === "qabul") {
      // Tasdiq paytida yuboruvchining kassasi hali ham yetarlimi. Kutilayotgan
      // summa mavjud qoldiqdan ayrilgani uchun odatda yetadi; lekin boshqa
      // oqim (masalan xarid to'lovi) oralab o'tgan bo'lsa — bu yerda ushlanadi.
      const qoldiq = await kassaQoldiqTx(tx, businessId, mavjud.fromAccountId);
      if (qoldiq < mavjud.summa) {
        throw new BadRequestError(
          `Yuboruvchi kassada endi yetarli pul yo'q (qoldiq: ${qoldiq.toLocaleString("ru-RU")} so'm). ` +
            `O'tkazmani bekor qilib, qaytadan yarating.`
        );
      }
      const n = await tx.accountTransfer.updateMany({
        where: { id: mavjud.id, businessId, holat: "kutilmoqda" },
        data: {
          holat: "bajarildi",
          tasdiqlaganId: aktor.userId,
          tasdiqlaganIsm: aktor.ism,
          tasdiqlanganAt: endi,
          qarorIzoh: qaror.qarorIzoh?.trim() || undefined,
        },
      });
      if (n.count !== 1) {
        throw new BadRequestError("O'tkazma holati o'zgarib ketdi, sahifani yangilang");
      }
      return { eski: mavjud, holat: "bajarildi" as const };
    }

    // Rad etish va bekor qilish bir xil natijaga olib keladi: pul ko'chmadi.
    // Farqni `tasdiqlaganId` ko'rsatadi (yuboruvchi bo'lsa — bekor qilingan).
    const n = await tx.accountTransfer.updateMany({
      where: { id: mavjud.id, businessId, holat: "kutilmoqda" },
      data: {
        holat: "rad",
        tasdiqlaganId: aktor.userId,
        tasdiqlaganIsm: aktor.ism,
        radAt: endi,
        qarorIzoh: qaror.qarorIzoh?.trim() || undefined,
      },
    });
    if (n.count !== 1) {
      throw new BadRequestError("O'tkazma holati o'zgarib ketdi, sahifani yangilang");
    }
    return { eski: mavjud, holat: "rad" as const };
  });

  await logAudit({
    businessId,
    action: "update",
    entity: "accountTransfer",
    entityId: transferId,
    before: { holat: "kutilmoqda" },
    after: {
      holat: natija.holat,
      amal: qaror.amal,
      qaror: aktor.ism,
      summa: natija.eski.summa,
      hisoblangan: natija.eski.hisoblangan,
      farq: natija.eski.farq,
      fromUserIsm: natija.eski.fromUserIsm,
      toUserIsm: natija.eski.toUserIsm,
    },
  });
  return natija;
}
