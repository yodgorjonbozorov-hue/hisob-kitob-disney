// BIR MARTALIK: superadmin parolini deploy paytida tiklaydi (parol esdan chiqqan).
//
// Nima uchun: Vercel env o'zgaruvchilarini o'rnatishga qo'l yetmadi, shuning
// uchun login va parolning bcrypt XESHI (parolning o'zi EMAS) shu faylga
// joylangan. Superadmin panelga kirgach bu skript build zanjiridan olib
// tashlanadi.
//
// Xavfsizlik: SUPERADMIN bo'lmagan (mijoz) foydalanuvchiga hech qachon
// tegmaydi — mavjud tenant akkauntini superadminga ko'tarib yubormaslik uchun.
// Idempotent: xesh allaqachon o'rnatilgan bo'lsa jimgina o'tkazib yuboriladi.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

const LOGIN = "umar_narziyev";
const PAROL_XESH = "$2a$10$vcQUydO.WMA38yNzhsE.EOB1DFxzCccNE6UXNRk2J8z1aS7L4g1PG";
const ISM = "Platforma egasi";

// Build'ni to'xtatmaymiz: baza yo'q bo'lsa (lokal build) jimgina o'tamiz.
if (!process.env.DATABASE_URL) {
  console.log("bir-martalik-parol: o'tkazib yuborildi — DATABASE_URL yo'q");
  process.exit(0);
}

const prisma = new PrismaClient({
  adapter: new PrismaLibSQL(
    createClient({ url: process.env.DATABASE_URL, authToken: process.env.DATABASE_AUTH_TOKEN })
  ),
});

async function main() {
  const existing = await prisma.user.findUnique({ where: { login: LOGIN } });

  if (!existing) {
    await prisma.user.create({
      data: {
        login: LOGIN,
        ism: ISM,
        parolHash: PAROL_XESH,
        rol: "SUPERADMIN",
        tenantId: null,
        businessId: null,
        // Parolni egasining o'zi tanlagan — majburiy almashtirish so'ralmaydi.
        mustChangePassword: false,
      },
    });
    console.log(`bir-martalik-parol: '${LOGIN}' superadmin yaratildi.`);
    return;
  }

  if (existing.rol !== "SUPERADMIN") {
    console.warn(
      `bir-martalik-parol: '${LOGIN}' allaqachon band (rol: ${existing.rol}) — tegilmadi.`
    );
    return;
  }

  if (existing.parolHash === PAROL_XESH) {
    console.log(`bir-martalik-parol: '${LOGIN}' paroli allaqachon o'rnatilgan — o'tkazib yuborildi.`);
    return;
  }

  await prisma.user.update({
    where: { id: existing.id },
    data: { parolHash: PAROL_XESH, mustChangePassword: false, isActive: true },
  });
  console.log(`bir-martalik-parol: '${LOGIN}' paroli almashtirildi va akkaunt faollashtirildi.`);
}

main()
  // Xato deploy'ni yiqitmaydi — sayt ishlashda davom etadi, sabab log'da ko'rinadi.
  .catch((e) => console.error("bir-martalik-parol XATO:", e.message))
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  });
