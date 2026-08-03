/**
 * YANGI MIJOZ (tenant) yaratish — superadmin panelisiz, bitta buyruq bilan.
 *
 * Ishlatish:
 *   npm run client:create -- --nom "AvtoBalans" --login AvtoBalans --parol "avtobalans.uz" \
 *     --tarif AVTO --turi avto --kunlar 30
 *
 * Argumentlar:
 *   --nom     kompaniya nomi (biznes ham shu nom bilan yaratiladi) — majburiy
 *   --login   OWNER logini (telefon yoki matn) — majburiy
 *   --parol   OWNER paroli (kamida 8 belgi) — majburiy
 *   --ism     OWNER ismi (default: --nom qiymati)
 *   --tarif   tarif kodi: STANDARD | AVTO | PRO (default STANDARD)
 *   --turi    biznes turi: umumiy | avto (default umumiy)
 *   --kunlar  obuna kunlari (default 30). 0 berilsa — 14 kunlik TRIAL holida qoladi.
 *
 * Production'da DATABASE_URL/DATABASE_AUTH_TOKEN env orqali Turso'ga ulanadi.
 */
import "dotenv/config";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { createClientTenant } from "@/lib/superadmin/newClient";
import { planByCode } from "@/lib/billing/plans";

function arg(nomi: string): string | undefined {
  const i = process.argv.indexOf(`--${nomi}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function xato(xabar: string): never {
  console.error(`XATO: ${xabar}`);
  process.exit(1);
}

async function main() {
  const nom = arg("nom");
  const login = arg("login");
  const parol = arg("parol");
  const ism = arg("ism") ?? nom;
  const tarif = (arg("tarif") ?? "STANDARD").toUpperCase();
  const turi = (arg("turi") ?? "umumiy").toLowerCase();
  const kunlar = Number(arg("kunlar") ?? 30);

  if (!nom || !login || !parol) {
    xato('majburiy argumentlar: --nom "Nomi" --login <login> --parol <parol>');
  }
  if (parol.length < 8) xato("parol kamida 8 belgi bo'lishi kerak.");
  if (turi !== "umumiy" && turi !== "avto") xato("--turi faqat 'umumiy' yoki 'avto' bo'ladi.");
  const plan = planByCode(tarif);
  if (!plan) xato(`'${tarif}' tarifi yo'q. Mavjud: STANDARD, AVTO, PRO.`);
  if (!Number.isFinite(kunlar) || kunlar < 0) xato("--kunlar musbat son bo'lishi kerak.");

  const { tenant, user, business, periodEnd } = await createClientTenant({
    nom,
    login,
    parol,
    ism,
    tarif: plan!.code,
    turi: turi as "umumiy" | "avto",
    kunlar,
  });

  const holat = periodEnd
    ? `ACTIVE — ${periodEnd.toLocaleDateString("ru-RU")} gacha (${kunlar} kun)`
    : "TRIAL (14 kun)";

  console.log("✅ Mijoz yaratildi");
  console.log(`   Kompaniya : ${tenant.name} (slug: ${tenant.slug})`);
  console.log(`   Biznes    : ${business.nomi} — rejim: ${turi}${turi === "avto" ? " (avtopark)" : ""}`);
  console.log(`   Tarif     : ${plan!.nomi} — ${plan!.oylikNarx.toLocaleString("ru-RU")} so'm/oy`);
  console.log(`   Obuna     : ${holat}`);
  console.log(`   Login     : ${user.login}`);
  console.log(`   Parol     : ${parol}`);
  console.log("   Kirish    : /login sahifasi orqali.");
}

main()
  .catch((e) => {
    console.error("XATO:", e.message);
    process.exit(1);
  })
  .finally(() => rawPrisma.$disconnect());
