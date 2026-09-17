import { prisma } from "@/lib/prisma";
import { toshkentKunBoshi } from "@/lib/kassaDavr";
import { SMENA_BOSHI_HOLATLARI } from "@/lib/queries/kassaSmena";
import { ONLINE_KANALLAR, kanalNomi, TOLOV_KANALLARI } from "@/lib/crm/tolovlar";

/**
 * KASSA TOPSHIRISH — TO'LOV KANALI KESIMI.
 *
 * ═══ MUAMMO ═══
 * "Kassa topshirish" faqat NAQD pulni bilardi. CRM'da esa pul Click,
 * Payme va terminal bilan ham keladi; o'sha pul xodimning naqd kassasiga
 * TUSHMAYDI — u to'g'ridan-to'g'ri karta/hisob kassasiga boradi
 * (`lib/crm/yakunlash.ts`). Natijada xodim "bugun 200 000 naqd va
 * 300 000 Click oldim" deb aytolmasdi, direktor esa topshirish yozuvidan
 * buni ko'ra olmasdi.
 *
 * ═══ QOIDA: NAQD — PUL, ONLINE — HISOBOT ═══
 * Naqd summa ledgerdan (`getMeningKassam` → `mavjud`) va topshirilganda
 * HAQIQATDA ko'chadi. Online summalar esa CRM TO'LOVLARIDAN hisoblanadi
 * va pulni KO'CHIRMAYDI: o'sha pul allaqachon karta/hisob kassasida,
 * uni ikkinchi marta o'tkazish kassa qoldig'ini buzardi. Shuning uchun
 * online qism "topshirdim" belgisi — kim qancha online pul yig'ganini
 * direktor tasdiqlaydi.
 *
 * ═══ QO'LDA RAQAM YO'Q ═══
 * Online summa HAR DOIM server hisobidan chiqadi (`DealTolov` → o'sha
 * qatordan yozilgan `Transaction`). Ya'ni xodim "taxminan 300 000 Click
 * oldim" deb yozib qo'ya olmaydi — raqam yozuvlarning o'zidan.
 *
 * ═══ IKKI MARTA TOPSHIRILMASIN ═══
 * Har kanal uchun O'Z RESET NUQTASI bor: o'sha kanal bilan oxirgi marta
 * topshirilgan payt (`TopshirishKanali.createdAt`, rad etilmagan
 * topshirishlar bo'yicha — `SMENA_BOSHI_HOLATLARI`). Shundan OLDIN
 * yozilgan to'lovlar keyingi balansga QAYTA QO'SHILMAYDI. Hech qachon
 * topshirilmagan kanalda esa chegara Toshkent kun boshi — naqd kassa
 * smenasi bilan AYNI qoida (`lib/queries/kassaSmena.ts`).
 *
 * Kanal tanlanmay qoldirilsa uning reset nuqtasi surilmaydi: o'sha pul
 * keyingi topshirishda yana chiqadi (yo'qolib qolmaydi).
 *
 * ═══ YUQORI CHEGARA (`now`) NEGA BOR ═══
 * Kesim `boshi < createdAt <= now` oralig'ida hisoblanadi va topshirish
 * qatori AYNI `now` bilan yoziladi (`lib/services/kassaTransfer.ts`).
 * Shu sabab hisob o'qilgandan keyin tushgan to'lov bu topshirishga
 * KIRMAYDI, lekin keyingisida CHIQADI — oraliqda hech qanday pul
 * yo'qolmaydi va ikki marta ham sanalmaydi.
 */

/** Bitta kanalning topshirishga tayyor kesimi. */
export interface KanalKesimDTO {
  /** "naqd" | "click" | "payme" | "terminal" | "boshqa". */
  kanal: string;
  /** Ekrandagi nomi ("Naqd", "Click", "Payme"...). */
  nomi: string;
  /** Topshirishga tayyor summa (so'm). */
  summa: number;
  /**
   * Summa manbai: "kassa" — naqd ledger qoldig'i (xodim o'zgartira oladi,
   * kamomad bo'lishi mumkin); "crm" — CRM to'lovlaridan hisoblangan online
   * summa (o'zgartirilmaydi).
   */
  manba: "kassa" | "crm";
  /** Shu kanal bo'yicha joriy kesim qachondan boshlangan (ISO). */
  boshi: string;
}

/** Bir so'rovda o'qiladigan CRM to'lov qatorlari chegarasi. */
const SATR_LIMITI = 5000;

/**
 * ONLINE KANALLAR KESIMI — xodimning CRM to'lovlaridan, kanal bo'yicha.
 *
 * `sotuvchiId` bo'yicha kesiladi: CRM kirimi zakaz MAS'ULIGA yoziladi
 * (`lib/crm/yakunlash.ts`), ya'ni "bu pulni kim yig'di" savoliga aynan
 * shu ustun javob beradi (tugmani kim bosgani emas).
 */
export async function onlineKanalKesimi(
  businessId: string,
  userId: string,
  now: Date = new Date()
): Promise<KanalKesimDTO[]> {
  const kunBoshi = toshkentKunBoshi(now);

  // HAR KANALNING RESET NUQTASI — o'sha kanal bilan oxirgi topshirish.
  // `summa > 0`: tanlanmagan (nol) kanal reset nuqtasi EMAS.
  const oxirgilar = await prisma.topshirishKanali.findMany({
    where: {
      businessId,
      kanal: { in: [...ONLINE_KANALLAR] },
      summa: { gt: 0 },
      transfer: {
        turi: "smena",
        fromUserId: userId,
        holat: { in: [...SMENA_BOSHI_HOLATLARI] },
      },
    },
    select: { kanal: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    distinct: ["kanal"],
  });
  const boshi = new Map<string, Date>(
    ONLINE_KANALLAR.map((k) => [
      k,
      oxirgilar.find((o) => o.kanal === k)?.createdAt ?? kunBoshi,
    ])
  );
  // So'rov chegarasi — eng ERTA reset nuqtasi (kanallar soni kichik).
  const engErta = [...boshi.values()].reduce((a, b) => (a < b ? a : b), kunBoshi);

  // 1. ARALASH TO'LOV QATORLARI — kanal aniq. Summa TRANZAKSIYADAN olinadi:
  //    ledger haqiqat manbai, qator esa uni bog'laydi.
  const satrlar = await prisma.dealTolov.findMany({
    where: {
      businessId,
      kanal: { in: [...ONLINE_KANALLAR] },
      transaction: {
        is: { deletedAt: null, sotuvchiId: userId, createdAt: { gt: engErta, lte: now } },
      },
    },
    select: { kanal: true, transaction: { select: { summa: true, createdAt: true } } },
    take: SATR_LIMITI,
  });

  const jamlar = new Map<string, number>(ONLINE_KANALLAR.map((k) => [k, 0]));
  for (const s of satrlar) {
    const t = s.transaction;
    const chegara = boshi.get(s.kanal);
    if (!t || !chegara || t.createdAt <= chegara || t.createdAt > now) continue;
    jamlar.set(s.kanal, (jamlar.get(s.kanal) ?? 0) + t.summa);
  }

  // 2. ESKI (bir kanalli) ZAKAZLAR — to'lov qatori YO'Q, pul `tolovTuri`
  //    da. Ularda Click bilan Paymeni ajratib bo'lmaydi (moliya lug'ati
  //    ataylab uchta qiymatli), shuning uchun "click" kesimiga qo'shiladi:
  //    yig'indi to'g'ri bo'ladi va pul hisobotdan tushib qolmaydi.
  const clickBoshi = boshi.get("click") ?? kunBoshi;
  const eskilar = await prisma.transaction.aggregate({
    where: {
      businessId,
      turi: "kirim",
      deletedAt: null,
      sotuvchiId: userId,
      tolovTuri: "click",
      createdAt: { gt: clickBoshi, lte: now },
      // FAQAT CRM zakazidan yozilgan kirim va FAQAT qatorsiz yo'l
      // (qatorlilari yuqorida sanalgan — ikki marta qo'shilmasin).
      crmZakazTolovi: { is: null },
      crmBuyurtma: { isNot: null },
    },
    _sum: { summa: true },
  });
  jamlar.set("click", (jamlar.get("click") ?? 0) + (eskilar._sum.summa ?? 0));

  return ONLINE_KANALLAR.map((k) => ({
    kanal: k,
    nomi: kanalNomi(k),
    summa: jamlar.get(k) ?? 0,
    manba: "crm" as const,
    boshi: (boshi.get(k) ?? kunBoshi).toISOString(),
  }));
}

/**
 * TOPSHIRISH KESIMI — naqd + online, bitta ro'yxatda.
 *
 * Naqd summa CHAQIRUVCHIDAN keladi (`getMeningKassam` → `mavjud`): u
 * kassa ledgeridan hisoblanadi va band bo'lgan (tasdiq kutayotgan) qism
 * allaqachon ayrilgan. Bu yerda u qayta hisoblanmaydi — ikkinchi haqiqat
 * manbai bo'lmasin.
 */
export async function topshirishKesimi(
  businessId: string,
  userId: string,
  naqdMavjud: number,
  now: Date = new Date()
): Promise<KanalKesimDTO[]> {
  const online = await onlineKanalKesimi(businessId, userId, now);
  return [
    {
      kanal: "naqd",
      nomi: kanalNomi("naqd"),
      summa: Math.max(0, naqdMavjud),
      manba: "kassa" as const,
      boshi: toshkentKunBoshi(now).toISOString(),
    },
    ...online,
  ];
}

/** Kanal nomi tizimda mavjudmi (validatsiya uchun). */
export function topshirishKanalimi(kanal: string): boolean {
  return (TOLOV_KANALLARI as readonly string[]).includes(kanal);
}
