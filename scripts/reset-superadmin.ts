/**
 * SUPERADMIN parolini tiklash (parol esdan chiqqanda).
 *
 * Ishlatish (lokal yoki production env bilan):
 *   npm run superadmin:reset                      # mavjud superadminlar ro'yxatini ko'rsatadi
 *   npm run superadmin:reset -- <login> <parol>   # parolni almashtiradi
 *
 * Faqat roli SUPERADMIN bo'lgan foydalanuvchiga ta'sir qiladi — mijoz
 * (tenant) foydalanuvchilarining paroli bu skript orqali o'zgarmaydi.
 * Production'da DATABASE_URL/DATABASE_AUTH_TOKEN env orqali Turso'ga ulanadi.
 */
import "dotenv/config";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { hashPassword } from "@/lib/auth/password";

async function main() {
  const [login, parol] = process.argv.slice(2);

  // Argumentsiz chaqirilsa — mavjud superadminlarni ko'rsatamiz (login esdan chiqqan bo'lsa).
  if (!login) {
    const list = await rawPrisma.user.findMany({
      where: { rol: "SUPERADMIN" },
      select: { login: true, ism: true, isActive: true, lastLoginAt: true },
      orderBy: { createdAt: "asc" },
    });
    if (list.length === 0) {
      console.log("Bu bazada SUPERADMIN yo'q. Yangisini yarating:");
      console.log("  npm run superadmin:create -- <login> <parol> [ism]");
      return;
    }
    console.log(`Mavjud SUPERADMIN akkauntlari (${list.length}):`);
    for (const u of list) {
      const oxirgi = u.lastLoginAt ? u.lastLoginAt.toLocaleDateString("ru-RU") : "hech qachon";
      console.log(`  · ${u.login} — ${u.ism}${u.isActive ? "" : " (NOFAOL)"} · oxirgi kirish: ${oxirgi}`);
    }
    console.log("\nParolni almashtirish:");
    console.log("  npm run superadmin:reset -- <login> <yangi-parol>");
    return;
  }

  if (!parol) {
    console.error("Ishlatish: npm run superadmin:reset -- <login> <yangi-parol>");
    process.exit(1);
  }
  if (parol.length < 8) {
    console.error("XATO: parol kamida 8 belgi bo'lishi kerak.");
    process.exit(1);
  }

  const user = await rawPrisma.user.findUnique({ where: { login } });
  if (!user) {
    console.error(`XATO: '${login}' logini topilmadi. Ro'yxatni ko'rish: npm run superadmin:reset`);
    process.exit(1);
  }
  if (user.rol !== "SUPERADMIN") {
    console.error(`XATO: '${login}' SUPERADMIN emas (rol: ${user.rol}). Mijoz parollari panel orqali tiklanadi.`);
    process.exit(1);
  }

  await rawPrisma.user.update({
    where: { id: user.id },
    // Parol o'zi tanlangani uchun majburiy almashtirish so'ralmaydi; akkaunt faollashtiriladi.
    data: { parolHash: await hashPassword(parol), mustChangePassword: false, isActive: true },
  });

  console.log(`✅ Parol almashtirildi: ${user.login} (${user.ism})`);
  console.log("Kirish: /login sahifasi orqali — tizim sizni /superadmin paneliga o'tkazadi.");
}

main()
  .catch((e) => {
    console.error("XATO:", e.message);
    process.exit(1);
  })
  .finally(() => rawPrisma.$disconnect());
