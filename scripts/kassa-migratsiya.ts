/**
 * KASSA MIGRATSIYASI (Faza 4.1) — mavjud bizneslar uchun bir martalik skript.
 *
 * Nima qiladi:
 *   1. Kassasi yo'q har bir biznesga default "Naqd kassa" ochadi;
 *   2. `accountId` si bo'sh tranzaksiyalarni o'sha biznesning BIRINCHI faol
 *      kassasiga bog'laydi.
 *
 * Nega kerak: `Transaction.accountId` nullable qo'shildi (eski yozuvlar
 * buzilmasin uchun). Skriptsiz eski yozuvlar hech qaysi kassaga tegishli
 * bo'lmay qoladi va kassa qoldig'i haqiqiy pulni ko'rsatmaydi.
 *
 * IDEMPOTENT: qayta-qayta ishga tushirsa ham zarar qilmaydi.
 * Ishga tushirish: npm run kassa:migratsiya
 */
import "dotenv/config";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { DEFAULT_KASSA_NOMI } from "@/lib/services/accounts";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL yo'q — skript to'xtatildi.");
    process.exit(1);
  }

  const bizneslar = await rawPrisma.business.findMany({ select: { id: true, nomi: true } });
  console.log(`Bizneslar: ${bizneslar.length}`);

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

    const res = await rawPrisma.transaction.updateMany({
      where: { businessId: biz.id, accountId: null },
      data: { accountId: kassa.id },
    });
    if (res.count > 0) {
      boglangan += res.count;
      console.log(`  → ${biz.nomi}: ${res.count} ta yozuv "${kassa.nomi}" ga bog'landi`);
    }
  }

  const qolgan = await rawPrisma.transaction.count({ where: { accountId: null } });
  console.log(`\nYangi kassa: ${yaratilgan}`);
  console.log(`Bog'langan yozuv: ${boglangan}`);
  console.log(`Kassasiz qolgan yozuv: ${qolgan}${qolgan === 0 ? " ✅" : " ⚠️ tekshiring"}`);
}

main()
  .then(async () => {
    await rawPrisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("XATO:", e);
    await rawPrisma.$disconnect();
    process.exit(1);
  });
