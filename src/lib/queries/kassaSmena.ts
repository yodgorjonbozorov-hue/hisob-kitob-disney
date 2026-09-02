import { prisma } from "@/lib/prisma";
import { QARZ_EMAS } from "@/lib/qarzFiltr";
import { toshkentKunBoshi } from "@/lib/kassaDavr";

/**
 * KASSA SMENASI — "KASSANI TOPSHIRISH" RESET NUQTASI.
 *
 * ═══ MUAMMO ═══
 * Kassa kartasidagi "bugungi kirim / chiqim / sof" Toshkent kun boshidan
 * hisoblanardi. Xodim soat 18:00 da kassani topshirsa ham kartada kun
 * boshidan beri yig'ilgan 1 500 000 turaverardi — topshirilgan pul yangi
 * smenaga "qo'shilib" ko'rinardi.
 *
 * ═══ QOIDA ═══
 * Har kassaning JORIY SMENASI shu kassadan qilingan OXIRGI topshirishdan
 * (`AccountTransfer.turi = "smena"`) boshlanadi. Topshirish yaratilgan zahoti
 * (hali qabul qilinmagan, `holat = "kutilmoqda"` bo'lsa ham) yangi smena
 * 0 dan boshlanadi — xodim uchun kassa "yopildi". Rad etilgan (`rad`) yoki
 * storno qilingan (`bekor`) topshirish reset nuqtasi EMAS: pul qaytdi,
 * demak smena yopilmagan.
 *
 * Hech qachon topshirilmagan kassa (bank, terminal, umumiy seyf) uchun
 * smena Toshkent kun boshidan — avvalgi "bugungi" xatti-harakat saqlanadi.
 * Kechagi topshirish ATAYLAB kun boshi bilan almashtirilmaydi (smena
 * moduli bilan bir xil qoida, `services/smena.ts`): kecha 18:00 dan keyin
 * tushgan pul hali kassada yotibdi va u joriy smenaga tegishli.
 *
 * ═══ NIMA O'ZGARMAYDI ═══
 * Kassa QOLDIG'I (ledger) bu yerda hisoblanmaydi va topshirish uni
 * "nolga tushirmaydi" — pul haqiqatda ko'chganda (qabul qilinganda) kamayadi.
 * Tarix o'chirilmaydi: reset faqat KESIM chegarasi, yozuvlar joyida qoladi.
 * Biznesning kunlik kirim/chiqimi (dashboard) ham o'zgarmaydi — u
 * tranzaksiyalardan, kassa harakati esa unga kirmaydi.
 */

/** Reset nuqtasi sifatida hisoblanadigan topshirish holatlari. */
export const SMENA_BOSHI_HOLATLARI = ["kutilmoqda", "bajarildi"] as const;

export interface SmenaBoshi {
  /** Joriy smena boshlangan payt (UTC instant). */
  boshi: Date;
  /** `true` — oxirgi topshirishdan; `false` — hech qachon topshirilmagan, kun boshidan. */
  topshirishdan: boolean;
}

/**
 * Berilgan kassalarning joriy smena boshi — BITTA `groupBy`.
 * Kassalar soni qancha bo'lsa ham so'rov bitta.
 */
export async function getSmenaBoshlari(
  businessId: string,
  accountIds: string[],
  now: Date = new Date()
): Promise<Map<string, SmenaBoshi>> {
  const kunBoshi = toshkentKunBoshi(now);
  const natija = new Map<string, SmenaBoshi>();
  if (accountIds.length === 0) return natija;

  const oxirgilar = await prisma.accountTransfer.groupBy({
    by: ["fromAccountId"],
    where: {
      businessId,
      fromAccountId: { in: accountIds },
      turi: "smena",
      holat: { in: [...SMENA_BOSHI_HOLATLARI] },
    },
    _max: { createdAt: true },
  });
  const oxirgi = new Map(oxirgilar.map((r) => [r.fromAccountId, r._max.createdAt]));

  for (const id of accountIds) {
    const t = oxirgi.get(id);
    natija.set(id, t ? { boshi: t, topshirishdan: true } : { boshi: kunBoshi, topshirishdan: false });
  }
  return natija;
}

/** Bir kassaning joriy smena kesimi. */
export interface SmenaKesim {
  /** Smena ichidagi tranzaksiya kirimi (savdo, qarz to'lovi). */
  kirim: number;
  /** Smena ichidagi tranzaksiya chiqimi (xarajat). */
  chiqim: number;
  /** Smena ichida boshqa kassalardan KIRGAN o'tkazmalar (kirim emas). */
  kirgan: number;
  /** Smena ichida boshqa kassalarga CHIQQAN o'tkazmalar (chiqim emas). */
  chiqqan: number;
}

const BOSH_KESIM = (): SmenaKesim => ({ kirim: 0, chiqim: 0, kirgan: 0, chiqqan: 0 });

/**
 * HAR KASSANING JORIY SMENA KESIMI — har kassa O'Z reset nuqtasidan.
 *
 * Chegara kassaga qarab har xil, shuning uchun bitta `gte` bilan bo'lmaydi:
 * `OR` ichida har kassa uchun o'z `createdAt > boshi` sharti yoziladi va
 * baza o'zi guruhlaydi (kassalar soni kichik, so'rovlar soni 3 ta).
 *
 * `gt` (>) ATAYLAB: topshirish o'tkazmasining o'zi (`createdAt = boshi`)
 * yangi smenaning "chiqqan o'tkazmasi" sifatida sanalmasin.
 *
 * Qarzga yozilgan kirim pul emas — qoldiq hisobi bilan bir xil filtr.
 */
export async function getSmenaKesimlari(
  businessId: string,
  boshlari: Map<string, SmenaBoshi>
): Promise<Map<string, SmenaKesim>> {
  const natija = new Map<string, SmenaKesim>();
  if (boshlari.size === 0) return natija;
  const kassalar = [...boshlari.entries()];

  const [tranzaksiyalar, chiqqanlar, kirganlar] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["accountId", "turi"],
      where: {
        businessId,
        deletedAt: null,
        ...QARZ_EMAS,
        OR: kassalar.map(([accountId, s]) => ({ accountId, createdAt: { gt: s.boshi } })),
      },
      _sum: { summa: true },
    }),
    prisma.accountTransfer.groupBy({
      by: ["fromAccountId"],
      where: {
        businessId,
        holat: "bajarildi",
        OR: kassalar.map(([fromAccountId, s]) => ({ fromAccountId, createdAt: { gt: s.boshi } })),
      },
      _sum: { summa: true },
    }),
    prisma.accountTransfer.groupBy({
      by: ["toAccountId"],
      where: {
        businessId,
        holat: "bajarildi",
        OR: kassalar.map(([toAccountId, s]) => ({ toAccountId, createdAt: { gt: s.boshi } })),
      },
      _sum: { summa: true },
    }),
  ]);

  const olish = (id: string) => {
    const bor = natija.get(id) ?? BOSH_KESIM();
    natija.set(id, bor);
    return bor;
  };
  for (const r of tranzaksiyalar) {
    if (!r.accountId) continue;
    const k = olish(r.accountId);
    if (r.turi === "kirim") k.kirim += r._sum.summa ?? 0;
    else k.chiqim += r._sum.summa ?? 0;
  }
  for (const r of chiqqanlar) olish(r.fromAccountId).chiqqan += r._sum.summa ?? 0;
  for (const r of kirganlar) olish(r.toAccountId).kirgan += r._sum.summa ?? 0;

  for (const [id] of kassalar) if (!natija.has(id)) natija.set(id, BOSH_KESIM());
  return natija;
}

/** Bitta kassa uchun qulay o'rama: smena boshi + kesim. */
export async function getKassaSmenasi(
  businessId: string,
  accountId: string,
  now: Date = new Date()
): Promise<SmenaBoshi & SmenaKesim> {
  const boshlari = await getSmenaBoshlari(businessId, [accountId], now);
  const kesimlar = await getSmenaKesimlari(businessId, boshlari);
  return { ...boshlari.get(accountId)!, ...(kesimlar.get(accountId) ?? BOSH_KESIM()) };
}
