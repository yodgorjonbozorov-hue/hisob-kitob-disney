import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx } from "@/lib/db/businessTx";
import { logAudit } from "@/lib/services/audit";
import { pipelineBosqichlari } from "@/lib/crm/service";
import {
  kunlikSinxronBarchasi,
  zakazniYakunlashTx,
  type YakunlashTxNatija,
} from "@/lib/crm/yakunlash";
import { kunlikOchirilganlarniSinxron, zakazMoliyasiniQaytarTx } from "@/lib/crm/qaytarish";
import { yopiqHolat, type ZakazHolat } from "@/lib/crm/pipeline";
import {
  tolovlarJami,
  tolovlarniTekshir,
  tolovSatrlariniYoz,
  tolovTuriBelgisi,
  type TolovSatri,
} from "@/lib/crm/tolovlar";

/**
 * DIREKTOR TUZATISHI — MOLIYAGA O'TGAN ZAKAZNING SUMMASI VA TO'LOVI.
 *
 * ═══ MUAMMO ═══
 * Kirim yoki qarz yozilgan zakazda narx, to'lov va kategoriya QULFLANARDI
 * ("Moliyaga o'tgan zakazning summasi va to'lovi o'zgartirilmaydi").
 * Qulf to'g'ri edi — oddiy xodim CRM formasidan raqamni surib qo'ysa
 * Kirim/Qarzdorlik boshqa raqamni ko'rsatardi. Lekin XATO YOZILGAN
 * zakazni (750 000 o'rniga 75 000, naqd o'rniga click) tuzatishning
 * yo'li ham qolmagandi: direktor Kirimda tranzaksiyani, Qarzdorlikda
 * qarzni ALOHIDA tahrirlashi kerak edi va yarim tuzatilgan holat (kirim
 * o'zgardi, qarz eskiligicha) har safar ehtimol edi.
 *
 * ═══ QOIDA ═══
 * Tuzatish — MOLIYANI QAYTARIB, QAYTA YOZISH. Uchala qadam BITTA
 * tranzaksiyada (CLAUDE.md: har moliyaviy ko'p qadamli amal atomik):
 *
 *   1. mavjud kirimlar YUMSHOQ o'chiriladi va qarz BEKOR qilinadi
 *      (`lib/crm/qaytarish.ts` → `zakazMoliyasiniQaytarTx`) — ledger
 *      append-only qoladi, audit izi uzilmaydi;
 *   2. zakazga yangi narx va kategoriya yoziladi; TO'LOV QATORLARIGA esa
 *      faqat chaqiruvchi ularni ATAYLAB bergan bo'lsa tegiladi;
 *   3. zakaz yana "Yutildi" bo'lsa moliya YANGI raqamlardan qayta
 *      yoziladi (`lib/crm/yakunlash.ts` → `zakazniYakunlashTx`):
 *      to'langan qism kirim, QOLDIQ esa qarzdorlik.
 *
 * Shu sabab dublikat yozuv paydo bo'lmaydi: eski yozuvlar o'chirilgan
 * (kassa qoldig'idan chiqqan), yangilari esa bitta marta yoziladi.
 * "Yutildi → Jarayonda → Yutildi" yo'li ham ayni shu ikki yadroni
 * ishlatadi, ya'ni ikkala yo'lda natija BIR XIL.
 *
 * ═══ MOLIYAVIY TARIX FIZIK O'CHIRILMAYDI ═══
 *   - KIRIM (`Transaction`): YUMSHOQ o'chirish — `deletedAt` + `deletedBy`.
 *     Yozuv bazada qoladi, savatdan tiklanadi, ledger append-only.
 *   - QARZ (`Debt`): O'CHIRILMAYDI, `status = "CANCELLED"` + `cancelledAt`
 *     / `cancelledBy` / `cancelReason`. `deletedAt` tegilmaydi.
 *   - QARZ TO'LOVI (`DebtPayment`): UMUMAN tegilmaydi — to'lovi bor qarzda
 *     tuzatish boshidanoq rad etiladi.
 *   - TO'LOV QATORI (`DealTolov`): bu jadvalda `deletedAt` YO'Q, ya'ni
 *     o'chirish qaytarilmaydi. Shuning uchun qatorlar FAQAT chaqiruvchi
 *     yangi kesim berganda va u eskisidan FARQ QILGANDA almashtiriladi;
 *     bunday holatda eski kesim audit jurnalining `before.tolovlar` iga
 *     snapshot bo'lib tushadi. Narx-only tuzatishda qatorlar umuman
 *     tegilmaydi (misol: 1 000 000 → 750 000 da naqd 200 000 va Click
 *     300 000 joyida qoladi, qoldiq 250 000 bo'ladi).
 *
 * ═══ CHEGARA ═══
 * Qarzga TO'LOV QABUL QILINGAN bo'lsa tuzatish rad etiladi (`qaytarTx`
 * qoidasi): pul haqiqatda kelgan, uni jimgina yo'q qilib bo'lmaydi.
 * Direktor avval Qarzdorlik bo'limida to'lovni tuzatadi.
 *
 * ═══ HUQUQ ═══
 * FAQAT DIREKTOR (`isDirektor` — OWNER). Bu qarz summasini qayta yozish
 * bilan bir darajadagi amal, u esa loyihada allaqachon faqat kompaniya
 * egasiga ochiq (`lib/auth/roles.ts` izohi). Tekshiruv API qatlamida
 * (`api/crm/deals/[id]`), UI tugmasi himoya emas.
 */

/** Ikki to'lov qatori ro'yxati AYNI kesimni bildiradimi (tartib ahamiyatsiz). */
function satrlarTeng(a: TolovSatri[], b: TolovSatri[]): boolean {
  if (a.length !== b.length) return false;
  const kalit = (s: TolovSatri[]) =>
    s
      .map((x) => `${x.kanal}:${x.summa}`)
      .sort()
      .join("|");
  return kalit(a) === kalit(b);
}

export interface DirektorTahrirParams {
  businessId: string;
  dealId: string;
  /** Amalni bajarayotgan direktor. */
  userId: string;
  /** Yangi narx (so'm). Berilmasa tegilmaydi. */
  summa?: number;
  /** Yangi kategoriya (kirim turida). Berilmasa tegilmaydi. */
  categoryId?: string | null;
  /** Yangi to'lov qatorlari. Berilmasa tegilmaydi. */
  tolovlar?: TolovSatri[];
  /** Qatorsiz holatdagi tanlov: "qarz" — qolgani qarzdorlikka. */
  tolovTuri?: string | null;
  /** Yangi ish holati. Berilmasa joriy holat saqlanadi. */
  holat?: ZakazHolat;
  /** YOQOTILDI ga o'tkazilsa — sababi. */
  yoqotishSababi?: string | null;
}

export interface DirektorTahrirNatija {
  dealId: string;
  holat: ZakazHolat;
  summa: number;
  tolangan: number;
  tolovTuri: string | null;
  kirimSumma: number;
  qarzSumma: number;
  transactionId: string | null;
  debtId: string | null;
  /** Yumshoq o'chirilgan eski kirimlar. */
  ochirilganKirimlar: string[];
  /** Bekor qilingan eski qarz (bo'lsa). */
  bekorQilinganQarzId: string | null;
}

/**
 * ZAKAZNI DIREKTOR NOMIDAN TUZATISH (summa, to'lov, kategoriya, holat) —
 * moliyani qaytarib, yangi raqamlardan QAYTA yozadi.
 */
export async function zakazniDirektorTahrirlash(
  params: DirektorTahrirParams
): Promise<DirektorTahrirNatija> {
  const deal = await prisma.deal.findFirst({
    where: { id: params.dealId, businessId: params.businessId, deletedAt: null },
    select: {
      id: true,
      summa: true,
      tolangan: true,
      tolovTuri: true,
      categoryId: true,
      contactId: true,
      holat: true,
      transactionId: true,
      debtId: true,
    },
  });
  if (!deal) throw new ForbiddenError("Zakaz topilmadi");

  // Kategoriya KIRIM turida bo'lishi shart (yakunlash ham buni tekshiradi,
  // lekin xato xabari foydalanuvchiga yozishdan OLDIN chiqsin).
  if (params.categoryId) {
    const cat = await prisma.category.findFirst({
      where: { id: params.categoryId, businessId: params.businessId },
      select: { turi: true },
    });
    if (!cat) throw new ForbiddenError("Kategoriya bu biznesga tegishli emas");
    if (cat.turi !== "kirim") throw new BadRequestError("Kategoriya kirim turida bo'lishi kerak");
  }

  const yangiSumma = params.summa ?? deal.summa;
  const yangiHolat: ZakazHolat = params.holat ?? (deal.holat as ZakazHolat);

  /*
   * TO'LOV QATORLARI — SNAPSHOT TEGILMAYDI, AGAR SO'RALMAGAN BO'LSA.
   *
   * ═══ NEGA BU MUHIM ═══
   * Direktorning eng ko'p uchraydigan tuzatishi — FAQAT NARX (750 000
   * o'rniga 75 000 yozilgan). Bunday so'rovda `tolovlar` UMUMAN
   * yuborilmaydi va mavjud qatorlar (naqd 200 000 + Click 300 000)
   * o'zgarishsiz qolishi shart: qoldiq 750 000 − 500 000 = 250 000
   * bo'lishi kerak. Agar qatorlar jimgina qayta yozilsa (yoki tushib
   * qolsa) Click puli yo'qolib, qarz 550 000 bo'lib ketardi — CRM,
   * Kirim va Qarzdorlik uch xil raqam ko'rsatardi.
   *
   * Shuning uchun `tegilmaydi` bayrog'i: qatorlar FAQAT chaqiruvchi
   * ularni ATAYLAB berganda o'chirib qayta yoziladi. Aks holda
   * `tolovSatrlariniYoz` umuman chaqirilmaydi — jismoniy `deleteMany`
   * ham bo'lmaydi (`DealTolov` da `deletedAt` yo'q, ya'ni o'chirish
   * qaytarib bo'lmaydigan amal).
   */
  const mavjudSatrlar = await prisma.dealTolov.findMany({
    where: { businessId: params.businessId, dealId: deal.id },
    orderBy: { createdAt: "asc" },
    select: { kanal: true, summa: true },
  });
  const eskiSatrlar: TolovSatri[] = mavjudSatrlar.map((s) => ({
    kanal: s.kanal,
    summa: s.summa,
  }));
  const satrlarBerildi = params.tolovlar !== undefined;
  const yangiSatrlar: TolovSatri[] = satrlarBerildi ? params.tolovlar! : eskiSatrlar;
  /**
   * Qatorlar HAQIQATDA o'zgardimi. Berilgan ro'yxat mavjudining aynan
   * o'zi bo'lsa ham tegilmaydi: bir xil qatorni o'chirib qayta yozish
   * tarixni sababsiz uzadi (yangi `id`, yangi `createdAt`).
   */
  const satrlarOzgardi = satrlarBerildi && !satrlarTeng(eskiSatrlar, yangiSatrlar);

  tolovlarniTekshir(yangiSumma, yangiSatrlar);

  // `tolangan` HAR DOIM qatorlardan hisoblanadi; qatorsiz zakazda esa
  // eski `tolangan` saqlanadi (bir kanalli eski yo'l buzilmasin).
  const yangiTolangan =
    yangiSatrlar.length > 0
      ? tolovlarJami(yangiSatrlar)
      : satrlarBerildi
        ? 0
        : Math.min(deal.tolangan, yangiSumma);
  if (yangiTolangan > yangiSumma) {
    throw new BadRequestError("To'langan summa zakaz narxidan ko'p bo'lmasligi kerak");
  }
  const tolovTuriTanlov =
    params.tolovTuri !== undefined
      ? params.tolovTuri
      : // Qatorsiz zakazda eski belgi saqlanadi ("qarz" tanlovi yo'qolmasin).
        yangiSatrlar.length === 0
        ? deal.tolovTuri
        : null;
  const yangiTolovTuri = tolovTuriBelgisi(yangiSatrlar, tolovTuriTanlov);

  const bosqichlar = await pipelineBosqichlari(params.businessId);
  const moliyaYozilgan = Boolean(deal.transactionId || deal.debtId);

  const natija = await runBusinessTx(params.businessId, async (tx) => {
    // Tranzaksiya ichida xom `tx` — HAR so'rovga `businessId` sharti QO'LDA.

    // 1. MOLIYANI QAYTARISH (yozilgan bo'lsa). `yangiHolat: null` — holat
    //    bu qadamda tegilmaydi, uni pastdagi qadam belgilaydi.
    const qaytarilgan = moliyaYozilgan
      ? await zakazMoliyasiniQaytarTx(tx, {
          businessId: params.businessId,
          dealId: deal.id,
          userId: params.userId,
          yangiHolat: null,
          stageId: bosqichlar[yangiHolat],
          faoliyatMatni:
            `Direktor tuzatishi: eski moliya qaytarildi ` +
            `(narx ${deal.summa} → ${yangiSumma} so'm, to'langan ${deal.tolangan} → ${yangiTolangan} so'm)`,
        })
      : { kirimlar: [], kirimSumma: 0, bekorQilinganQarzId: null };

    // 2. YANGI RAQAMLAR. Qatorlar va yig'indi AYNI tranzaksiyada — doska
    //    bir raqamni, qatorlar boshqasini ko'rsatmasin. Qatorlar o'zgarmagan
    //    bo'lsa ULARGA TEGILMAYDI (yuqoridagi `satrlarOzgardi` izohi).
    if (satrlarOzgardi) {
      await tolovSatrlariniYoz(tx, params.businessId, deal.id, yangiSatrlar);
    }
    const yangilash = await tx.deal.updateMany({
      where: { id: deal.id, businessId: params.businessId, deletedAt: null },
      data: {
        summa: yangiSumma,
        tolangan: yangiTolangan,
        tolovTuri: yangiTolovTuri,
        ...(params.categoryId !== undefined ? { categoryId: params.categoryId } : {}),
      },
    });
    if (yangilash.count !== 1) throw new BadRequestError("Zakaz o'zgarib ketdi — sahifani yangilang");

    // 3. MOLIYANI QAYTA YOZISH yoki holatni o'zgartirish.
    let yakun: YakunlashTxNatija | null = null;
    if (yangiHolat === "YUTILDI") {
      yakun = await zakazniYakunlashTx(tx, {
        businessId: params.businessId,
        dealId: deal.id,
        userId: params.userId,
        yutildiStageId: bosqichlar.YUTILDI,
        sarlavha: "Direktor tuzatishidan keyin moliya qayta yozildi",
      });
    } else {
      const endi = new Date();
      await tx.deal.updateMany({
        where: { id: deal.id, businessId: params.businessId, deletedAt: null },
        data: {
          holat: yangiHolat,
          stageId: bosqichlar[yangiHolat],
          yopilganAt: yopiqHolat(yangiHolat) ? endi : null,
          holatAt: endi,
          yoqotishSababi:
            yangiHolat === "YOQOTILDI" ? params.yoqotishSababi?.trim() || null : null,
        },
      });
      await tx.activity.create({
        data: {
          businessId: params.businessId,
          dealId: deal.id,
          contactId: deal.contactId,
          turi: "tizim",
          matn:
            `Direktor tuzatishi: holat ${yangiHolat}, narx ${yangiSumma} so'm, ` +
            `to'langan ${yangiTolangan} so'm (moliyaviy yozuv yo'q)`,
          userId: params.userId,
        },
      });
    }

    return { qaytarilgan, yakun };
  });

  // KUNLIK hisobot sinxroni tranzaksiyadan TASHQARIDA (ikkalasi ham o'z
  // `runBusinessTx` ini ochadi — ichkarida chaqirilsa deadlock bo'lardi).
  await kunlikOchirilganlarniSinxron(params.businessId, natija.qaytarilgan.kirimlar);
  await kunlikSinxronBarchasi(params.userId, natija.yakun?.yangiKirimlar ?? []);

  await logAudit({
    businessId: params.businessId,
    action: "update",
    entity: "deal",
    entityId: deal.id,
    before: {
      holat: deal.holat,
      summa: deal.summa,
      tolangan: deal.tolangan,
      tolovTuri: deal.tolovTuri,
      transactionId: deal.transactionId,
      debtId: deal.debtId,
      // TO'LOV KESIMINING ESKI SNAPSHOTI. `DealTolov` da `deletedAt` yo'q,
      // shuning uchun qatorlar ATAYLAB almashtirilganda eski kesim shu
      // yerda — jurnaldan tiklab olish mumkin bo'lsin.
      tolovlar: eskiSatrlar,
    },
    after: {
      amal: "direktor-tahriri",
      holat: yangiHolat,
      summa: yangiSumma,
      tolangan: yangiTolangan,
      tolovTuri: yangiTolovTuri,
      kirimSumma: natija.yakun?.kirimSumma ?? 0,
      qarzSumma: natija.yakun?.qarzSumma ?? 0,
      transactionId: natija.yakun?.transactionId ?? null,
      debtId: natija.yakun?.debtId ?? null,
      tolovlar: yangiSatrlar,
      satrlarOzgardi,
      // Kirimlar YUMSHOQ o'chirildi (`deletedAt` + `deletedBy`): ledger
      // append-only qoladi va yozuvlar savatdan tiklanadi.
      ochirilganKirimlar: natija.qaytarilgan.kirimlar.map((k) => k.id),
      bekorQilinganQarzId: natija.qaytarilgan.bekorQilinganQarzId,
    },
  });

  return {
    dealId: deal.id,
    holat: yangiHolat,
    summa: yangiSumma,
    tolangan: yangiTolangan,
    tolovTuri: yangiTolovTuri,
    kirimSumma: natija.yakun?.kirimSumma ?? 0,
    qarzSumma: natija.yakun?.qarzSumma ?? 0,
    transactionId: natija.yakun?.transactionId ?? null,
    debtId: natija.yakun?.debtId ?? null,
    ochirilganKirimlar: natija.qaytarilgan.kirimlar.map((k) => k.id),
    bekorQilinganQarzId: natija.qaytarilgan.bekorQilinganQarzId,
  };
}
