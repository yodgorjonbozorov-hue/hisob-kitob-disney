/**
 * LEGACY KUNLIK TUSHUM → HAQIQIY KIRIM YOZUVI MIGRATSIYASI.
 *
 * ═══ MUAMMO ═══
 * "Tushum kiritish" formasi ilgari FAQAT `DailyTransaction` yozardi —
 * `Transaction` yaratmasdi. Shu sababli kassir kiritgan tushum Kirim/Chiqim
 * ro'yxatida, Dashboard "Jami Kirim"da, kategoriya kesimida va oylik
 * hisobotda UMUMAN ko'rinmasdi. Yangi kod (lib/services/kunlik.ts →
 * `addKunlikTushum`) endi ikkalasini BITTA tranzaksiyada yozadi, lekin
 * o'zgarishgacha kiritilgan tushumlar `transactionId = null` bilan qolgan —
 * ular Kirim/Chiqimga hech qachon o'zi tushmaydi.
 *
 * Bu skript o'sha yetim tushumlarning har biriga bog'langan haqiqiy KIRIM
 * yozuvi (`Transaction`) yaratadi va `DailyTransaction.transactionId` ni
 * to'ldiradi.
 *
 * ═══ KASSA QOLDIG'IGA TA'SIRI: NOL (ataylab) ═══
 * Yaratiladigan yozuvlarda `accountId = null`. Legacy tushum pul sifatida
 * hech qachon ledgerga tushmagan — kassalar qoldig'i usiz hisoblangan va
 * kunlar shu raqamlar bilan yopilgan. Endi unga kassa biriktirsak, o'sha
 * pul BUGUNGI qoldiqqa qo'shilib, allaqachon topshirilgan kassani sun'iy
 * oshirib yuborardi (pul yaratish). Barcha qoldiq formulalari (`lib/queries/
 * accounts.ts`, `lib/services/kunlikKassa.ts`) faqat `accountId` bo'yicha
 * jamlaydi, shuning uchun kassasiz yozuv qoldiqqa mutlaqo ta'sir qilmaydi —
 * lekin ro'yxat, Jami Kirim va to'lov taqsimotida (aniq `tolovTuri` ustun)
 * to'liq ko'rinadi.
 *
 * ═══ KUNLIK HISOBOT O'ZGARMAYDI ═══
 * `DailyTransaction` qatorlarining summasi/holatiga tegilmaydi — faqat
 * `transactionId` to'ldiriladi. Hisobot jamlari (naqd/click/qarz) avvalgidek
 * qoladi, tasdiqlangan (CONFIRMED) kunlar ham buzilmaydi.
 *
 * ═══ IDEMPOTENT ═══
 * Faqat `transactionId = null` qatorlar olinadi; bog'lash `updateMany` +
 * `transactionId: null` sharti bilan — parallel ishga tushirilsa ham bitta
 * tushumga ikkita yozuv yaralmaydi (ortiqcha yozuv tranzaksiya ichida
 * orqaga qaytadi).
 *
 * ═══ BALANS INVARIANTI ═══
 * Har kassaning qoldig'i migratsiyadan oldin va keyin solishtiriladi —
 * bitta so'm ham farq chiqsa skript xato bilan tugaydi.
 *
 * Ishga tushirish:
 *   npm run kunlik:tushum-migratsiya -- --dry-run   (hech nima yozmaydi)
 *   npm run kunlik:tushum-migratsiya                (yozadi)
 */
import "dotenv/config";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { ANIQ_TOLOV_TESKARI, KUNLIK_ZAXIRA_KATEGORIYA } from "@/lib/services/kunlik";
import type { KunlikTolovTuri } from "@/lib/validation/kunlik";

export interface KunlikTushumMigratsiyaHisobot {
  topildi: number;
  boglandi: number;
  /** Qayta ishga tushirish bilan TUZALMAYDIGAN holatlar (foydalanuvchi
   *  o'chirilgan, noma'lum to'lov turi) — build to'xtatilmaydi, faqat
   *  ogohlantiriladi. Tushum kunlik hisobotda avvalgidek ko'rinadi. */
  otkazildi: number;
  xato: number;
  oldingiJami: number;
  keyingiJami: number;
  farq: number;
  ogohlantirishlar: string[];
}

/**
 * HAR KASSANING qoldig'i — ledgerdan (lib/queries/accounts.ts formulasi).
 * Kassa-kassa kesimida: jami tenglik yetarli emas, xato bir kassadan olib
 * boshqasiga qo'shsa jami o'zgarmay sverka sezmay qolardi.
 */
async function kassaQoldiqlari(businessId: string): Promise<Map<string, number>> {
  const [yozuvlar, transferlar] = await Promise.all([
    rawPrisma.transaction.groupBy({
      by: ["accountId", "turi"],
      where: { businessId, deletedAt: null },
      _sum: { summa: true },
    }),
    rawPrisma.accountTransfer.findMany({
      where: { businessId, holat: { in: ["bajarildi", "bekor"] } },
      select: { fromAccountId: true, toAccountId: true, summa: true },
    }),
  ]);

  const q = new Map<string, number>();
  const qosh = (id: string, d: number) => q.set(id, (q.get(id) ?? 0) + d);
  for (const y of yozuvlar) {
    if (!y.accountId) continue;
    qosh(y.accountId, (y.turi === "kirim" ? 1 : -1) * (y._sum.summa ?? 0));
  }
  for (const t of transferlar) {
    qosh(t.fromAccountId, -t.summa);
    qosh(t.toAccountId, t.summa);
  }
  return q;
}

function jamla(q: Map<string, number>): number {
  let s = 0;
  for (const v of q.values()) s += v;
  return s;
}

export async function migratsiyaBajar(opts: {
  dryRun: boolean;
}): Promise<KunlikTushumMigratsiyaHisobot> {
  const hisobot: KunlikTushumMigratsiyaHisobot = {
    topildi: 0,
    boglandi: 0,
    otkazildi: 0,
    xato: 0,
    oldingiJami: 0,
    keyingiJami: 0,
    farq: 0,
    ogohlantirishlar: [],
  };

  // Yetim tushumlar: yozuvsiz va o'chirilmagan. O'chirilganlar ko'chirilmaydi —
  // ular jamiga kirmaydi va Kirim/Chiqimda ham bo'lmasligi kerak.
  const yetimlar = await rawPrisma.dailyTransaction.findMany({
    where: { transactionId: null, deletedAt: null },
    include: { report: { select: { sana: true } } },
    orderBy: { createdAt: "asc" },
  });
  hisobot.topildi = yetimlar.length;

  const bizneslar = [...new Set(yetimlar.map((y) => y.businessId))];

  // ── 1. OLDINGI BALANS SURATI (kassa-kassa kesimida) ─────────────────────
  const oldingiKesim = new Map<string, Map<string, number>>();
  for (const businessId of bizneslar) {
    const kesim = await kassaQoldiqlari(businessId);
    oldingiKesim.set(businessId, kesim);
    hisobot.oldingiJami += jamla(kesim);
  }

  // ── 2. ZAXIRA KATEGORIYA (har biznes uchun bir marta) ───────────────────
  // Legacy tushumda kategoriya YO'Q — yangi kodning zaxira kategoriyasi
  // ishlatiladi (kunlik.ts: KUNLIK_ZAXIRA_KATEGORIYA). Upsert — parallel
  // ishga tushishda @@unique([nomi, turi, businessId]) race'ni bazada yopadi.
  const kategoriyalar = new Map<string, string>();
  if (!opts.dryRun) {
    for (const businessId of bizneslar) {
      const cat = await rawPrisma.category.upsert({
        where: {
          nomi_turi_businessId: { nomi: KUNLIK_ZAXIRA_KATEGORIYA, turi: "kirim", businessId },
        },
        update: {},
        create: { businessId, nomi: KUNLIK_ZAXIRA_KATEGORIYA, turi: "kirim" },
        select: { id: true },
      });
      kategoriyalar.set(businessId, cat.id);
    }
  }

  // ── 3. FOYDALANUVCHILAR ─────────────────────────────────────────────────
  // `Transaction.userId` — majburiy FK (Restrict). `DailyTransaction.userId`
  // esa FK'siz snapshot: foydalanuvchi butunlay o'chirilgan bo'lishi mumkin.
  // Bunday tushum o'tkazib yuboriladi (ogohlantirish bilan) — yolg'on
  // muallif yozib tarixni buzmaymiz.
  const userIds = [...new Set(yetimlar.map((y) => y.userId))];
  const borUserlar = new Set(
    (
      await rawPrisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true },
      })
    ).map((u) => u.id)
  );

  // ── 4. BOG'LASH ─────────────────────────────────────────────────────────
  for (const y of yetimlar) {
    const tolovTuri = ANIQ_TOLOV_TESKARI[y.tolovTuri as KunlikTolovTuri];
    if (!tolovTuri) {
      hisobot.otkazildi++;
      hisobot.ogohlantirishlar.push(`${y.id}: noma'lum to'lov turi "${y.tolovTuri}" — o'tkazildi`);
      continue;
    }
    if (!borUserlar.has(y.userId)) {
      hisobot.otkazildi++;
      hisobot.ogohlantirishlar.push(
        `${y.id}: kiritgan foydalanuvchi (${y.userIsm ?? y.userId}) bazada yo'q — o'tkazildi`
      );
      continue;
    }

    if (opts.dryRun) {
      hisobot.boglandi++;
      continue;
    }

    try {
      // Yozuv yaratish va bog'lash BITTA tranzaksiyada — yarmi bajarilib
      // qolsa (masalan, parallel jarayon allaqachon bog'lagan bo'lsa) yetim
      // `Transaction` qolmaydi.
      await rawPrisma.$transaction(async (tx) => {
        const yozuv = await tx.transaction.create({
          data: {
            turi: "kirim",
            businessId: y.businessId,
            categoryId: kategoriyalar.get(y.businessId)!,
            // ACCOUNTID ATAYLAB NULL — kassa qoldig'iga ta'sir qilmasin
            // (fayl boshidagi izoh). Qarzda esa bu umumiy qoida ham.
            accountId: null,
            tolovTuri,
            summa: y.summa,
            // Kunlik tushum HAR DOIM o'z hisobotining kuniga tegishli.
            sana: y.report.sana,
            izoh: y.izoh,
            userId: y.userId,
            // Yozuv ro'yxatda haqiqiy kiritilgan paytida tursin.
            createdAt: y.createdAt,
          },
          select: { id: true },
        });
        const n = await tx.dailyTransaction.updateMany({
          where: { id: y.id, businessId: y.businessId, transactionId: null },
          data: { transactionId: yozuv.id },
        });
        if (n.count !== 1) {
          throw new Error("tushum allaqachon bog'langan (parallel jarayon)");
        }
      });
      hisobot.boglandi++;
    } catch (e) {
      hisobot.xato++;
      hisobot.ogohlantirishlar.push(`${y.id}: ${(e as Error).message}`);
    }
  }

  // ── 5. KEYINGI BALANS VA SVERKA ─────────────────────────────────────────
  for (const businessId of bizneslar) {
    const kesim = await kassaQoldiqlari(businessId);
    hisobot.keyingiJami += jamla(kesim);
    const oldin = oldingiKesim.get(businessId) ?? new Map<string, number>();
    for (const accountId of new Set([...oldin.keys(), ...kesim.keys()])) {
      const a = oldin.get(accountId) ?? 0;
      const k = kesim.get(accountId) ?? 0;
      if (a !== k) {
        hisobot.xato++;
        hisobot.ogohlantirishlar.push(`KASSA FARQI: ${accountId} — oldin ${a}, keyin ${k}`);
      }
    }
  }
  hisobot.farq = hisobot.keyingiJami - hisobot.oldingiJami;

  return hisobot;
}

export function hisobotniChop(h: KunlikTushumMigratsiyaHisobot, dryRun: boolean): void {
  const s = (n: number) => n.toLocaleString("ru-RU");
  console.log("");
  console.log(`=== LEGACY KUNLIK TUSHUM MIGRATSIYASI${dryRun ? " (DRY-RUN)" : ""} ===`);
  console.log(`Yetim tushumlar topildi: ${h.topildi}`);
  console.log(`Kirim yozuviga bog'landi: ${h.boglandi}`);
  console.log(`O'tkazib yuborildi:      ${h.otkazildi}`);
  console.log(`Xato:                    ${h.xato}`);
  console.log(`Oldingi kassa jami:      ${s(h.oldingiJami)}`);
  console.log(`Keyingi kassa jami:      ${s(h.keyingiJami)}`);
  console.log(`Farq:                    ${s(h.farq)}`);
  if (h.ogohlantirishlar.length > 0) {
    console.log("");
    console.log("Ogohlantirishlar:");
    for (const o of h.ogohlantirishlar) console.log(`  ${o}`);
  }
  console.log("");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL yo'q — kunlik tushum migratsiyasi o'tkazib yuborildi.");
    return;
  }
  const dryRun = process.argv.includes("--dry-run");
  const hisobot = await migratsiyaBajar({ dryRun });
  hisobotniChop(hisobot, dryRun);

  if (hisobot.farq !== 0) {
    console.error("XATO: kassa balansi o'zgardi — migratsiya MUVAFFAQIYATSIZ.");
    process.exitCode = 1;
    return;
  }
  if (hisobot.xato > 0) {
    console.error("XATO: ba'zi tushumlar bog'lanmadi — yuqoridagi ro'yxatni ko'ring.");
    process.exitCode = 1;
  }
}

// Skript sifatida ishga tushirilgandagina bajariladi (testlar `migratsiyaBajar`ni
// to'g'ridan-to'g'ri chaqiradi). Env'siz `rawPrisma.$disconnect` chaqirilmaydi —
// klient DASTLABKI murojaatda quriladi va URL'siz yiqilardi.
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => (process.env.DATABASE_URL ? rawPrisma.$disconnect() : undefined));
}
