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
  // XAVFSIZLIK: seed faqat development uchun. Production bazasida admin/admin123
  // kabi standart foydalanuvchi HECH QACHON yaratilmasligi kerak.
  if (process.env.NODE_ENV === "production") {
    console.error("XATO: db:seed production muhitida ishlatilmaydi. Yangi kompaniya /signup orqali ochiladi.");
    process.exit(1);
  }
  if ((process.env.DATABASE_URL ?? "").startsWith("libsql://")) {
    console.error("XATO: db:seed masofaviy (Turso) bazaga qarshi ishlatilmaydi — faqat lokal file: baza.");
    process.exit(1);
  }

  console.log("Tenant yaratish...");

  // Default demo tenant. ID'lar `20260727093026_tenant_layer` backfill'idagi qiymatlar
  // bilan bir xil bo'lishi SHART (idempotentlik) — shu bois ular o'zgarmaydi, garchi
  // nomi brendingdan keyin neytral bo'lsa ham. ID'lar hech qayerda ko'rinmaydi.
  const tenant = await prisma.tenant.upsert({
    where: { id: "tenant_disney_navoiy" },
    update: {},
    create: {
      id: "tenant_disney_navoiy",
      name: "Demo Kompaniya",
      slug: "demo-kompaniya",
      status: "ACTIVE",
    },
  });

  console.log("Bizneslarni yaratish...");

  // Xizmatlar (kategoriyalar bilan) va Salyut (tovar sotadigan, ombor yoqilgan).
  const xizmatlar = await prisma.business.upsert({
    where: { id: "biz_disney_navoiy" },
    update: {},
    create: { id: "biz_disney_navoiy", nomi: "Demo Xizmatlar", tenantId: tenant.id },
  });
  // Salyut — tovar sotadigan biznes: ombor tizimi yoqilgan.
  const salyut = await prisma.business.upsert({
    where: { id: "biz_salyut" },
    update: { omborli: true },
    create: { id: "biz_salyut", nomi: "Salyut", omborli: true, tenantId: tenant.id },
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

  console.log("Demo Xizmatlar kategoriyalarini yaratish...");

  for (let i = 0; i < KIRIM_KATEGORIYALAR.length; i++) {
    const nomi = KIRIM_KATEGORIYALAR[i];
    await prisma.category.upsert({
      where: { nomi_turi_businessId: { nomi, turi: "kirim", businessId: xizmatlar.id } },
      update: {},
      create: { nomi, turi: "kirim", tartib: i, businessId: xizmatlar.id },
    });
  }

  for (let i = 0; i < CHIQIM_KATEGORIYALAR.length; i++) {
    const nomi = CHIQIM_KATEGORIYALAR[i];
    await prisma.category.upsert({
      where: { nomi_turi_businessId: { nomi, turi: "chiqim", businessId: xizmatlar.id } },
      update: {},
      create: { nomi, turi: "chiqim", tartib: i, businessId: xizmatlar.id },
    });
  }

  console.log("Foydalanuvchilarni yaratish...");

  const adminHash = await bcrypt.hash(ADMIN_PAROL, 10);
  await prisma.user.upsert({
    where: { login: ADMIN_LOGIN },
    update: {},
    // Direktor (OWNER) — biznesga biriktirilmagan (businessId=null), tenant ichidagi barcha bizneslarni ko'radi.
    // Yangi o'rnatishda boshlang'ich parol majburiy almashtiriladi (mavjud DB'ga ta'sir qilmaydi — update bo'sh).
    create: { ism: "Direktor", login: ADMIN_LOGIN, parolHash: adminHash, rol: "OWNER", mustChangePassword: true, tenantId: tenant.id },
  });

  const kassirHash = await bcrypt.hash(KASSIR_PAROL, 10);
  await prisma.user.upsert({
    where: { login: KASSIR_LOGIN },
    update: {},
    // Kassir — bitta biznesga biriktirilgan.
    create: {
      ism: "Kassir Aziza",
      login: KASSIR_LOGIN,
      parolHash: kassirHash,
      rol: "CASHIER",
      businessId: xizmatlar.id,
      tenantId: tenant.id,
    },
  });

  console.log("\n=== Seed tugadi ===");
  console.log("Bizneslar: Demo Xizmatlar (kategoriyalar bilan), Salyut (omborli)");
  console.log(`Admin login: ${ADMIN_LOGIN} / parol: ${ADMIN_PAROL}`);
  console.log(`Kassir login: ${KASSIR_LOGIN} / parol: ${KASSIR_PAROL} (Demo Xizmatlar)`);
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
