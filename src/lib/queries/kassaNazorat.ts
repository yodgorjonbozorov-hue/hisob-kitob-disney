import { prisma } from "@/lib/prisma";
import {
  getAccountBalances,
  getKassaKunlik,
  listKutilayotganTransferlar,
  type AccountQoldiq,
  type TransferDTO,
} from "@/lib/queries/accounts";
import { getSmenaBoshlari, getSmenaKesimlari } from "@/lib/queries/kassaSmena";
import { toshkentKunBoshi } from "@/lib/kassaDavr";

/**
 * KASSALAR NAZORAT MARKAZI — sahifaning BITTA ma'lumot manbai.
 *
 * Sahifa oltita savolga javob berishi kerak va ularning hammasi shu yerdan
 * yig'iladi: jami qancha pul bor, u qaysi kassada, bugun qancha kirdi va
 * chiqdi, kim hali topshirmadi, topshirishda farq bormi.
 *
 * ═══ HUQUQ ═══
 * Bu so'rov BARCHA kassalarning qoldig'ini va biznesning jami pulini
 * qaytaradi — uni faqat "kassa.jami" huquqi bor foydalanuvchi uchun
 * chaqirish mumkin (sahifa va API buni mustaqil tekshiradi). Oddiy xodim
 * o'z kassasini `getKassaDetal` / `getMeningKassam` orqali ko'radi.
 *
 * ═══ HISOB QOIDALARI ═══
 *  - Qoldiq LEDGERDAN hisoblanadi (Transaction + AccountTransfer), bazada
 *    saqlanmaydi — ikkita haqiqat manbai bo'lmasin.
 *  - Kartadagi kirim/chiqim/sof — JORIY SMENA kesimi: shu kassadan oxirgi
 *    topshirishdan beri (topshirilmagan kassada — Toshkent kun boshidan).
 *    Topshirilgan zahoti kassa kartasi 0 dan boshlanadi, tarix esa qoladi
 *    (`lib/queries/kassaSmena.ts`).
 *  - Sarlavhadagi "bugungi kirim/chiqim/sof" — BIZNES kesimi, kun boshidan:
 *    topshirish biznesning kunlik savdosini o'zgartirmaydi.
 *  - O'tkazma kirim ham, chiqim ham emas, shuning uchun u bu raqamlarga
 *    QO'SHILMAYDI va alohida (`smenaKirgan`/`smenaChiqqan`) ko'rsatiladi.
 */

export interface KassaNazoratKarta extends AccountQoldiq {
  /** Joriy smena boshlangan payt (ISO). */
  smenaBoshi: string;
  /** `true` — smena oxirgi topshirishdan boshlanadi; `false` — kun boshidan. */
  smenaTopshirishdan: boolean;
  /** Joriy smenadagi tranzaksiya kirimi (savdo, qarz to'lovi). */
  smenaKirim: number;
  /** Joriy smenadagi tranzaksiya chiqimi (xarajat). */
  smenaChiqim: number;
  /** `smenaKirim − smenaChiqim`. */
  smenaSof: number;
  /** Joriy smenada boshqa kassalardan KIRGAN o'tkazmalar (kirim emas). */
  smenaKirgan: number;
  /** Joriy smenada boshqa kassalarga CHIQQAN o'tkazmalar (chiqim emas). */
  smenaChiqqan: number;
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
  /** BIZNESNING bugungi kirimi (Toshkent kun boshidan, barcha kassalar). */
  bugungiKirim: number;
  bugungiChiqim: number;
  bugungiSof: number;
  kutilayotganlar: TransferDTO[];
}

export async function getKassaNazorat(businessId: string): Promise<KassaNazorat> {
  const kunBoshi = toshkentKunBoshi();

  const [qoldiqlar, kunlik, kutilayotganlar, oxirgiTopshirishlar] = await Promise.all([
    getAccountBalances(businessId),
    getKassaKunlik(businessId, kunBoshi),
    listKutilayotganTransferlar(businessId),
    prisma.accountTransfer.groupBy({
      by: ["fromAccountId"],
      where: { businessId, turi: "smena", holat: "bajarildi" },
      _max: { createdAt: true },
    }),
  ]);

  // Smena kesimi: har kassa o'z reset nuqtasidan (topshirish yoki kun boshi).
  const boshlari = await getSmenaBoshlari(
    businessId,
    qoldiqlar.map((k) => k.id)
  );
  const kesimlar = await getSmenaKesimlari(businessId, boshlari);

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
    const smena = boshlari.get(k.id)!;
    const kesim = kesimlar.get(k.id) ?? { kirim: 0, chiqim: 0, kirgan: 0, chiqqan: 0 };
    const band = bandChiqim.get(k.id) ?? 0;
    return {
      ...k,
      smenaBoshi: smena.boshi.toISOString(),
      smenaTopshirishdan: smena.topshirishdan,
      smenaKirim: kesim.kirim,
      smenaChiqim: kesim.chiqim,
      smenaSof: kesim.kirim - kesim.chiqim,
      smenaKirgan: kesim.kirgan,
      smenaChiqqan: kesim.chiqqan,
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

  let bugungiKirim = 0;
  let bugungiChiqim = 0;
  for (const kesim of kunlik.values()) {
    bugungiKirim += kesim.kirim;
    bugungiChiqim += kesim.chiqim;
  }

  return {
    kartalar,
    jamiQoldiq: kartalar.reduce((a, k) => a + k.qoldiq, 0),
    turBoyicha: [...turlar.entries()]
      .filter(([, summa]) => summa !== 0)
      .map(([turi, summa]) => ({ turi, summa }))
      .sort((a, b) => b.summa - a.summa),
    bugungiKirim,
    bugungiChiqim,
    bugungiSof: bugungiKirim - bugungiChiqim,
    kutilayotganlar,
  };
}
