import { prisma } from "@/lib/prisma";
import {
  getAccountBalances,
  getKassaKunlik,
  getKassaKunlikTransfer,
  listKutilayotganTransferlar,
  type AccountQoldiq,
  type TransferDTO,
} from "@/lib/queries/accounts";
import { toshkentKunBoshi } from "@/lib/kassaDavr";

/**
 * KASSALAR NAZORAT MARKAZI — sahifaning BITTA ma'lumot manbai.
 *
 * Sahifa oltita savolga javob berishi kerak va ularning hammasi shu yerdan
 * yig'iladi: jami qancha pul bor, u qaysi kassada, bugun qancha kirdi va
 * chiqdi, kim hali topshirmadi, topshirishda farq bormi.
 *
 * ═══ HISOB QOIDALARI (o'zgarmadi) ═══
 *  - Qoldiq LEDGERDAN hisoblanadi (Transaction + AccountTransfer), bazada
 *    saqlanmaydi — ikkita haqiqat manbai bo'lmasin.
 *  - "Bugungi kirim/chiqim" — faqat TRANZAKSIYALAR (savdo va xarajat).
 *    O'tkazma kirim ham, chiqim ham emas, shuning uchun u bu raqamlarga
 *    QO'SHILMAYDI va alohida (`bugungiKirgan`/`bugungiChiqqan`) ko'rsatiladi.
 *  - Kun chegarasi Toshkent bo'yicha, `createdAt` ustunidan.
 */

export interface KassaNazoratKarta extends AccountQoldiq {
  /** Bugungi tranzaksiya kirimi (savdo, qarz to'lovi). */
  bugungiKirim: number;
  /** Bugungi tranzaksiya chiqimi (xarajat). */
  bugungiChiqim: number;
  /** `bugungiKirim − bugungiChiqim`. */
  bugungiSof: number;
  /** Bugun boshqa kassalardan KIRGAN o'tkazmalar (kirim emas). */
  bugungiKirgan: number;
  /** Bugun boshqa kassalarga CHIQQAN o'tkazmalar (chiqim emas). */
  bugungiChiqqan: number;
  /** Tasdiq kutayotgan chiqim — kassada turibdi, lekin band. */
  kutilayotganChiqim: number;
  /** Haqiqatda sarflash mumkin bo'lgan pul: `qoldiq − kutilayotganChiqim`. */
  mavjud: number;
  /** Shu kassadan oxirgi YAKUNLANGAN topshirish vaqti (ISO) yoki null. */
  oxirgiTopshirish: string | null;
  /** Shu kassa hozir topshirish qarorini kutmoqdami. */
  topshirishKutmoqda: boolean;
}

export interface KassaNazorat {
  kartalar: KassaNazoratKarta[];
  /** Barcha kassalar qoldig'i (dashboard'dagi "Jami kassa" bilan bir xil raqam). */
  jamiQoldiq: number;
  /** Joriy qoldiqning kassa turlari bo'yicha taqsimoti (naqd/plastik/bank). */
  turBoyicha: { turi: string; summa: number }[];
  bugungiKirim: number;
  bugungiChiqim: number;
  bugungiSof: number;
  kutilayotganlar: TransferDTO[];
}

export async function getKassaNazorat(businessId: string): Promise<KassaNazorat> {
  const kunBoshi = toshkentKunBoshi();

  const [qoldiqlar, kunlik, kunlikTransfer, kutilayotganlar, oxirgiTopshirishlar] =
    await Promise.all([
      getAccountBalances(businessId),
      getKassaKunlik(businessId, kunBoshi),
      getKassaKunlikTransfer(businessId, kunBoshi),
      listKutilayotganTransferlar(businessId),
      prisma.accountTransfer.groupBy({
        by: ["fromAccountId"],
        where: { businessId, turi: "smena", holat: "bajarildi" },
        _max: { createdAt: true },
      }),
    ]);

  const oxirgi = new Map(
    oxirgiTopshirishlar.map((r) => [r.fromAccountId, r._max.createdAt?.toISOString() ?? null])
  );

  // Kutilayotgan chiqimlar kassa bo'yicha: yuboruvchining qoldig'ida turibdi,
  // lekin qayta sarflab bo'lmaydi (lib/services/userKassa.ts bilan bir xil qoida).
  const bandChiqim = new Map<string, number>();
  const kutayotganKassa = new Set<string>();
  for (const t of kutilayotganlar) {
    bandChiqim.set(t.fromAccountId, (bandChiqim.get(t.fromAccountId) ?? 0) + t.summa);
    if (t.turi === "smena") kutayotganKassa.add(t.fromAccountId);
  }

  const kartalar: KassaNazoratKarta[] = qoldiqlar.map((k) => {
    const bugun = kunlik.get(k.id) ?? { kirim: 0, chiqim: 0 };
    const tr = kunlikTransfer.get(k.id) ?? { kirgan: 0, chiqqan: 0 };
    const band = bandChiqim.get(k.id) ?? 0;
    return {
      ...k,
      bugungiKirim: bugun.kirim,
      bugungiChiqim: bugun.chiqim,
      bugungiSof: bugun.kirim - bugun.chiqim,
      bugungiKirgan: tr.kirgan,
      bugungiChiqqan: tr.chiqqan,
      kutilayotganChiqim: band,
      mavjud: k.qoldiq - band,
      oxirgiTopshirish: oxirgi.get(k.id) ?? null,
      topshirishKutmoqda: kutayotganKassa.has(k.id),
    };
  });

  // Tur bo'yicha taqsimot: nol turgan turlar tushib qoladi — bo'sh qatorlar
  // sarlavhani uzaytirib, o'qishni qiyinlashtiradi.
  const turlar = new Map<string, number>();
  for (const k of kartalar) turlar.set(k.turi, (turlar.get(k.turi) ?? 0) + k.qoldiq);

  return {
    kartalar,
    jamiQoldiq: kartalar.reduce((a, k) => a + k.qoldiq, 0),
    turBoyicha: [...turlar.entries()]
      .filter(([, summa]) => summa !== 0)
      .map(([turi, summa]) => ({ turi, summa }))
      .sort((a, b) => b.summa - a.summa),
    bugungiKirim: kartalar.reduce((a, k) => a + k.bugungiKirim, 0),
    bugungiChiqim: kartalar.reduce((a, k) => a + k.bugungiChiqim, 0),
    bugungiSof: kartalar.reduce((a, k) => a + k.bugungiSof, 0),
    kutilayotganlar,
  };
}
