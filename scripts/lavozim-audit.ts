/**
 * ZAKAZ JAMOASI LAVOZIMLARI — AUDIT VA SOZLASH.
 *
 * IKKI QISM:
 *   1) AUDIT (har doim, faqat o'qish) — tenant bo'ylab xodimlarning ESKI
 *      `Employee.lavozim` matnini o'qib, maqsad lavozimlarga nomzodlarni
 *      TAKLIF qiladi. Matn mosligi — TAKLIF, dalil emas: `aniq` (normallashgan
 *      matn teng) va `qisman` (ichida bor) alohida ko'rsatiladi. Hech kim
 *      avtomatik biriktirilmaydi.
 *   2) LAVOZIM YARATISH (faqat `--qollash`) — maqsad lavozimlarini
 *      `EmployeeCategory` da ochadi/yangilaydi. A'ZO BIRIKTIRMAYDI:
 *      a'zolik faqat egasi tasdiqlagan ro'yxat bilan, alohida qadamda.
 *
 * NIMA QILMAYDI: xodim biriktirmaydi, `Employee.lavozim` matniga tegmaydi,
 * hech narsani o'chirmaydi, boshqa biznesga tegmaydi (har so'rov businessId
 * bilan). Lavozim nomlari KODGA HARDCODE EMAS — `MAQSAD` ro'yxati ENV bilan
 * almashtiriladi (`LAVOZIMLAR="Nom:kopXodim:tartib,..."`).
 *
 * OMMAVIY LOG: `CI` da ism va lavozim matni niqoblanadi (repo ochiq).
 */
import "dotenv/config";
import { rawPrisma } from "@/lib/db/rawPrisma";

const QOLLASH = process.argv.includes("--qollash");
const OMMAVIY = Boolean(process.env.CI);
const TENANT_SLUG = process.env.TENANT_SLUG ?? "disney-navoiy";
const BUSINESS_ID = process.env.BUSINESS_ID ?? "";

interface Maqsad {
  nomi: string;
  turi: string;
  kopXodim: boolean;
  tartib: number;
}

/** Standart ro'yxat — ENV bilan almashtiriladi, kodda qotib qolmagan. */
const STANDART: Maqsad[] = [
  { nomi: "Sotuvchi", turi: "sotuvchi", kopXodim: false, tartib: 0 },
  { nomi: "Shofyor", turi: "ijrochi", kopXodim: false, tartib: 1 },
  { nomi: "Diktor", turi: "ijrochi", kopXodim: false, tartib: 2 },
  { nomi: "Animator / Igrushka", turi: "ijrochi", kopXodim: false, tartib: 3 },
  { nomi: "Videochi", turi: "ijrochi", kopXodim: true, tartib: 4 },
  { nomi: "Bezakchi", turi: "ijrochi", kopXodim: true, tartib: 5 },
];

function maqsadlarniOqi(): Maqsad[] {
  const xom = process.env.LAVOZIMLAR;
  if (!xom) return STANDART;
  return xom.split(",").map((qism, i) => {
    const [nomi, kop, tartib] = qism.split(":");
    if (!nomi?.trim()) throw new Error(`LAVOZIMLAR noto'g'ri: "${qism}"`);
    return {
      nomi: nomi.trim(),
      turi: nomi.trim().toLowerCase().includes("sotuvchi") ? "sotuvchi" : "ijrochi",
      kopXodim: kop?.trim() === "ha",
      tartib: tartib ? Number(tartib) : i,
    };
  });
}

/** Qidiruv uchun normallashtirish: registr, apostrof shakllari, ortiqcha bo'sh joy. */
function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/[`'‘’ʻʼ]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Maqsad nomidan qidiruv kalitlari: "Animator / Igrushka" -> ["animator", "igrushka"]. */
function kalitlar(nomi: string): string[] {
  return norm(nomi)
    .split("/")
    .map((q) => q.trim())
    .filter(Boolean);
}

function niqob(s: string) {
  return OMMAVIY ? `${s.slice(0, 2)}…(${s.length})` : s;
}

async function main() {
  console.log(QOLLASH ? "REJIM: QO'LLASH — faqat LAVOZIM yaratiladi (a'zo biriktirilmaydi)" : "REJIM: QURUQ (audit) — bazaga YOZILMAYDI");
  const maqsad = maqsadlarniOqi();
  console.log(`Maqsad lavozimlar: ${maqsad.map((m) => `${m.nomi}[${m.kopXodim ? "kop" : "bitta"}]`).join(", ")}`);

  const tenant = await rawPrisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
    select: { id: true, businesses: { select: { id: true, nomi: true } } },
  });
  if (!tenant) throw new Error(`Tenant topilmadi: ${TENANT_SLUG}`);
  const bizneslar = BUSINESS_ID ? tenant.businesses.filter((b) => b.id === BUSINESS_ID) : tenant.businesses;
  console.log(`Tenant: ${tenant.id} · tekshiriladigan bizneslar: ${bizneslar.length}`);

  for (const b of bizneslar) {
    const xodimlar = await rawPrisma.employee.findMany({
      where: { businessId: b.id, deletedAt: null },
      select: { id: true, ism: true, lavozim: true, isActive: true, userId: true },
      orderBy: { ism: "asc" },
    });
    if (xodimlar.length === 0) continue;

    console.log("");
    console.log("=".repeat(100));
    console.log(`BIZNES ${b.id} (${niqob(b.nomi)}) · xodimlar: ${xodimlar.length}`);

    console.log("");
    console.log("ESKI LAVOZIM MATNLARI (Employee.lavozim — manba):");
    for (const x of xodimlar) {
      const matn = x.lavozim?.trim() ? niqob(x.lavozim.trim()) : "— (bo'sh)";
      console.log(`  · ${x.id} ${niqob(x.ism).padEnd(12)} lavozim matni: ${matn.padEnd(24)} ${x.isActive ? "faol" : "NOFAOL"} · user ${x.userId ? "bor" : "yo'q"}`);
    }

    const mavjud = await rawPrisma.employeeCategory.findMany({
      where: { businessId: b.id },
      select: { id: true, nomi: true, turi: true, kopXodim: true, zakazgaBiriktiriladi: true, aktiv: true, tartib: true, _count: { select: { azolar: true } } },
      orderBy: { tartib: "asc" },
    });

    console.log("");
    console.log("| LAVOZIM             | HOLAT      | TOPILGAN XODIMLAR (taklif)                 | kopXodim | zakazgaBiriktiriladi |");
    console.log("|---------------------|------------|--------------------------------------------|----------|----------------------|");

    for (const m of maqsad) {
      const bor = mavjud.find((k) => norm(k.nomi) === norm(m.nomi));
      const kl = kalitlar(m.nomi);
      const aniq = xodimlar.filter((x) => x.lavozim && kl.some((k) => norm(x.lavozim!) === k));
      const qisman = xodimlar.filter(
        (x) => x.lavozim && !aniq.includes(x) && kl.some((k) => norm(x.lavozim!).includes(k))
      );
      const nomzod = [
        ...aniq.map((x) => `${niqob(x.ism)}[aniq]`),
        ...qisman.map((x) => `${niqob(x.ism)}[qisman]`),
      ];
      const holat = bor ? "mavjud" : QOLLASH ? "YARATILADI" : "yo'q";
      console.log(
        `| ${m.nomi.padEnd(19)} | ${holat.padEnd(10)} | ${(nomzod.join(", ") || "— nomzod yo'q").padEnd(42)} | ` +
          `${(m.kopXodim ? "true" : "false").padEnd(8)} | ${"true".padEnd(20)} |`
      );
      for (const x of aniq) console.log(`|                     |            |   ANIQ:   emp ${x.id}${x.isActive ? "" : " (NOFAOL)"}`);
      for (const x of qisman) console.log(`|                     |            |   QISMAN: emp ${x.id} · matn "${niqob(x.lavozim!.trim())}"${x.isActive ? "" : " (NOFAOL)"}`);
    }

    const mosKelmagan = xodimlar.filter(
      (x) => !maqsad.some((m) => x.lavozim && kalitlar(m.nomi).some((k) => norm(x.lavozim!).includes(k)))
    );
    if (mosKelmagan.length > 0) {
      console.log("");
      console.log("HECH BIR MAQSAD LAVOZIMGA MOS KELMAGAN XODIMLAR (qo'lda qaror):");
      for (const x of mosKelmagan) {
        console.log(`  · ${x.id} ${niqob(x.ism)} · matn "${x.lavozim?.trim() ? niqob(x.lavozim.trim()) : "(bo'sh)"}"`);
      }
    }

    if (mavjud.length > 0) {
      console.log("");
      console.log("BAZADAGI MAVJUD LAVOZIMLAR (EmployeeCategory):");
      for (const k of mavjud) {
        console.log(
          `  · ${k.id} ${k.nomi.padEnd(20)} turi=${k.turi.padEnd(8)} kopXodim=${String(k.kopXodim).padEnd(5)} ` +
            `zakazga=${String(k.zakazgaBiriktiriladi).padEnd(5)} aktiv=${String(k.aktiv).padEnd(5)} tartib=${k.tartib} a'zo=${k._count.azolar}`
        );
      }
    }

    if (QOLLASH) {
      const yaratildi: string[] = [];
      const yangilandi: string[] = [];
      await rawPrisma.$transaction(async (tx) => {
        for (const m of maqsad) {
          const bor = await tx.employeeCategory.findFirst({
            where: { businessId: b.id, nomi: m.nomi },
            select: { id: true, kopXodim: true, zakazgaBiriktiriladi: true, aktiv: true },
          });
          if (!bor) {
            const yangi = await tx.employeeCategory.create({
              data: {
                businessId: b.id,
                nomi: m.nomi,
                turi: m.turi,
                kopXodim: m.kopXodim,
                zakazgaBiriktiriladi: true,
                aktiv: true,
                tartib: m.tartib,
              },
              select: { id: true },
            });
            yaratildi.push(`${m.nomi} (${yangi.id})`);
            continue;
          }
          // Mavjud lavozimda FAQAT bayroqlar to'g'rilanadi; nomi va a'zolari tegilmaydi.
          if (bor.kopXodim !== m.kopXodim || !bor.zakazgaBiriktiriladi || !bor.aktiv) {
            await tx.employeeCategory.update({
              where: { id: bor.id },
              data: { kopXodim: m.kopXodim, zakazgaBiriktiriladi: true, aktiv: true, tartib: m.tartib },
            });
            yangilandi.push(`${m.nomi} (${bor.id})`);
          }
        }
      });
      console.log("");
      console.log(`YOZILDI — yaratilgan lavozimlar: ${yaratildi.length ? yaratildi.join(", ") : "yo'q"}`);
      console.log(`YOZILDI — bayrog'i to'g'rilangan: ${yangilandi.length ? yangilandi.join(", ") : "yo'q"}`);
      console.log("A'ZOLIK: BIRORTA ham xodim biriktirilmadi (ataylab — egasi tasdiqlaydi).");
    }
  }

  if (!QOLLASH) {
    console.log("");
    console.log("QURUQ rejim — hech narsa yozilmadi. Lavozim yaratish: --qollash");
    console.log("Matn mosligi TAKLIF, dalil emas — a'zolikni egasi tasdiqlaydi.");
  }
  console.log("HOLAT: OK.");
}

main()
  .then(() => rawPrisma.$disconnect())
  .catch(async (e) => {
    console.error("XATO:", e);
    await rawPrisma.$disconnect();
    process.exit(1);
  });
