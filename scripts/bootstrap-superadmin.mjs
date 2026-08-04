// SUPERADMIN akkauntini deploy vaqtida yaratadi/tiklaydi (env orqali).
//
// Nima uchun: `superadmin:create`/`superadmin:reset` skriptlari Turso ulanishini
// talab qiladi — production bazasiga qo'l bilan ulanmasdan panelga kirishning
// yo'li yo'q edi. Bu skript build paytida (Vercel env bilan) ishlaydi, shuning
// uchun akkauntni faqat env o'zgaruvchilari orqali tiklash mumkin.
//
// Env:
//   SUPERADMIN_LOGIN   — login (masalan: superadmin)
//   SUPERADMIN_PAROL   — parol (kamida 8 belgi)
//   SUPERADMIN_ISM     — ism (ixtiyoriy, default: "Platforma egasi")
//   SUPERADMIN_RESET   — "1"/"true" bo'lsa mavjud superadmin paroli ALMASHTIRILADI
//                        (parol esdan chiqqanda). Bo'lmasa mavjud akkaunt tegilmaydi.
//
// Idempotent: env qo'yilmagan bo'lsa jimgina o'tkazib yuboriladi, build to'xtamaydi.
// Xavfsizlik: SUPERADMIN bo'lmagan (mijoz) foydalanuvchiga hech qachon tegmaydi —
// mavjud tenant akkauntini superadminga ko'tarib yubormaslik uchun.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

const login = process.env.SUPERADMIN_LOGIN?.trim();
const parol = process.env.SUPERADMIN_PAROL;
const ism = process.env.SUPERADMIN_ISM?.trim() || "Platforma egasi";
const reset = /^(1|true|yes)$/i.test(process.env.SUPERADMIN_RESET ?? "");

// Build'ni to'xtatmaymiz: konfiguratsiya yo'q/xato bo'lsa sayt baribir chiqadi,
// sabab esa build log'ida aniq ko'rinadi.
function skip(sabab) {
  console.log(`superadmin bootstrap: o'tkazib yuborildi — ${sabab}`);
  process.exit(0);
}

if (!process.env.DATABASE_URL) skip("DATABASE_URL yo'q");
if (!login || !parol) skip("SUPERADMIN_LOGIN/SUPERADMIN_PAROL qo'yilmagan");
if (parol.length < 8) skip("SUPERADMIN_PAROL kamida 8 belgi bo'lishi kerak");

const prisma = new PrismaClient({
  adapter: new PrismaLibSQL(
    createClient({ url: process.env.DATABASE_URL, authToken: process.env.DATABASE_AUTH_TOKEN })
  ),
});

async function main() {
  const existing = await prisma.user.findUnique({ where: { login } });

  if (!existing) {
    await prisma.user.create({
      data: {
        login,
        ism,
        parolHash: await bcrypt.hash(parol, 10),
        rol: "SUPERADMIN",
        tenantId: null,
        businessId: null,
        // Parolni egasining o'zi tanlagan — majburiy almashtirish so'ralmaydi.
        mustChangePassword: false,
      },
    });
    console.log(`superadmin bootstrap: '${login}' yaratildi.`);
    return;
  }

  if (existing.rol !== "SUPERADMIN") {
    console.warn(
      `superadmin bootstrap: '${login}' allaqachon band (rol: ${existing.rol}) — tegilmadi. Boshqa login tanlang.`
    );
    return;
  }

  if (!reset) {
    console.log(
      `superadmin bootstrap: '${login}' mavjud — tegilmadi. Parolni tiklash uchun SUPERADMIN_RESET=1 qo'ying.`
    );
    return;
  }

  await prisma.user.update({
    where: { id: existing.id },
    data: { parolHash: await bcrypt.hash(parol, 10), mustChangePassword: false, isActive: true },
  });
  console.log(`superadmin bootstrap: '${login}' paroli almashtirildi va akkaunt faollashtirildi.`);
  console.log("Kirgach SUPERADMIN_RESET ni o'chirib qo'ying (keyingi deploy'da qayta tiklanmasligi uchun).");
}

main()
  // Bootstrap xatosi deploy'ni yiqitmaydi — sayt ishlashda davom etadi.
  .catch((e) => console.error("superadmin bootstrap XATO:", e.message))
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  });
