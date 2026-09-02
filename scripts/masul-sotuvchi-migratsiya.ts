/**
 * MAS'UL XODIM → SOTUVCHI BIRIKTIRUVI (bir martalik, ixtiyoriy ma'lumot
 * migratsiyasi).
 *
 * MUAMMO. Eski zakazlarda "Sotuvchi" faqat `Deal.masulId` (User) sifatida
 * turadi — `DealEmployee` (sotuvchi lavozimi) biriktiruvi yo'q. Yangi
 * sotuvchi statistikasi esa AYNAN biriktiruvdan hisoblanadi, shuning uchun
 * bunday zakazlar sotuvchi KPI'siga tushmaydi.
 *
 * NIMA QILADI. Har biznes uchun sotuvchi biriktiruvi YO'Q zakazlarni topadi
 * va FAQAT SEMANTIK JIHATDAN TO'G'RI holatda biriktiradi:
 *   mas'ul foydalanuvchiga bog'langan xodim (`Employee.userId = Deal.masulId`)
 *   shu biznesda "sotuvchi" turidagi lavozimning A'ZOSI bo'lsa.
 * Direktor "mas'ul" qilib qo'yilgan (lekin sotuvchi bo'lmagan) zakazlar
 * ATAYLAB tegilmaydi — aks holda direktor statistikasi yolg'on bo'lardi.
 *
 * NIMA QILMAYDI. `Deal.masulId` ga TEGMAYDI, hech narsani o'chirmaydi.
 * IDEMPOTENT: UNIQUE(dealId, categoryId, employeeId) va "sotuvchi biriktiruvi
 * bor" sharti — qayta ishga tushirilsa dublikat yaratmaydi.
 *
 * Standart rejim — QURUQ (dry-run): faqat nechta zakaz ko'chishini
 * ko'rsatadi. Qo'llash uchun: npm run masul:sotuvchi-migratsiya -- --qollash
 */
import "dotenv/config";
import { rawPrisma } from "@/lib/db/rawPrisma";

const QOLLASH = process.argv.includes("--qollash");

async function main() {
  const bizneslar = await rawPrisma.business.findMany({ select: { id: true, nomi: true } });
  let jami = 0;
  let tegilmadi = 0;

  for (const b of bizneslar) {
    const sotuvKategoriyalar = await rawPrisma.employeeCategory.findMany({
      where: { businessId: b.id, turi: "sotuvchi" },
      select: { id: true },
    });
    if (sotuvKategoriyalar.length === 0) continue;
    const sotuvIdlar = sotuvKategoriyalar.map((k) => k.id);

    // userId → { employeeId, categoryId } (sotuvchi lavozimi a'zolari, tizim hisobi bor).
    const azolar = await rawPrisma.employeeCategoryMember.findMany({
      where: { businessId: b.id, categoryId: { in: sotuvIdlar }, employee: { deletedAt: null, userId: { not: null } } },
      select: { categoryId: true, employee: { select: { id: true, userId: true } } },
    });
    const userXarita = new Map<string, { employeeId: string; categoryId: string }>();
    for (const a of azolar) {
      if (a.employee.userId && !userXarita.has(a.employee.userId)) {
        userXarita.set(a.employee.userId, { employeeId: a.employee.id, categoryId: a.categoryId });
      }
    }
    if (userXarita.size === 0) continue;

    const zakazlar = await rawPrisma.deal.findMany({
      where: {
        businessId: b.id,
        deletedAt: null,
        xodimlar: { none: { categoryId: { in: sotuvIdlar } } },
      },
      select: { id: true, masulId: true },
    });

    let bizJami = 0;
    for (const z of zakazlar) {
      const s = userXarita.get(z.masulId);
      if (!s) {
        tegilmadi += 1;
        continue;
      }
      bizJami += 1;
      if (QOLLASH) {
        await rawPrisma.dealEmployee.create({
          data: { businessId: b.id, dealId: z.id, categoryId: s.categoryId, employeeId: s.employeeId },
        });
      }
    }
    jami += bizJami;
    if (bizJami > 0) console.log(`${b.nomi}: ${bizJami} ta zakaz ${QOLLASH ? "biriktirildi" : "biriktiriladi"}`);
  }

  console.log(`Jami: ${jami} ta zakaz. Mas'uli sotuvchi bo'lmagani uchun tegilmagan: ${tegilmadi} ta.`);
  if (!QOLLASH) console.log("QURUQ rejim — hech narsa yozilmadi. Qo'llash: --qollash");
}

main()
  .then(() => rawPrisma.$disconnect())
  .catch(async (e) => {
    console.error("XATO:", e);
    await rawPrisma.$disconnect();
    process.exit(1);
  });
