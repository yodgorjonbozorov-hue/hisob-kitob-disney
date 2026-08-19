/**
 * SUPERADMIN (platforma egasi) yaratish. Tenantga bog'lanmaydi (tenantId = null).
 *
 * Ishlatish (lokal yoki production env bilan):
 *   npm run superadmin:create -- <login> <parol> [ism]
 *
 * Production'da DATABASE_URL/DATABASE_AUTH_TOKEN env orqali Turso'ga ulanib
 * bir marta ishga tushiriladi.
 */
import "dotenv/config";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { hashPassword } from "@/lib/auth/password";

async function main() {
  const [login, parol, ism] = process.argv.slice(2);
  if (!login || !parol) {
    console.error("Ishlatish: npm run superadmin:create -- <login> <parol> [ism]");
    process.exit(1);
  }
  if (parol.length < 8) {
    console.error("XATO: parol kamida 8 belgi bo'lishi kerak.");
    process.exit(1);
  }

  const existing = await rawPrisma.user.findUnique({ where: { login } });
  if (existing) {
    console.error(`XATO: '${login}' logini band (rol: ${existing.rol}).`);
    process.exit(1);
  }

  const user = await rawPrisma.user.create({
    data: {
      login,
      ism: ism ?? "Platforma egasi",
      parolHash: await hashPassword(parol),
      rol: "SUPERADMIN",
      // Superadmin 2.0: skript orqali ochilgan hisob ROOT bo'ladi.
      // Cheklangan rol Control Center → Sozlamalar bo'limidan beriladi.
      superadminRol: "ROOT",
      tenantId: null,
      businessId: null,
    },
  });

  console.log(`✅ SUPERADMIN yaratildi: ${user.login} (${user.ism})`);
  console.log("Panel: /superadmin (login sahifasi orqali kiring).");
}

main()
  .catch((e) => {
    console.error("XATO:", e.message);
    process.exit(1);
  })
  .finally(() => rawPrisma.$disconnect());
