/**
 * DISNEY FLOWERS — MIJOZ DUBLIKATLARINI BIRLASHTIRISH.
 *
 * MUAMMO. Ayni bir odam bir necha `Contact` bo'lib qolgan: Mijozlar
 * sahifasidagi "yangi mijoz" yo'li (`services/mijoz.ts`) telefonni XOM
 * saqlar va dublikat tekshiruvini umuman qilmasdi, qarz oynasidagi yo'l
 * (`services/mijozAniqla.ts`) esa raqamni normal ko'rinishda qidirardi.
 * Ikkalasi bir-birini topmay, "+998 91 332 00 08" va "91 332 00 08" ikki
 * kartochkaga aylanardi — qarzdorlar ro'yxatida bitta odam ikki karta.
 *
 * Yozish yo'li TUZATILDI (dublikat endi yaratilmaydi). Bu skript esa
 * ALLAQACHON paydo bo'lgan dublikatlarni birlashtiradi.
 *
 * NIMA QILADI:
 *   1. FAQAT Disney Flowers biznesini topadi (0 ta yoki 1 tadan ko'p
 *      topilsa — XATO bilan to'xtaydi, taxmin qilmaydi).
 *   2. Aktiv kartochkalarni NORMALLASHGAN telefon bo'yicha guruhlaydi.
 *   3. Guruhda >1 kartochka bo'lsa — eng ESKI `createdAt` kanonik bo'ladi.
 *   4. Qolgan kartochkalarning BARCHA bog'lanishlarini kanonikka ko'chiradi:
 *      Debt, Sale, Deal, Activity, Contract, PosChek.
 *      (Vazifada to'rttasi sanalgan edi; sxemada `Contact` ga bog'langan
 *      relation OLTITA — qolgan ikkitasi ham ko'chiriladi, aks holda
 *      shartnoma va POS cheki yo'q kartochkaga osilib qolardi.)
 *   5. Dublikatdagi profil maydonlaridan kanonikda BO'SH bo'lganini
 *      to'ldiradi (telegram, manzil, masulShaxs, izoh, qarzLimit).
 *      Ikkalasida ham qiymat bor va ular FARQ qilsa — kanonik saqlanadi,
 *      farq hisobotda "ziddiyat" bo'lib chiqadi (jim ustidan yozilmaydi).
 *   6. Dublikatlarni YUMSHOQ o'chiradi (`deletedAt`) — qattiq o'chirish
 *      audit izini uzardi.
 *   7. Omon qolgan kartochkalarning telefonini yagona formatga keltiradi.
 *
 * NIMA QILMAYDI — ATAYLAB:
 *   · Debt, DebtPayment, Transaction, Sale summalariga TEGMAYDI;
 *   · qarzlarni bitta Debt ga QO'SHMAYDI — har qarz alohida tarix bo'lib
 *     qoladi, faqat kanonik `contactId` ga bog'lanadi;
 *   · boshqa Business ma'lumotlariga tegmaydi;
 *   · bir xil ismli, lekin BOSHQA telefonli kartochkalarni birlashtirmaydi
 *     (asosiy identifikator — telefon).
 *
 * INVARIANT. Biznesning JAMI OCHIQ QARZI bir so'mga ham o'zgarmasligi
 * shart. Tekshiruv tranzaksiya ICHIDA: farq chiqsa hammasi ORQAGA
 * QAYTARILADI.
 *
 * XAVFSIZLIK. Standart holatda FAQAT HISOBOT (DRY RUN). Yozish uchun
 * ataylab bayroq kerak:
 *
 *   npx ts-node -r tsconfig-paths/register scripts/disney-flowers-mijoz-dublikat-birlashtir.ts
 *   npx ts-node -r tsconfig-paths/register scripts/disney-flowers-mijoz-dublikat-birlashtir.ts --write
 *
 * Build zanjiriga ATAYLAB QO'SHILMAGAN: bu bir martalik, ko'rib chiqiladigan
 * amal. Qayta ishga tushirish xavfsiz — birlashtirilgan kartochka
 * `deletedAt` bilan chiqib ketgani uchun ikkinchi safar guruh topilmaydi.
 *
 * LOG MAXFIYLIGI. Repozitoriya OMMAVIY: mijoz ISMI chiqarilmaydi, telefon
 * esa niqoblanadi (`+998 91 *** ** 08`). Kartochkani ochish uchun `id`
 * yetarli.
 */
import "dotenv/config";
import type { Prisma } from "@prisma/client";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { formatSom } from "@/lib/format";
import { telNormalize } from "@/lib/tel";

/** Qidiriladigan biznes nomi — skript ATAYLAB faqat shu biznesga ishlaydi. */
const BIZNES_NOMI = "Disney Flowers";

/** Kanonikka ko'chiriladigan profil maydonlari (matnli). */
const MATN_MAYDONLARI = ["telegram", "manzil", "masulShaxs", "izoh"] as const;
type MatnMaydon = (typeof MATN_MAYDONLARI)[number];

interface Kartochka {
  id: string;
  ism: string;
  tel: string | null;
  telegram: string | null;
  manzil: string | null;
  masulShaxs: string | null;
  izoh: string | null;
  qarzLimit: number | null;
  createdAt: Date;
}

interface Sanoq {
  debt: number;
  sale: number;
  deal: number;
  activity: number;
  contract: number;
  posChek: number;
}

interface Guruh {
  /** Normallashgan telefon — guruh kaliti. */
  tel: string;
  kanonik: Kartochka;
  dublikatlar: Kartochka[];
  /** Dublikatlardan kanonikka ko'chadigan yozuvlar soni. */
  kochadi: Sanoq;
  /** Kanonikda bo'sh bo'lgani uchun to'ldiriladigan maydonlar. */
  toldiriladi: string[];
  /** Ikkala tomonda ham qiymat bor va ular farq qiladi — qo'lda hal qilinadi. */
  ziddiyatlar: string[];
}

function bosh(sanoq: Sanoq): boolean {
  return (
    sanoq.debt + sanoq.sale + sanoq.deal + sanoq.activity + sanoq.contract + sanoq.posChek === 0
  );
}

function qosh(a: Sanoq, b: Sanoq): Sanoq {
  return {
    debt: a.debt + b.debt,
    sale: a.sale + b.sale,
    deal: a.deal + b.deal,
    activity: a.activity + b.activity,
    contract: a.contract + b.contract,
    posChek: a.posChek + b.posChek,
  };
}

/** `+998913320008` → `+998 91 *** ** 08`. Ommaviy logga to'liq raqam tushmaydi. */
function telNiqob(tel: string): string {
  const d = tel.replace(/\D/g, "");
  if (d.length !== 12) return "***";
  return `+998 ${d.slice(3, 5)} *** ** ${d.slice(10, 12)}`;
}

// ---------------------------------------------------------------------------
// O'qish
// ---------------------------------------------------------------------------

/** Disney Flowers biznesini topadi. Aniqlik bo'lmasa — XATO (taxmin yo'q). */
async function biznesniTop(): Promise<{ id: string }> {
  const nomzodlar = await rawPrisma.business.findMany({
    where: { nomi: { contains: BIZNES_NOMI } },
    select: { id: true },
  });
  if (nomzodlar.length === 0) {
    throw new Error(
      `"${BIZNES_NOMI}" nomli biznes topilmadi — skript hech narsa qilmadi.`
    );
  }
  if (nomzodlar.length > 1) {
    throw new Error(
      `"${BIZNES_NOMI}" nomiga ${nomzodlar.length} ta biznes mos keldi ` +
        `(${nomzodlar.map((b) => b.id).join(", ")}). Qaysi biri ekani noaniq — to'xtatildi.`
    );
  }
  return nomzodlar[0];
}

/**
 * Biznesning JAMI OCHIQ QARZI (olinadigan, yopilmagan, o'chirilmagan).
 *
 * Kartochkaga bog'lanmagan qarzlar ham kiradi: birlashtirish ularga
 * tegmaydi, lekin jami o'zgarmaganini isbotlash uchun BUTUN biznes
 * bo'yicha o'lchanadi.
 */
async function jamiOchiqQarz(
  db: Prisma.TransactionClient,
  businessId: string
): Promise<number> {
  const agg = await db.debt.aggregate({
    where: { businessId, turi: "olinadigan", isYopilgan: false, deletedAt: null },
    _sum: { jamiSumma: true, tolangan: true },
  });
  return (agg._sum.jamiSumma ?? 0) - (agg._sum.tolangan ?? 0);
}

async function sanoqOl(businessId: string, contactId: string): Promise<Sanoq> {
  const [debt, sale, deal, activity, contract, posChek] = await Promise.all([
    rawPrisma.debt.count({ where: { businessId, contactId } }),
    rawPrisma.sale.count({ where: { businessId, contactId } }),
    rawPrisma.deal.count({ where: { businessId, contactId } }),
    rawPrisma.activity.count({ where: { businessId, contactId } }),
    rawPrisma.contract.count({ where: { businessId, contactId } }),
    rawPrisma.posChek.count({ where: { businessId, contactId } }),
  ]);
  return { debt, sale, deal, activity, contract, posChek };
}

/** Dublikat guruhlarini tuzadi (bazaga YOZMAYDI). */
async function guruhlarniTop(businessId: string): Promise<{
  guruhlar: Guruh[];
  telefonsiz: number;
  jamiKartochka: number;
}> {
  const kartochkalar: Kartochka[] = await rawPrisma.contact.findMany({
    where: { businessId, deletedAt: null },
    select: {
      id: true,
      ism: true,
      tel: true,
      telegram: true,
      manzil: true,
      masulShaxs: true,
      izoh: true,
      qarzLimit: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const boyichaTel = new Map<string, Kartochka[]>();
  let telefonsiz = 0;
  for (const k of kartochkalar) {
    const tel = telNormalize(k.tel);
    // Telefoni yo'q (yoki formatga tushmaydigan) kartochka — birlashtirish
    // KALITI yo'q. Taxmin qilinmaydi, tegilmaydi.
    if (!tel) {
      telefonsiz += 1;
      continue;
    }
    boyichaTel.set(tel, [...(boyichaTel.get(tel) ?? []), k]);
  }

  const guruhlar: Guruh[] = [];
  for (const [tel, royxat] of boyichaTel) {
    if (royxat.length < 2) continue;

    // Eng eski kartochka kanonik. `createdAt` teng bo'lsa `id` bo'yicha —
    // natija ishga tushirishdan ishga tushirishgacha bir xil bo'lishi kerak.
    const tartib = [...royxat].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)
    );
    const [kanonik, ...dublikatlar] = tartib;

    let kochadi: Sanoq = { debt: 0, sale: 0, deal: 0, activity: 0, contract: 0, posChek: 0 };
    for (const d of dublikatlar) {
      kochadi = qosh(kochadi, await sanoqOl(businessId, d.id));
    }

    const toldiriladi: string[] = [];
    const ziddiyatlar: string[] = [];
    for (const maydon of MATN_MAYDONLARI) {
      const kanonikQiymat = kanonik[maydon]?.trim() || null;
      const nomzod = dublikatlar.map((d) => d[maydon]?.trim() || null).find((v) => v !== null);
      if (!kanonikQiymat && nomzod) toldiriladi.push(maydon);
      else if (kanonikQiymat && dublikatlar.some((d) => (d[maydon]?.trim() || null) !== null &&
        (d[maydon]?.trim() || null) !== kanonikQiymat)) {
        ziddiyatlar.push(maydon);
      }
    }
    if (kanonik.qarzLimit === null && dublikatlar.some((d) => d.qarzLimit !== null)) {
      toldiriladi.push("qarzLimit");
    } else if (
      kanonik.qarzLimit !== null &&
      dublikatlar.some((d) => d.qarzLimit !== null && d.qarzLimit !== kanonik.qarzLimit)
    ) {
      ziddiyatlar.push("qarzLimit");
    }

    guruhlar.push({ tel, kanonik, dublikatlar, kochadi, toldiriladi, ziddiyatlar });
  }

  guruhlar.sort((a, b) => b.dublikatlar.length - a.dublikatlar.length || a.tel.localeCompare(b.tel));
  return { guruhlar, telefonsiz, jamiKartochka: kartochkalar.length };
}

// ---------------------------------------------------------------------------
// Yozish
// ---------------------------------------------------------------------------

/**
 * Barcha guruhlarni BITTA tranzaksiyada birlashtiradi.
 *
 * Jami ochiq qarz tranzaksiya ichida qayta o'lchanadi — bir so'mga farq
 * qilsa xato tashlanadi va butun birlashtirish orqaga qaytadi.
 */
async function birlashtir(businessId: string, guruhlar: Guruh[]): Promise<Sanoq> {
  return rawPrisma.$transaction(
    async (tx) => {
      const oldingiQarz = await jamiOchiqQarz(tx, businessId);
      let kochirildi: Sanoq = { debt: 0, sale: 0, deal: 0, activity: 0, contract: 0, posChek: 0 };
      const hozir = new Date();

      for (const g of guruhlar) {
        for (const d of g.dublikatlar) {
          // `businessId` sharti QO'LDA — xom klient tenant filtrini qo'ymaydi.
          const kalit = { businessId, contactId: d.id };
          const yangi = { contactId: g.kanonik.id };
          // Ketma-ket (parallel EMAS): tranzaksiya ichida bitta ulanish
          // ishlaydi va so'rovlar tartibi aniq bo'lgani ma'qul.
          const debt = await tx.debt.updateMany({ where: kalit, data: yangi });
          const sale = await tx.sale.updateMany({ where: kalit, data: yangi });
          const deal = await tx.deal.updateMany({ where: kalit, data: yangi });
          const activity = await tx.activity.updateMany({ where: kalit, data: yangi });
          const contract = await tx.contract.updateMany({ where: kalit, data: yangi });
          const posChek = await tx.posChek.updateMany({ where: kalit, data: yangi });
          kochirildi = qosh(kochirildi, {
            debt: debt.count,
            sale: sale.count,
            deal: deal.count,
            activity: activity.count,
            contract: contract.count,
            posChek: posChek.count,
          });

          // Dublikat — YUMSHOQ o'chiriladi (tarix va audit izi qoladi).
          await tx.contact.updateMany({
            where: { id: d.id, businessId, deletedAt: null },
            data: { deletedAt: hozir },
          });
        }

        // Kanonikda BO'SH maydonlarni dublikatdan to'ldiramiz. Kanonikda
        // qiymat bo'lsa ustidan YOZILMAYDI — ziddiyat hisobotga chiqadi.
        const toldirish: Record<string, string | number> = {};
        for (const maydon of MATN_MAYDONLARI) {
          if (!g.toldiriladi.includes(maydon)) continue;
          const qiymat = g.dublikatlar.map((d) => d[maydon as MatnMaydon]?.trim() || null).find((v) => v !== null);
          if (qiymat) toldirish[maydon] = qiymat;
        }
        if (g.toldiriladi.includes("qarzLimit")) {
          const limit = g.dublikatlar.map((d) => d.qarzLimit).find((v) => v !== null);
          if (limit !== null && limit !== undefined) toldirish.qarzLimit = limit;
        }

        // Kanonikning telefoni ham yagona formatga keltiriladi — aks holda
        // dublikat himoyasi (indeksli qidiruv) uni topmay qolardi.
        if (g.kanonik.tel !== g.tel) toldirish.tel = g.tel;

        if (Object.keys(toldirish).length > 0) {
          await tx.contact.updateMany({
            where: { id: g.kanonik.id, businessId, deletedAt: null },
            data: toldirish,
          });
        }
      }

      const keyingiQarz = await jamiOchiqQarz(tx, businessId);
      if (keyingiQarz !== oldingiQarz) {
        throw new Error(
          `INVARIANT BUZILDI: jami ochiq qarz ${oldingiQarz} → ${keyingiQarz}. ` +
            `Birlashtirish ORQAGA QAYTARILDI.`
        );
      }
      return kochirildi;
    },
    { maxWait: 10_000, timeout: 120_000 }
  );
}

/**
 * Birlashtirishda QATNASHMAGAN kartochkalarning telefon formatini tuzatadi.
 *
 * Nega kerak: dublikat himoyasi normal ko'rinishdagi raqamni indeks bo'yicha
 * qidiradi. Bazada xom ko'rinish qolib ketsa himoya har safar zaxira
 * qidiruvga tushardi va eski yozuv "boshqa odam" bo'lib ko'rinish xavfi
 * saqlanib qolardi.
 *
 * Bu FAQAT FORMAT — raqamning o'zi o'zgarmaydi va yozuvlar ko'chmaydi.
 */
async function telefonFormatiniTuzat(
  businessId: string,
  yoz: boolean,
  /** Quruq rejimda: birlashtirilsa yopiladigan kartochkalar sanoqqa kirmaydi. */
  tashqari: Set<string>
): Promise<number> {
  const kartochkalar = await rawPrisma.contact.findMany({
    where: { businessId, deletedAt: null, tel: { not: null } },
    select: { id: true, tel: true },
  });
  const tuzatiladi = kartochkalar
    .filter((k) => !tashqari.has(k.id))
    .map((k) => ({ id: k.id, normal: telNormalize(k.tel), xom: k.tel }))
    .filter((k) => k.normal !== null && k.normal !== k.xom);

  if (yoz) {
    for (const k of tuzatiladi) {
      await rawPrisma.contact.updateMany({
        where: { id: k.id, businessId },
        data: { tel: k.normal as string },
      });
    }
  }
  return tuzatiladi.length;
}

// ---------------------------------------------------------------------------
// Hisobot
// ---------------------------------------------------------------------------

function hisobotChiqar(params: {
  guruhlar: Guruh[];
  telefonsiz: number;
  jamiKartochka: number;
  kochadi: Sanoq;
  oldingiQarz: number;
  keyingiQarz: number;
  formatTuzatildi: number;
  yoz: boolean;
}): void {
  const { guruhlar, kochadi, oldingiQarz, keyingiQarz, yoz } = params;
  const birlashadi = guruhlar.reduce((a, g) => a + g.dublikatlar.length, 0);

  console.log("");
  console.log(yoz ? "YOZILDI" : "KO'RISH REJIMI (bazaga yozilmadi)");
  console.log(`  Aktiv kartochka          : ${params.jamiKartochka}`);
  console.log(`  Telefonsiz (tegilmadi)   : ${params.telefonsiz}`);
  console.log(`  Dublikat guruhlar        : ${guruhlar.length}`);
  console.log(`  Birlashtiriladigan karta : ${birlashadi}`);
  console.log(`  Ko'chadigan Debt         : ${kochadi.debt}`);
  console.log(`  Ko'chadigan Sale         : ${kochadi.sale}`);
  console.log(`  Ko'chadigan Deal         : ${kochadi.deal}`);
  console.log(`  Ko'chadigan Activity     : ${kochadi.activity}`);
  console.log(`  Ko'chadigan Contract     : ${kochadi.contract}`);
  console.log(`  Ko'chadigan PosChek      : ${kochadi.posChek}`);
  console.log(`  Telefon formati tuzatish : ${params.formatTuzatildi}`);
  console.log(`  Jami ochiq qarz (oldin)  : ${formatSom(oldingiQarz)} so'm`);
  console.log(`  Jami ochiq qarz (keyin)  : ${formatSom(keyingiQarz)} so'm`);
  console.log(
    oldingiQarz === keyingiQarz
      ? "  INVARIANT: jami qarz o'zgarmadi."
      : "  XATO: JAMI QARZ O'ZGARDI — tekshiring!"
  );

  if (guruhlar.length > 0) {
    console.log("");
    console.log("Guruhlar (ism ATAYLAB chiqarilmaydi — log ommaviy):");
    for (const g of guruhlar.slice(0, 50)) {
      const q = g.kochadi;
      console.log(
        `  ${telNiqob(g.tel)} — ${g.dublikatlar.length + 1} karta → kanonik ${g.kanonik.id}` +
          ` (Debt ${q.debt}, Sale ${q.sale}, Deal ${q.deal}, Activity ${q.activity},` +
          ` Contract ${q.contract}, PosChek ${q.posChek})`
      );
      for (const d of g.dublikatlar) console.log(`      dublikat ${d.id}`);
      if (g.toldiriladi.length > 0) {
        console.log(`      to'ldiriladi: ${g.toldiriladi.join(", ")}`);
      }
      if (g.ziddiyatlar.length > 0) {
        console.log(
          `      ZIDDIYAT (kanonik qiymat saqlanadi, qo'lda ko'ring): ${g.ziddiyatlar.join(", ")}`
        );
      }
      if (bosh(q)) console.log("      bog'langan yozuv yo'q — faqat kartochka yopiladi");
    }
    if (guruhlar.length > 50) console.log(`  ... yana ${guruhlar.length - 50} ta guruh`);
  }

  if (!yoz && (guruhlar.length > 0 || params.formatTuzatildi > 0)) {
    console.log("");
    console.log("Yozish uchun: qo'shimcha `--write` bayrog'i bilan qayta ishga tushiring.");
  }
}

// ---------------------------------------------------------------------------

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL yo'q — skript ishga tushmadi.");
  }
  // `--yoz` — repozitoriyadagi boshqa skriptlar bilan bir xil nom (alias).
  const yoz = process.argv.includes("--write") || process.argv.includes("--yoz");

  const biznes = await biznesniTop();
  console.log(`Biznes topildi: ${biznes.id} (nomi ATAYLAB chiqarilmaydi).`);

  const { guruhlar, telefonsiz, jamiKartochka } = await guruhlarniTop(biznes.id);
  const oldingiQarz = await jamiOchiqQarz(rawPrisma, biznes.id);
  const rejaKochadi = guruhlar.reduce(
    (a, g) => qosh(a, g.kochadi),
    { debt: 0, sale: 0, deal: 0, activity: 0, contract: 0, posChek: 0 } as Sanoq
  );

  let kochadi = rejaKochadi;
  if (yoz && guruhlar.length > 0) {
    kochadi = await birlashtir(biznes.id, guruhlar);
  }
  const dublikatIdlar = new Set(guruhlar.flatMap((g) => g.dublikatlar.map((d) => d.id)));
  const formatTuzatildi = await telefonFormatiniTuzat(biznes.id, yoz, dublikatIdlar);
  const keyingiQarz = await jamiOchiqQarz(rawPrisma, biznes.id);

  hisobotChiqar({
    guruhlar,
    telefonsiz,
    jamiKartochka,
    kochadi,
    oldingiQarz,
    keyingiQarz,
    formatTuzatildi,
    yoz,
  });

  if (oldingiQarz !== keyingiQarz) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => rawPrisma.$disconnect());
