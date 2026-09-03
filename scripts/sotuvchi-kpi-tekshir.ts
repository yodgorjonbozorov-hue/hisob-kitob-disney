/**
 * SOTUVCHI KPI TEKSHIRUVI — FAQAT O'QISH (SELECT).
 *
 * Nega kerak: mas'ul→sotuvchi migratsiyasidan keyin eski zakazlar sotuvchi
 * kartochkasida KO'RINISHINI raqam bilan tasdiqlash. Bu skript hech narsa
 * yozmaydi va `getXodimlarJamoaKpi` bilan AYNI manbadan (DealEmployee +
 * Deal.holat) hisoblaydi — hisoblagich saqlanmaydi.
 *
 * OMMAVIY LOG: repozitoriya ochiq, shuning uchun ism niqoblanadi va PUL
 * SUMMASI CHIQARILMAYDI — faqat "bor/yo'q" va yozuvlar soni.
 *
 * Ishga tushirish: BUSINESS_ID=... node -r ts-node/register scripts/sotuvchi-kpi-tekshir.ts
 */
import "dotenv/config";
import { rawPrisma } from "@/lib/db/rawPrisma";

const BUSINESS_ID = process.env.BUSINESS_ID ?? "";
const OMMAVIY = Boolean(process.env.CI);

function niqob(s: string) {
  return OMMAVIY ? `${s.slice(0, 2)}…(${s.length})` : s;
}

async function main() {
  if (!BUSINESS_ID) throw new Error("BUSINESS_ID kerak");
  console.log("REJIM: FAQAT O'QISH (SELECT) — bazaga YOZILMAYDI");

  const biznes = await rawPrisma.business.findUnique({
    where: { id: BUSINESS_ID },
    select: { id: true, nomi: true },
  });
  if (!biznes) throw new Error(`Biznes topilmadi: ${BUSINESS_ID}`);
  console.log(`Biznes: ${biznes.id} (${niqob(biznes.nomi)})`);

  const lavozimlar = await rawPrisma.employeeCategory.findMany({
    where: { businessId: biznes.id, turi: "sotuvchi" },
    select: { id: true, nomi: true, aktiv: true },
  });
  console.log(`Sotuvchi lavozimlari: ${lavozimlar.length} — ${lavozimlar.map((l) => l.nomi).join(", ") || "yo'q"}`);
  const lavozimIdlar = lavozimlar.map((l) => l.id);
  if (lavozimIdlar.length === 0) {
    console.log("HOLAT: sotuvchi lavozimi yo'q — KPI bo'sh.");
    return;
  }

  // Lavozim a'zolari (KPI kartochkasi shulardan quriladi).
  const azolar = await rawPrisma.employeeCategoryMember.findMany({
    where: { businessId: biznes.id, categoryId: { in: lavozimIdlar }, employee: { deletedAt: null } },
    select: { categoryId: true, employee: { select: { id: true, ism: true, userId: true } } },
  });

  // Qatnashuvlar — `getXodimlarJamoaKpi` bilan ayni manba va ayni shartlar.
  const qatnashuvlar = await rawPrisma.dealEmployee.findMany({
    where: { businessId: biznes.id, categoryId: { in: lavozimIdlar }, deal: { deletedAt: null } },
    select: { employeeId: true, baho: true, deal: { select: { holat: true, summa: true } } },
  });

  console.log("");
  console.log("| EMPLOYEE                  | ISM        | LAVOZIM  | JAMI | YUTILGAN | YO'QOTILGAN | SUMMA | BAHO |");
  console.log("|---------------------------|------------|----------|------|----------|-------------|-------|------|");
  for (const a of azolar) {
    const meniki = qatnashuvlar.filter((q) => q.employeeId === a.employee.id);
    const yutilgan = meniki.filter((q) => q.deal.holat === "YUTILDI");
    const yoqotilgan = meniki.filter((q) => q.deal.holat === "YOQOTILDI").length;
    const summa = yutilgan.reduce((s, q) => s + q.deal.summa, 0);
    const bahoSoni = meniki.filter((q) => q.baho !== null).length;
    const lavozim = lavozimlar.find((l) => l.id === a.categoryId)?.nomi ?? "?";
    console.log(
      `| ${a.employee.id} | ${niqob(a.employee.ism).padEnd(10)} | ${lavozim.padEnd(8)} | ` +
        `${String(meniki.length).padEnd(4)} | ${String(yutilgan.length).padEnd(8)} | ${String(yoqotilgan).padEnd(11)} | ` +
        `${(summa > 0 ? "bor" : "yo'q").padEnd(5)} | ${String(bahoSoni).padEnd(4)} |`
    );
  }

  const sotuvchiliZakaz = await rawPrisma.deal.count({
    where: { businessId: biznes.id, deletedAt: null, xodimlar: { some: { categoryId: { in: lavozimIdlar } } } },
  });
  const jamiZakaz = await rawPrisma.deal.count({ where: { businessId: biznes.id, deletedAt: null } });

  console.log("");
  console.log(`Zakazlar: jami ${jamiZakaz} · sotuvchi biriktirilgan ${sotuvchiliZakaz} · sotuvchisiz ${jamiZakaz - sotuvchiliZakaz}`);
  console.log(`Qatnashuv yozuvlari (sotuvchi lavozimi): ${qatnashuvlar.length}`);
  console.log(
    qatnashuvlar.length === sotuvchiliZakaz
      ? "DUBLIKAT YO'Q: qatnashuv soni = sotuvchili zakaz soni (bir zakazga bitta sotuvchi)."
      : "DIQQAT: qatnashuv soni sotuvchili zakaz sonidan farq qiladi — tekshiring."
  );
  console.log("Kompaniya zakaz soni jamoa kattaligidan MUSTAQIL: yuqoridagi 'jami' Deal jadvalidan.");
  console.log("HOLAT: OK — faqat o'qildi.");
}

main()
  .then(() => rawPrisma.$disconnect())
  .catch(async (e) => {
    console.error("XATO:", e);
    await rawPrisma.$disconnect();
    process.exit(1);
  });
