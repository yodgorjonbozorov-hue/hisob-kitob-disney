/**
 * MIJOZNI PRO TARIFGA O'TKAZISH — bitta buyruq bilan.
 *
 * Ishlatish:
 *   npm run client:pro -- --slug fortex-selos
 *   npm run client:pro -- --slug fortex-selos --kunlar 30
 *
 * Nima qiladi:
 *   1. tenant.plan = "PRO" (obuna holatiga tegilmaydi; --kunlar berilsa
 *      status ACTIVE bo'lib davr shu kunga uzaytiriladi);
 *   2. PRO tarifdagi BARCHA modullar TenantModule'da yoqiladi — mijoz
 *      kirishi bilan to'liq ERP ochiq turadi.
 *
 * Production'da DATABASE_URL/DATABASE_AUTH_TOKEN env orqali Turso'ga ulanadi.
 */
import "dotenv/config";
import { rawPrisma } from "@/lib/db/rawPrisma";
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
  const slug = arg("slug");
  const kunlar = arg("kunlar") ? Number(arg("kunlar")) : null;
  if (!slug) xato("majburiy argument: --slug <tenant-slug>");
  if (kunlar !== null && (!Number.isFinite(kunlar) || kunlar <= 0)) {
    xato("--kunlar musbat son bo'lishi kerak");
  }

  const tenant = await rawPrisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    const hammasi = await rawPrisma.tenant.findMany({ select: { slug: true, name: true, plan: true } });
    console.error("Mavjud mijozlar:", hammasi.map((t) => `${t.slug} (${t.name}, ${t.plan})`).join(", "));
    xato(`'${slug}' slug'li mijoz topilmadi`);
  }

  const plan = planByCode("PRO")!;

  await rawPrisma.tenant.update({
    where: { id: tenant.id },
    data: {
      plan: plan.code,
      ...(kunlar
        ? {
            status: "ACTIVE",
            currentPeriodEnd: new Date(Date.now() + kunlar * 24 * 60 * 60 * 1000),
          }
        : {}),
    },
  });

  // PRO tarifdagi barcha modullarni yoqish (core'lar yozuvsiz ham yoqilgan).
  for (const code of plan.modullar) {
    await rawPrisma.tenantModule.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code } },
      create: { tenantId: tenant.id, code, isActive: true },
      update: { isActive: true },
    });
  }

  console.log(`✔ "${tenant.name}" (${slug}) PRO tarifga o'tkazildi.`);
  console.log(`  Yoqilgan modullar: ${plan.modullar.join(", ")}`);
  if (kunlar) console.log(`  Obuna: ACTIVE, ${kunlar} kunga uzaytirildi.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("XATO:", e);
    process.exit(1);
  });
