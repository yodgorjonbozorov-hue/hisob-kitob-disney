import { prisma } from "@/lib/prisma";
import { getMeningKassam } from "@/lib/queries/accounts";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import { QARZ_EMAS } from "@/lib/qarzFiltr";

/**
 * CRM — BUYURTMALAR SAHIFASINING YUQORI PANELI.
 *
 * Ikki blok: xodimning O'Z kassasi va tez chiqim kiritish. Ikkalasi ham
 * mavjud tizimlar ustiga qurilgan — yangi moliyaviy hisob YARATILMAYDI:
 *   - kassa raqami `getMeningKassam` (Account ledgeri, "Mening kassam"
 *     sahifasi bilan AYNI manba);
 *   - topshirish `AccountTransfer(turi = "smena")` (kassa topshirish
 *     mantig'i o'zgarmaydi);
 *   - chiqim oddiy `Transaction(turi = "chiqim")`.
 *
 * ═══ KASSA MAXFIYLIGI ═══
 * "kassa.jami" huquqi biznesning UMUMIY kassasini yopadi. Xodimning O'Z
 * kassasi esa hech qachon yopilmaydi: u kun oxirida shu pulni topshirishi
 * kerak, ko'rmasa topshira olmaydi. Shuning uchun bu panel huquq
 * tekshirmaydi — lekin faqat SO'ROV YUBORGAN odamning kassasini qaytaradi
 * ("Mening kassam" sahifasidagi qoida).
 */

/** Kimga topshirish mumkin — nom, summasiz (kassa maxfiyligi). */
export interface TopshirishNishoniDTO {
  id: string;
  nomi: string;
  egaIsm: string | null;
}

export interface XodimKassaDTO {
  accountId: string;
  /** Kassa egasining ismi — kartaning sarlavhasi ostida. */
  ism: string;
  /** Joriy smena kirimi (oxirgi topshirishdan beri). */
  kirim: number;
  /** Joriy smena chiqimi. */
  chiqim: number;
  /** Kassada MAVJUD pul = ledger qoldig'i − tasdiq kutayotgan topshirish. */
  kassada: number;
  /** Topshirilgan, hali qabul qilinmagan summa (bo'lsa). */
  ochiqTopshirish: { summa: number; kimga: string } | null;
  nishonlar: TopshirishNishoniDTO[];
}

export interface ChiqimQatoriDTO {
  id: string;
  /** Kategoriya nomi (bo'lmasa izoh) — ro'yxatda ko'rinadigan matn. */
  nomi: string;
  summa: number;
}

export interface ChiqimPaneliDTO {
  /** Bugungi (Toshkent kuni) chiqim jami. */
  bugun: number;
  oxirgilar: ChiqimQatoriDTO[];
}

export interface CrmYuqoriPanelDTO {
  kassa: XodimKassaDTO | null;
  chiqim: ChiqimPaneliDTO;
}

/** Ro'yxatda ko'rsatiladigan oxirgi chiqimlar soni. */
const OXIRGI_CHIQIM_SONI = 3;

/**
 * Xodimning o'z kassasi. `null` — shaxsiy kassa rejimi yoqilmagan (naqd
 * umumiy kassaga tushadi), u holda karta o'rniga tushuntirish ko'rsatiladi.
 */
export async function xodimKassaHolati(
  businessId: string,
  userId: string,
  ism: string
): Promise<XodimKassaDTO | null> {
  const meniki = await getMeningKassam(businessId, userId);
  if (!meniki) return null;

  const [nishonlar, ochiq] = await Promise.all([
    // Nishonlar — FAQAT nom va ega ismi. Qoldiq ATAYLAB olinmaydi: xodim
    // boshqa kassadagi pulni bu yerdan bilib olmasin.
    prisma.account.findMany({
      where: { businessId, isActive: true, id: { not: meniki.accountId } },
      select: { id: true, nomi: true, user: { select: { ism: true } } },
      orderBy: [{ tartib: "asc" }, { createdAt: "asc" }],
    }),
    prisma.accountTransfer.findFirst({
      where: {
        businessId,
        fromAccountId: meniki.accountId,
        turi: "smena",
        holat: "kutilmoqda",
      },
      orderBy: { createdAt: "desc" },
      select: { summa: true, toUserIsm: true, toAccount: { select: { nomi: true } } },
    }),
  ]);

  return {
    accountId: meniki.accountId,
    ism,
    kirim: meniki.smenaKirim,
    chiqim: meniki.smenaChiqim,
    kassada: meniki.mavjud,
    ochiqTopshirish: ochiq
      ? { summa: ochiq.summa, kimga: ochiq.toUserIsm ?? ochiq.toAccount.nomi }
      : null,
    nishonlar: nishonlar.map((n) => ({ id: n.id, nomi: n.nomi, egaIsm: n.user?.ism ?? null })),
  };
}

/**
 * Chiqim bloki — bugungi jami va oxirgi yozuvlar.
 *
 * `scopeUserId` — KO'RINUVCHANLIK chegarasi (`lib/auth/visibility.ts` bilan
 * bir xil qoida): direktor biznesning hammasini, xodim faqat O'ZI kiritgan
 * chiqimlarni ko'radi. Yangi qoida kiritilmaydi.
 */
export async function chiqimHolati(
  businessId: string,
  scopeUserId: string | null,
  bugun: string
): Promise<ChiqimPaneliDTO> {
  const asos = {
    businessId,
    turi: "chiqim",
    deletedAt: null,
    ...QARZ_EMAS,
    ...(scopeUserId ? { userId: scopeUserId } : {}),
  };

  const [jami, oxirgilar] = await Promise.all([
    prisma.transaction.aggregate({
      where: { ...asos, sana: dateOnlyStringToUTCDate(bugun) },
      _sum: { summa: true },
    }),
    prisma.transaction.findMany({
      where: asos,
      select: { id: true, summa: true, izoh: true, category: { select: { nomi: true } } },
      orderBy: { createdAt: "desc" },
      take: OXIRGI_CHIQIM_SONI,
    }),
  ]);

  return {
    bugun: jami._sum.summa ?? 0,
    oxirgilar: oxirgilar.map((t) => ({
      id: t.id,
      nomi: t.category?.nomi || t.izoh?.trim() || "Chiqim",
      summa: t.summa,
    })),
  };
}

/** Ikkala blok bitta chaqiruvda — sahifa va yangilash API'si uchun. */
export async function crmYuqoriPanel(
  businessId: string,
  user: { userId: string; ism: string },
  scopeUserId: string | null,
  bugun: string
): Promise<CrmYuqoriPanelDTO> {
  const [kassa, chiqim] = await Promise.all([
    xodimKassaHolati(businessId, user.userId, user.ism),
    chiqimHolati(businessId, scopeUserId, bugun),
  ]);
  return { kassa, chiqim };
}
