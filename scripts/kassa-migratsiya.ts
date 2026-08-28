/**
 * KASSA MIGRATSIYASI (Faza 4.1) — har deployda ishlaydigan tuzatish skripti.
 *
 * Nima qiladi:
 *   1. Kassasi yo'q har bir biznesga default "Naqd kassa" ochadi;
 *   2. QARZ yozuvining kassa bog'lanishini UZADI: qarzga yozilgan kirim pul
 *      emas (pul kassaga tushmagan), u kassa qoldig'iga kirmasligi kerak.
 *      Skriptning eski versiyasi bunday yozuvlarni ham kassaga bog'lab
 *      yuborgan — dashborddagi "Kassada" raqami qarz savdolari hisobiga
 *      soxta shishardi. Bu qadam o'sha xatoni orqaga qaytaradi;
 *   3. BOSHQA BIZNES kassasiga ishora qilib qolgan yozuvlarni (eski
 *      bulk-move ko'chirishidan meros) yozuvning O'Z biznesidagi mos turdagi
 *      kassaga qayta bog'laydi — aks holda ko'chirilgan chiqim hech qaysi
 *      kassadan ayrilmaydi;
 *   4. `accountId` si bo'sh (qarz bo'lmagan) tranzaksiyalarni o'sha biznesning
 *      BIRINCHI faol kassasiga bog'laydi.
 *
 * IDEMPOTENT: qayta-qayta ishga tushirsa ham zarar qilmaydi.
 * Ishga tushirish: npm run kassa:migratsiya
 */
import "dotenv/config";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { DEFAULT_KASSA_NOMI } from "@/lib/services/accounts";

/** Qarz bo'lmagan yozuv sharti (lib/qarzFiltr.ts bilan bir xil ma'no). */
const QARZ_EMAS = { OR: [{ tolovTuri: null }, { tolovTuri: { not: "qarz" } }] };

/** Kassa turi mosligi — yozish qatlami (`resolveAccountId`) bilan bir xil. */
const TUR_OILASI: Record<string, string[]> = {
  naqd: ["naqd"],
  plastik: ["plastik", "bank"],
  bank: ["bank", "plastik"],
};

interface BegonaYozuv {
  id: string;
  businessId: string;
  turi: string;
}

/** Boshqa biznes kassasiga bog'lanib qolgan yozuvlar (id, o'z biznesi, eski kassa turi). */
async function begonaKassaliYozuvlar(): Promise<BegonaYozuv[]> {
  return rawPrisma.$queryRaw<BegonaYozuv[]>`
    SELECT t."id" AS "id", t."businessId" AS "businessId", a."turi" AS "turi"
    FROM "Transaction" t
    JOIN "Account" a ON a."id" = t."accountId"
    WHERE a."businessId" <> t."businessId"
  `;
}

async function main() {
  // Build vaqtida (env'siz lokal build) jimgina o'tkazib yuboriladi —
  // `db-migrate.mjs` bilan bir xil xatti-harakat. Aks holda `npm run build`
  // env'siz muhitda yiqilardi.
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL yo'q — kassa migratsiyasi o'tkazib yuborildi.");
    return;
  }

  const bizneslar = await rawPrisma.business.findMany({ select: { id: true, nomi: true } });
  console.log(`Bizneslar: ${bizneslar.length}`);

  // 2-QADAM: qarz yozuvi kassadan uziladi (o'chirilmaydi — faqat bog'lanish).
  const qarzUzildi = await rawPrisma.transaction.updateMany({
    where: { tolovTuri: "qarz", accountId: { not: null } },
    data: { accountId: null },
  });
  if (qarzUzildi.count > 0) {
    console.log(`Qarz yozuvi kassadan uzildi: ${qarzUzildi.count} ta`);
  }

  // 3-QADAM: begona biznes kassasiga ishora qilgan yozuvlar o'z biznesining
  // mos kassasiga o'tkaziladi. Kassa keshi — biznes bo'yicha bir marta olinadi.
  const begona = await begonaKassaliYozuvlar();
  if (begona.length > 0) {
    const kassaKesh = new Map<string, { id: string; turi: string }[]>();
    async function biznesKassalari(businessId: string) {
      const bor = kassaKesh.get(businessId);
      if (bor) return bor;
      const kassalar = await rawPrisma.account.findMany({
        where: { businessId, isActive: true },
        select: { id: true, turi: true },
        orderBy: [{ tartib: "asc" }, { createdAt: "asc" }],
      });
      kassaKesh.set(businessId, kassalar);
      return kassalar;
    }

    let kochirildi = 0;
    for (const y of begona) {
      const kassalar = await biznesKassalari(y.businessId);
      const oila = TUR_OILASI[y.turi] ?? [y.turi];
      const mos =
        oila.map((t) => kassalar.find((k) => k.turi === t)).find(Boolean) ?? kassalar[0] ?? null;
      await rawPrisma.transaction.update({
        where: { id: y.id },
        data: { accountId: mos?.id ?? null },
      });
      kochirildi++;
    }
    console.log(`Begona kassadan o'z kassasiga o'tkazildi: ${kochirildi} ta`);
  }

  let yaratilgan = 0;
  let boglangan = 0;

  for (const biz of bizneslar) {
    let kassa = await rawPrisma.account.findFirst({
      where: { businessId: biz.id, isActive: true },
      orderBy: [{ tartib: "asc" }, { createdAt: "asc" }],
      select: { id: true, nomi: true },
    });

    if (!kassa) {
      kassa = await rawPrisma.account.create({
        data: { businessId: biz.id, nomi: DEFAULT_KASSA_NOMI, turi: "naqd", tartib: 0 },
        select: { id: true, nomi: true },
      });
      yaratilgan++;
      console.log(`  + ${biz.nomi}: "${kassa.nomi}" ochildi`);
    }

    // 4-QADAM: kassasiz yozuvlar bog'lanadi. QARZ ATAYLAB CHETDA QOLADI —
    // u kassaga bog'lansa qoldiq pulga aylanmagan savdo hisobiga shishadi.
    const res = await rawPrisma.transaction.updateMany({
      where: { businessId: biz.id, accountId: null, AND: [QARZ_EMAS] },
      data: { accountId: kassa.id },
    });
    if (res.count > 0) {
      boglangan += res.count;
      console.log(`  → ${biz.nomi}: ${res.count} ta yozuv "${kassa.nomi}" ga bog'landi`);
    }
  }

  // Qarz yozuvi kassasiz bo'lishi NORMAL — ogohlantirish hisobiga kirmaydi.
  const qolgan = await rawPrisma.transaction.count({
    where: { accountId: null, AND: [QARZ_EMAS] },
  });
  console.log(`\nYangi kassa: ${yaratilgan}`);
  console.log(`Bog'langan yozuv: ${boglangan}`);
  console.log(`Kassasiz qolgan yozuv: ${qolgan}${qolgan === 0 ? " ✅" : " ⚠️ tekshiring"}`);
}

/**
 * Ulanishni yopish. `rawPrisma` — kech yaratiladigan Proxy, ya'ni unga
 * TEGISHNING O'ZI clientni quradi. `DATABASE_URL` yo'q bo'lsa (env'siz
 * build) bu `URL_INVALID` bilan yiqiladi — shuning uchun avval tekshiramiz.
 */
async function ulanishniYop() {
  if (!process.env.DATABASE_URL) return;
  await rawPrisma.$disconnect();
}

main()
  .then(async () => {
    await ulanishniYop();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("XATO:", e);
    await ulanishniYop();
    process.exit(1);
  });
