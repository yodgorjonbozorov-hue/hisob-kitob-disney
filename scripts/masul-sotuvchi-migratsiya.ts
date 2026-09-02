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
 * NIMA QILMAYDI. `Deal.masulId` ga TEGMAYDI, hech narsani o'chirmaydi,
 * hech qanday UPDATE/DELETE yo'q — faqat `DealEmployee` INSERT.
 * BOSHQA BIZNESGA TEGMAYDI: har so'rov `businessId` bilan cheklangan,
 * xodim xaritasi ham AYNI biznesning a'zolaridan quriladi.
 * IDEMPOTENT: UNIQUE(dealId, categoryId, employeeId) va "sotuvchi biriktiruvi
 * yo'q" sharti — qayta ishga tushirilsa dublikat yaratmaydi.
 *
 * Standart rejim — QURUQ (dry-run): faqat hisobot, bazaga YOZILMAYDI.
 * Qo'llash uchun: npm run masul:sotuvchi-migratsiya -- --qollash
 *
 * OMMAVIY LOG: `CI` muhitida (GitHub Actions — repo ommaviy) biznes nomi
 * o'rniga id boshlanishi chiqadi.
 */
import "dotenv/config";
import { rawPrisma } from "@/lib/db/rawPrisma";

const QOLLASH = process.argv.includes("--qollash");
const OMMAVIY = Boolean(process.env.CI);

interface BiznesHisobot {
  nom: string;
  jamiZakaz: number;
  sotuvchiliZakaz: number;
  tekshirilgan: number;
  migratsiya: number;
  skipSotuvchiLavozimYoq: number;
  skipMasulXodimEmas: number;
  skipMasulSotuvchiEmas: number;
  skipOchirilgan: number;
}

async function main() {
  console.log(QOLLASH ? "REJIM: QO'LLASH (bazaga yoziladi)" : "REJIM: QURUQ (dry-run) — bazaga YOZILMAYDI");

  const bizneslar = await rawPrisma.business.findMany({ select: { id: true, nomi: true } });
  const hisobotlar: BiznesHisobot[] = [];

  for (const b of bizneslar) {
    const h: BiznesHisobot = {
      nom: OMMAVIY ? `biznes-${b.id.slice(0, 6)}` : b.nomi,
      jamiZakaz: 0,
      sotuvchiliZakaz: 0,
      tekshirilgan: 0,
      migratsiya: 0,
      skipSotuvchiLavozimYoq: 0,
      skipMasulXodimEmas: 0,
      skipMasulSotuvchiEmas: 0,
      skipOchirilgan: 0,
    };
    hisobotlar.push(h);

    h.jamiZakaz = await rawPrisma.deal.count({ where: { businessId: b.id } });
    h.skipOchirilgan = await rawPrisma.deal.count({ where: { businessId: b.id, deletedAt: { not: null } } });

    const sotuvKategoriyalar = await rawPrisma.employeeCategory.findMany({
      where: { businessId: b.id, turi: "sotuvchi" },
      select: { id: true },
    });
    const sotuvIdlar = sotuvKategoriyalar.map((k) => k.id);

    if (sotuvIdlar.length === 0) {
      // Sotuvchi lavozimi sozlanmagan biznes — hech narsa qilinmaydi.
      h.skipSotuvchiLavozimYoq = h.jamiZakaz - h.skipOchirilgan;
      continue;
    }

    h.sotuvchiliZakaz = await rawPrisma.deal.count({
      where: { businessId: b.id, deletedAt: null, xodimlar: { some: { categoryId: { in: sotuvIdlar } } } },
    });

    // userId → { employeeId, categoryId } — FAQAT shu biznesning sotuvchi
    // lavozimi a'zolari, tizim hisobi bog'langanlar.
    const azolar = await rawPrisma.employeeCategoryMember.findMany({
      where: {
        businessId: b.id,
        categoryId: { in: sotuvIdlar },
        employee: { businessId: b.id, deletedAt: null, userId: { not: null } },
      },
      select: { categoryId: true, employee: { select: { id: true, userId: true } } },
    });
    const sotuvchiXarita = new Map<string, { employeeId: string; categoryId: string }>();
    for (const a of azolar) {
      if (a.employee.userId && !sotuvchiXarita.has(a.employee.userId)) {
        sotuvchiXarita.set(a.employee.userId, { employeeId: a.employee.id, categoryId: a.categoryId });
      }
    }
    // Mas'ul foydalanuvchiga xodim kartochkasi bog'langanmi (shu biznesda).
    const xodimliUserlar = new Set(
      (
        await rawPrisma.employee.findMany({
          where: { businessId: b.id, deletedAt: null, userId: { not: null } },
          select: { userId: true },
        })
      ).map((x) => x.userId!)
    );

    const zakazlar = await rawPrisma.deal.findMany({
      where: {
        businessId: b.id,
        deletedAt: null,
        xodimlar: { none: { categoryId: { in: sotuvIdlar } } },
      },
      select: { id: true, masulId: true },
    });
    h.tekshirilgan = zakazlar.length;

    for (const z of zakazlar) {
      const s = sotuvchiXarita.get(z.masulId);
      if (!s) {
        if (xodimliUserlar.has(z.masulId)) h.skipMasulSotuvchiEmas += 1;
        else h.skipMasulXodimEmas += 1;
        continue;
      }
      h.migratsiya += 1;
      if (QOLLASH) {
        await rawPrisma.dealEmployee.create({
          data: { businessId: b.id, dealId: z.id, categoryId: s.categoryId, employeeId: s.employeeId },
        });
      }
    }
  }

  const jam = (k: keyof Omit<BiznesHisobot, "nom">) => hisobotlar.reduce((s, h) => s + h[k], 0);

  console.log("");
  console.log("BIZNESLAR BO'YICHA:");
  for (const h of hisobotlar) {
    console.log(
      `  ${h.nom}: jami ${h.jamiZakaz} · sotuvchisi bor ${h.sotuvchiliZakaz} · tekshirildi ${h.tekshirilgan} · ` +
        `${QOLLASH ? "biriktirildi" : "biriktiriladi"} ${h.migratsiya} · skip: lavozim yo'q ${h.skipSotuvchiLavozimYoq}, ` +
        `mas'ul xodim emas ${h.skipMasulXodimEmas}, mas'ul sotuvchi emas ${h.skipMasulSotuvchiEmas}, o'chirilgan ${h.skipOchirilgan}`
    );
  }
  console.log("");
  console.log("JAMI:");
  console.log(`  Bizneslar: ${hisobotlar.length}`);
  console.log(`  Barcha zakazlar: ${jam("jamiZakaz")}`);
  console.log(`  Sotuvchi biriktiruvi allaqachon bor: ${jam("sotuvchiliZakaz")}`);
  console.log(`  Tekshirilgan (sotuvchisiz, o'chirilmagan): ${jam("tekshirilgan")}`);
  console.log(`  ${QOLLASH ? "BIRIKTIRILDI" : "MIGRATSIYA QILINADI"}: ${jam("migratsiya")}`);
  console.log(`  SKIP — biznesda sotuvchi lavozimi yo'q: ${jam("skipSotuvchiLavozimYoq")}`);
  console.log(`  SKIP — mas'ul foydalanuvchiga xodim kartochkasi bog'lanmagan: ${jam("skipMasulXodimEmas")}`);
  console.log(`  SKIP — mas'ul xodimi bor, lekin sotuvchi lavozimida emas (direktor va h.k.): ${jam("skipMasulSotuvchiEmas")}`);
  console.log(`  SKIP — o'chirilgan zakazlar: ${jam("skipOchirilgan")}`);
  console.log("  Dublikat: yo'q — UNIQUE(dealId, categoryId, employeeId) + faqat sotuvchisiz zakazlar.");
  console.log("  Boshqa biznes: tegilmaydi — har so'rov businessId bilan, xodim xaritasi shu biznesdan.");
  if (!QOLLASH) console.log("\nQURUQ rejim — hech narsa yozilmadi. Qo'llash: --qollash");
}

main()
  .then(() => rawPrisma.$disconnect())
  .catch(async (e) => {
    console.error("XATO:", e);
    await rawPrisma.$disconnect();
    process.exit(1);
  });
