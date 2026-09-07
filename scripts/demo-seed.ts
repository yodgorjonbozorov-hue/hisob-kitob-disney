/**
 * DEMO DATASETNI EKISH.
 *
 *   npm run demo:seed
 *
 * Idempotent: qayta ishga tushirilsa demo biznesning ish ma'lumotlari
 * o'chirilib, nisbiy sanalar bilan qaytadan quriladi (demo eskirmaydi).
 * Boshqa hech bir tenantga TEGMAYDI — barcha so'rovlar demo biznes id'si
 * bilan cheklangan (src/lib/demo/dataset.ts).
 *
 * `rawPrisma` shu yerda ishlatiladi: bu tizim-darajali skript, tenant
 * konteksti mavjud emas (mavjud skriptlar bilan bir xil naqsh —
 * masalan scripts/e2e-bizneslar.ts).
 */
import { rawPrisma } from "@/lib/db/rawPrisma";
import { demoDatasetYarat } from "@/lib/demo/dataset";
import { formatSom } from "@/lib/format";

async function main() {
  const natija = await demoDatasetYarat(rawPrisma);
  const j = natija.jamlar;
  console.log("Demo dataset tayyor:");
  console.log(`  tenant      : ${natija.tenantId}`);
  console.log(`  biznes      : ${natija.businessId}`);
  console.log(`  mahsulot    : ${natija.mahsulotlar}`);
  console.log(`  mijoz       : ${natija.mijozlar}`);
  console.log(`  xodim       : ${natija.xodimlar}`);
  console.log(`  sotuv       : ${natija.sotuvlar}`);
  console.log(`  tranzaksiya : ${natija.tranzaksiyalar}`);
  console.log(`  qarz        : ${natija.qarzlar}`);
  console.log(`  zakaz       : ${natija.zakazlar}`);
  console.log("Jamlar:");
  console.log(`  kirim       : ${formatSom(j.kirim)}`);
  console.log(`  chiqim      : ${formatSom(j.chiqim)}`);
  console.log(`  sof foyda   : ${formatSom(j.sofFoyda)}`);
  console.log(`  ochiq qarz  : ${formatSom(j.qarzQoldiq)}`);
  console.log(`  ombor qiym. : ${formatSom(j.omborQiymati)}`);
  await rawPrisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await rawPrisma.$disconnect();
  process.exit(1);
});
