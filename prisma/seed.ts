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

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function amountRangeFor(nomi: string, turi: "kirim" | "chiqim"): [number, number] {
  if (turi === "chiqim") {
    if (nomi === "Oyliklar") return [1_500_000, 4_000_000];
    if (nomi === "Mayda xarajatlar") return [20_000, 150_000];
    if (nomi === "Mashinalarga chiqim") return [100_000, 800_000];
    if (nomi === "Ro'zg'or xarajatlari") return [50_000, 500_000];
  }
  return [150_000, 2_500_000];
}

async function main() {
  console.log("Kategoriyalarni yaratish...");

  const kirimCats = [];
  for (let i = 0; i < KIRIM_KATEGORIYALAR.length; i++) {
    const nomi = KIRIM_KATEGORIYALAR[i];
    const cat = await prisma.category.upsert({
      where: { nomi_turi: { nomi, turi: "kirim" } },
      update: {},
      create: { nomi, turi: "kirim", tartib: i },
    });
    kirimCats.push(cat);
  }

  const chiqimCats = [];
  for (let i = 0; i < CHIQIM_KATEGORIYALAR.length; i++) {
    const nomi = CHIQIM_KATEGORIYALAR[i];
    const cat = await prisma.category.upsert({
      where: { nomi_turi: { nomi, turi: "chiqim" } },
      update: {},
      create: { nomi, turi: "chiqim", tartib: i },
    });
    chiqimCats.push(cat);
  }

  console.log("Foydalanuvchilarni yaratish...");

  const adminHash = await bcrypt.hash(ADMIN_PAROL, 10);
  const admin = await prisma.user.upsert({
    where: { login: ADMIN_LOGIN },
    update: {},
    create: { ism: "Direktor", login: ADMIN_LOGIN, parolHash: adminHash, rol: "admin" },
  });

  const kassirHash = await bcrypt.hash(KASSIR_PAROL, 10);
  const kassir = await prisma.user.upsert({
    where: { login: KASSIR_LOGIN },
    update: {},
    create: { ism: "Kassir Aziza", login: KASSIR_LOGIN, parolHash: kassirHash, rol: "kassir" },
  });

  const existingCount = await prisma.transaction.count();
  if (existingCount === 0) {
    console.log("Demo tranzaksiyalar yaratilmoqda...");
    const now = new Date();
    const monthsBack = 6;
    const users = [admin, kassir];

    for (let m = monthsBack - 1; m >= 0; m--) {
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth() - m;
      const monthDate = new Date(Date.UTC(year, month, 1));
      const daysInMonth = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)).getUTCDate();

      const kirimCount = randomInt(10, 18);
      const chiqimCount = randomInt(8, 15);

      for (let i = 0; i < kirimCount; i++) {
        const cat = kirimCats[randomInt(0, kirimCats.length - 1)];
        const [min, max] = amountRangeFor(cat.nomi, "kirim");
        const day = randomInt(1, daysInMonth);
        await prisma.transaction.create({
          data: {
            turi: "kirim",
            categoryId: cat.id,
            summa: randomInt(min, max),
            sana: new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), day)),
            izoh: null,
            userId: users[randomInt(0, users.length - 1)].id,
          },
        });
      }

      for (let i = 0; i < chiqimCount; i++) {
        const cat = chiqimCats[randomInt(0, chiqimCats.length - 1)];
        const [min, max] = amountRangeFor(cat.nomi, "chiqim");
        const day = randomInt(1, daysInMonth);
        await prisma.transaction.create({
          data: {
            turi: "chiqim",
            categoryId: cat.id,
            summa: randomInt(min, max),
            sana: new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), day)),
            izoh: null,
            userId: users[randomInt(0, users.length - 1)].id,
          },
        });
      }
    }
  }

  console.log("\n=== Seed tugadi ===");
  console.log(`Admin login: ${ADMIN_LOGIN} / parol: ${ADMIN_PAROL}`);
  console.log(`Kassir login: ${KASSIR_LOGIN} / parol: ${KASSIR_PAROL}`);
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
