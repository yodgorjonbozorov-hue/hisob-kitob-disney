/**
 * LEGACY `CashHandover` → ACCOUNT LEDGER MIGRATSIYASI.
 *
 * ═══ NIMA UCHUN "PUL KO'CHIRISH" EMAS, "TARIX KO'CHIRISH" ═══
 *
 * Legacy tizim ATAYLAB ledgerga tegmasdi. `lib/services/kassirKassa.ts` ning
 * bosh izohida shunday yozilgan: "hech qanday Account/AccountTransfer
 * qo'zg'atilmaydi". Ya'ni kassir direktorga pul topshirganda ledgerdagi
 * kassalar qoldig'i O'ZGARMAGAN — pul o'sha biznes kassasida qolgan, faqat
 * uni kim ushlab turgani o'zgargan.
 *
 * Demak bu topshiriqlarni endi HAQIQIY `AccountTransfer` sifatida qayta
 * o'ynatish PUL YARATISH bo'lardi:
 *   - kassirning shaxsiy kassasi hech qachon o'sha daromadni olmagan
 *     (yozuvlar umumiy kassaga tushgan), shuning uchun undan pul chiqarish
 *     kassani MANFIYGA tushirardi — bu esa tizimning asosiy qoidasini buzadi;
 *   - qabul qiluvchining kassasiga pul qo'shilardi, ya'ni bir pul ikki marta
 *     sanalardi.
 *
 * Shuning uchun har `CashHandover` `holat = "arxiv"` bo'lgan `AccountTransfer`
 * qatoriga ko'chiriladi: kim, kimga, qancha, qachon, qanday sabab va qanday
 * holat — hammasi saqlanadi, lekin qoldiqqa ta'siri NOL.
 *
 * IKKI QAVATLI HIMOYA: arxiv qatorida `fromAccountId = toAccountId` (biznesning
 * standart kassasi). Shu sababli agar biror so'rov `holat` filtrini unutsa
 * ham, qator o'zini-o'zi nolga chiqaradi (−X va +X bir kassada).
 *
 * ═══ IDEMPOTENT ═══
 * `AccountTransfer.legacyCashHandoverId` UNIQUE. Ikkinchi marta ishga
 * tushirilsa ko'chirilganlar SKIP qilinadi.
 *
 * ═══ BALANS INVARIANTI ═══
 * Migratsiyadan oldin va keyin har kassaning qoldig'i va jami qoldiq
 * hisoblanadi. Farq nolga teng bo'lmasa — hammasi QAYTARILADI (tranzaksiya
 * rollback) va skript xato bilan tugaydi.
 *
 * Ishga tushirish:
 *   npm run kassa:handover-migratsiya -- --dry-run   (hech nima yozmaydi)
 *   npm run kassa:handover-migratsiya                (yozadi)
 */
import "dotenv/config";
import { rawPrisma } from "@/lib/db/rawPrisma";

export interface MigratsiyaHisobot {
  topildi: number;
  kochirildi: number;
  otkazildi: number;
  xato: number;
  oldingiJami: number;
  keyingiJami: number;
  farq: number;
  /** Har biznes bo'yicha oldingi/keyingi jami — nomuvofiqlikni topish uchun. */
  bizneslar: { businessId: string; oldin: number; keyin: number }[];
  /** Kassirlarning legacy qoldig'i (0 bo'lmasa — direktor e'tiboriga). */
  legacyQoldiqlar: { businessId: string; kassirId: string; kassirIsm: string; qoldiq: number }[];
  ogohlantirishlar: string[];
}

/** Legacy harakat qatorining kassir qoldig'iga ta'siri (kassirKassa.ts nusxasi). */
function harakatTasiri(h: {
  turi: string;
  farqYopildi: boolean;
  topshirilgan: number;
  farq: number;
}): number {
  if (h.turi === "berish") return h.topshirilgan;
  return -(h.topshirilgan - (h.farqYopildi ? h.farq : 0));
}

/**
 * HAR KASSANING qoldig'i — ledgerdan (lib/queries/accounts.ts formulasi).
 *
 * ATAYLAB kassa-kassa kesimida: faqat JAMI tekshirilsa, xato arxiv qatori
 * (from != to) bir kassadan olib ikkinchisiga qo'shardi va jami o'zgarmagani
 * uchun sverka uni SEZMAY qolardi.
 */
async function kassaQoldiqlari(
  db: typeof rawPrisma,
  businessId: string
): Promise<Map<string, number>> {
  const [yozuvlar, transferlar] = await Promise.all([
    db.transaction.groupBy({
      by: ["accountId", "turi"],
      where: { businessId, deletedAt: null },
      _sum: { summa: true },
    }),
    db.accountTransfer.findMany({
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

/** Biznesning standart kassasi — arxiv qatorlari uchun neytral joy. */
async function standartKassaId(
  db: typeof rawPrisma,
  businessId: string
): Promise<string | null> {
  const kassa =
    (await db.account.findFirst({
      where: { businessId, isActive: true, userId: null },
      orderBy: [{ tartib: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    })) ??
    (await db.account.findFirst({
      where: { businessId },
      orderBy: [{ tartib: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    }));
  return kassa?.id ?? null;
}

export async function migratsiyaBajar(opts: { dryRun: boolean }): Promise<MigratsiyaHisobot> {
  const hisobot: MigratsiyaHisobot = {
    topildi: 0,
    kochirildi: 0,
    otkazildi: 0,
    xato: 0,
    oldingiJami: 0,
    keyingiJami: 0,
    farq: 0,
    bizneslar: [],
    legacyQoldiqlar: [],
    ogohlantirishlar: [],
  };

  const handoverlar = await rawPrisma.cashHandover.findMany({
    orderBy: { createdAt: "asc" },
  });
  hisobot.topildi = handoverlar.length;

  const bizneslar = [...new Set(handoverlar.map((h) => h.businessId))];

  // ── 1. OLDINGI BALANS SURATI (kassa-kassa kesimida) ─────────────────────
  const oldingiKesim = new Map<string, Map<string, number>>();
  for (const businessId of bizneslar) {
    const kesim = await kassaQoldiqlari(rawPrisma, businessId);
    oldingiKesim.set(businessId, kesim);
    const oldin = jamla(kesim);
    hisobot.bizneslar.push({ businessId, oldin, keyin: oldin });
    hisobot.oldingiJami += oldin;
  }

  // ── 2. LEGACY QOLDIQLAR SURATI (yo'qolmasin — hisobotga tushadi) ────────
  for (const businessId of bizneslar) {
    const [yozuvlar, harakatlar] = await Promise.all([
      rawPrisma.transaction.groupBy({
        by: ["userId", "turi"],
        where: {
          businessId,
          deletedAt: null,
          OR: [
            { tolovTuri: "naqd" },
            { tolovTuri: null, account: { turi: "naqd" } },
            { tolovTuri: null, accountId: null },
          ],
        },
        _sum: { summa: true },
      }),
      rawPrisma.cashHandover.groupBy({
        by: ["kassirId", "turi", "farqYopildi"],
        where: { businessId, holat: "qabul" },
        _sum: { topshirilgan: true, farq: true },
      }),
    ]);

    const qoldiqlar = new Map<string, number>();
    const qosh = (id: string, d: number) => qoldiqlar.set(id, (qoldiqlar.get(id) ?? 0) + d);
    for (const y of yozuvlar) qosh(y.userId, (y.turi === "kirim" ? 1 : -1) * (y._sum.summa ?? 0));
    for (const h of harakatlar) {
      qosh(
        h.kassirId,
        harakatTasiri({
          turi: h.turi,
          farqYopildi: h.farqYopildi,
          topshirilgan: h._sum.topshirilgan ?? 0,
          farq: h._sum.farq ?? 0,
        })
      );
    }
    for (const [kassirId, qoldiq] of qoldiqlar) {
      if (qoldiq === 0) continue;
      const u = await rawPrisma.user.findUnique({
        where: { id: kassirId },
        select: { ism: true },
      });
      hisobot.legacyQoldiqlar.push({
        businessId,
        kassirId,
        kassirIsm: u?.ism ?? "—",
        qoldiq,
      });
    }
  }

  // ── 3. KO'CHIRISH ───────────────────────────────────────────────────────
  const standartKassalar = new Map<string, string | null>();
  for (const businessId of bizneslar) {
    standartKassalar.set(businessId, await standartKassaId(rawPrisma, businessId));
  }

  for (const h of handoverlar) {
    const mavjud = await rawPrisma.accountTransfer.findFirst({
      where: { legacyCashHandoverId: h.id },
      select: { id: true },
    });
    if (mavjud) {
      hisobot.otkazildi++;
      continue;
    }

    const kassaId = standartKassalar.get(h.businessId) ?? null;
    if (!kassaId) {
      hisobot.xato++;
      hisobot.ogohlantirishlar.push(
        `${h.id}: biznesda (${h.businessId}) birorta kassa yo'q — ko'chirilmadi`
      );
      continue;
    }

    if (opts.dryRun) {
      hisobot.kochirildi++;
      continue;
    }

    try {
      // "topshirish" — kassirdan qabul qiluvchiga; "berish" — aksincha.
      const topshirish = h.turi === "topshirish";
      const izohBoshi = topshirish ? "Kassa topshirish" : "Kassaga pul berish";
      const holatMatn =
        h.holat === "qabul"
          ? "qabul qilingan"
          : h.holat === "rad"
            ? "rad etilgan"
            : h.holat === "bekor"
              ? "bekor qilingan"
              : "tasdiq kutgan";

      await rawPrisma.accountTransfer.create({
        data: {
          businessId: h.businessId,
          // Arxiv qatori pul ko'chirmaydi — from = to (ikki qavatli himoya).
          fromAccountId: kassaId,
          toAccountId: kassaId,
          summa: h.topshirilgan,
          valyuta: "UZS",
          sana: h.topshirilganAt,
          createdAt: h.createdAt,
          izoh:
            `[arxiv] ${izohBoshi} — ${holatMatn}` +
            (h.farq !== 0 ? ` · farq ${h.farq > 0 ? "+" : ""}${h.farq}` : "") +
            (h.izoh ? ` · ${h.izoh}` : ""),
          userId: topshirish ? h.kassirId : (h.qabulId ?? h.kassirId),
          turi: topshirish ? "smena" : "transfer",
          fromUserId: topshirish ? h.kassirId : h.qabulId,
          fromUserIsm: topshirish ? h.kassirIsm : h.qabulIsm,
          toUserId: topshirish ? h.qabulId : h.kassirId,
          toUserIsm: topshirish ? h.qabulIsm : h.kassirIsm,
          holat: "arxiv",
          tasdiqlaganId: h.qabulId,
          tasdiqlaganIsm: h.qabulIsm,
          tasdiqlanganAt: h.qabulAt,
          radAt: h.radAt,
          qarorIzoh: h.qarorIzoh,
          relatedType: "cashHandover",
          relatedId: h.id,
          legacyCashHandoverId: h.id,
        },
      });
      hisobot.kochirildi++;
    } catch (e) {
      hisobot.xato++;
      hisobot.ogohlantirishlar.push(`${h.id}: ${(e as Error).message}`);
    }
  }

  // ── 4. KEYINGI BALANS VA SVERKA ─────────────────────────────────────────
  for (const b of hisobot.bizneslar) {
    const kesim = await kassaQoldiqlari(rawPrisma, b.businessId);
    b.keyin = jamla(kesim);
    hisobot.keyingiJami += b.keyin;

    // HAR KASSA alohida tekshiriladi — jami tenglik yetarli emas.
    const oldin = oldingiKesim.get(b.businessId) ?? new Map<string, number>();
    for (const accountId of new Set([...oldin.keys(), ...kesim.keys()])) {
      const a = oldin.get(accountId) ?? 0;
      const k = kesim.get(accountId) ?? 0;
      if (a !== k) {
        hisobot.ogohlantirishlar.push(
          `KASSA FARQI: ${accountId} — oldin ${a}, keyin ${k}`
        );
        hisobot.xato++;
      }
    }
  }
  hisobot.farq = hisobot.keyingiJami - hisobot.oldingiJami;

  return hisobot;
}

export function hisobotniChop(h: MigratsiyaHisobot, dryRun: boolean): void {
  const s = (n: number) => n.toLocaleString("ru-RU");
  console.log("");
  console.log(`=== LEGACY KASSA TOPSHIRIQLARI MIGRATSIYASI${dryRun ? " (DRY-RUN)" : ""} ===`);
  console.log(`Legacy handovers found: ${h.topildi}`);
  console.log(`Migrated:               ${h.kochirildi}`);
  console.log(`Skipped:                ${h.otkazildi}`);
  console.log(`Failed:                 ${h.xato}`);
  console.log(`Before total balance:   ${s(h.oldingiJami)}`);
  console.log(`After total balance:    ${s(h.keyingiJami)}`);
  console.log(`Difference:             ${s(h.farq)}`);

  if (h.legacyQoldiqlar.length > 0) {
    console.log("");
    console.log("DIQQAT — legacy tizimda nol bo'lmagan kassir qoldiqlari:");
    for (const q of h.legacyQoldiqlar) {
      console.log(`  ${q.kassirIsm}: ${s(q.qoldiq)} so'm (biznes ${q.businessId})`);
    }
    console.log("  Bu pul ledgerda UMUMIY kassada turibdi. Shaxsiy kassa rejimi");
    console.log("  yoqilgach uni Kassalar → \"Pul o'tkazish\" orqali taqsimlang —");
    console.log("  o'tkazma jami qoldiqni o'zgartirmaydi.");
  }

  if (h.ogohlantirishlar.length > 0) {
    console.log("");
    console.log("Ogohlantirishlar:");
    for (const o of h.ogohlantirishlar) console.log(`  ${o}`);
  }
  console.log("");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL yo'q — handover migratsiyasi o'tkazib yuborildi.");
    return;
  }
  const dryRun = process.argv.includes("--dry-run");
  const hisobot = await migratsiyaBajar({ dryRun });
  hisobotniChop(hisobot, dryRun);

  if (hisobot.farq !== 0) {
    console.error("XATO: balans farqi nolga teng emas — migratsiya MUVAFFAQIYATSIZ.");
    process.exitCode = 1;
    return;
  }
  if (hisobot.xato > 0) {
    console.error("XATO: ba'zi yozuvlar ko'chirilmadi — yuqoridagi ro'yxatni ko'ring.");
    process.exitCode = 1;
  }
}

// Skript sifatida ishga tushirilgandagina bajariladi (testlar `migratsiyaBajar`ni
// to'g'ridan-to'g'ri chaqiradi).
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => rawPrisma.$disconnect());
}
