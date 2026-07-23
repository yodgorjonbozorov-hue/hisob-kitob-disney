import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";

// Lokalda file:./prisma/dev.db, production'da Turso libsql://... — bir xil kod.
const libsqlClient = createClient({
  url: process.env.DATABASE_URL as string,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});
const prisma = new PrismaClient({ adapter: new PrismaLibSQL(libsqlClient) });

const KIRIM_KATEGORIYALAR = [
  "Tabrik",
  "Animator",
  "O'yinchoqlar",
  "Dekoratsiya",
  "Hovli bezaklari",
  "Sveta-musiqalar",
];

const CHIQIM_KATEGORIYALAR = [
  "Tabrik",
  "Animator",
  "O'yinchoqlar",
  "Dekoratsiya",
  "Hovli bezaklari",
  "Sveta-musiqalar",
  "Ro'zg'or xarajatlari",
  "Oyliklar",
  "Mayda xarajatlar",
  "Mashinalarga chiqim",
];

const ADMIN_LOGIN = "admin";
const ADMIN_PAROL = "admin123";
const KASSIR_LOGIN = "kassir1";
const KASSIR_PAROL = "kassir123";

async function main() {
  console.log("Bizneslarni yaratish...");

  // Disney Navoiy (kategoriyalar bilan) va Salyut (bo'sh — admin o'zi to'ldiradi).
  const disney = await prisma.business.upsert({
    where: { id: "biz_disney_navoiy" },
    update: {},
    create: { id: "biz_disney_navoiy", nomi: "Disney Navoiy" },
  });
  // Salyut — tovar sotadigan biznes: ombor tizimi yoqilgan.
  const salyut = await prisma.business.upsert({
    where: { id: "biz_salyut" },
    update: { omborli: true },
    create: { id: "biz_salyut", nomi: "Salyut", omborli: true },
  });

  console.log("Salyut mahsulot turlarini yaratish...");
  const SALYUT_TURLARI = [
    "Karalevski 36 talik",
    "7 talik salyut",
    "8 talik salyut",
    "16 talik salyut",
    "Mikki",
  ];
  for (const nomi of SALYUT_TURLARI) {
    const mavjud = await prisma.product.findFirst({ where: { businessId: salyut.id, nomi } });
    if (!mavjud) {
      // Narxlar 0 — direktor keyin kelgan/sotuv narxini qo'yadi.
      await prisma.product.create({ data: { businessId: salyut.id, nomi } });
    }
  }

  console.log("Disney Navoiy kategoriyalarini yaratish...");

  for (let i = 0; i < KIRIM_KATEGORIYALAR.length; i++) {
    const nomi = KIRIM_KATEGORIYALAR[i];
    await prisma.category.upsert({
      where: { nomi_turi_businessId: { nomi, turi: "kirim", businessId: disney.id } },
      update: {},
      create: { nomi, turi: "kirim", tartib: i, businessId: disney.id },
    });
  }

  for (let i = 0; i < CHIQIM_KATEGORIYALAR.length; i++) {
    const nomi = CHIQIM_KATEGORIYALAR[i];
    await prisma.category.upsert({
      where: { nomi_turi_businessId: { nomi, turi: "chiqim", businessId: disney.id } },
      update: {},
      create: { nomi, turi: "chiqim", tartib: i, businessId: disney.id },
    });
  }

  console.log("Foydalanuvchilarni yaratish...");

  const adminHash = await bcrypt.hash(ADMIN_PAROL, 10);
  await prisma.user.upsert({
    where: { login: ADMIN_LOGIN },
    update: {},
    // Admin (direktor) — biznesga biriktirilmagan (businessId=null), barcha bizneslarni ko'radi.
    create: { ism: "Direktor", login: ADMIN_LOGIN, parolHash: adminHash, rol: "admin" },
  });

  const kassirHash = await bcrypt.hash(KASSIR_PAROL, 10);
  await prisma.user.upsert({
    where: { login: KASSIR_LOGIN },
    update: {},
    // Kassir — Disney Navoiy biznesiga biriktirilgan.
    create: {
      ism: "Kassir Aziza",
      login: KASSIR_LOGIN,
      parolHash: kassirHash,
      rol: "kassir",
      businessId: disney.id,
    },
  });

  console.log("\n=== Seed tugadi ===");
  console.log("Bizneslar: Disney Navoiy (kategoriyalar bilan), Salyut (bo'sh)");
  console.log(`Admin login: ${ADMIN_LOGIN} / parol: ${ADMIN_PAROL}`);
  console.log(`Kassir login: ${KASSIR_LOGIN} / parol: ${KASSIR_PAROL} (Disney Navoiy)`);
  console.log("Iltimos, birinchi kirishdan keyin parollarni o'zgartiring.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
