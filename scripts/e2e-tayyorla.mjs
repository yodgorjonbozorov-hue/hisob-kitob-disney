/**
 * E2E uchun toza baza tayyorlaydi.
 *
 *   node e2e/tayyorla.mjs
 *
 * Nima qiladi: eski sinov bazasini o'chiradi, migratsiyalarni qo'llaydi,
 * demo ma'lumotni ekadi va tenantni PRO tarifga o'tkazib BARCHA modullarni
 * yoqadi. Oxirgi qadam shart: yangi modullar (XARID, TASDIQLASH, MIJOZLAR,
 * HR, HUJJATLAR) standart holatda o'chiq va ularning sahifalari umuman
 * ochilmaydi — smoke test esa aynan o'shalarni tekshiradi.
 *
 * Baza HAR SAFAR noldan quriladi: testlar oldingi yurishdan qolgan
 * ma'lumotga tayanib qolmasligi kerak.
 */
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

const BAZA = "prisma/e2e.db";
export const E2E_URL = `file:./${BAZA}`;

/** Registry'dagi core BO'LMAGAN modullar — yoqilishi kerak bo'lganlari. */
const MODULLAR = [
  "OMBOR",
  "XARID",
  "TASDIQLASH",
  "MIJOZLAR",
  "HR",
  "HUJJATLAR",
  "CRM",
  "VAZIFALAR",
  "AI",
];

const env = {
  ...process.env,
  DATABASE_URL: E2E_URL,
  DATABASE_AUTH_TOKEN: "",
  // seed production'da ishlashdan bosh tortadi — bu lokal sinov bazasi.
  NODE_ENV: "development",
};

function bajar(nom, buyruq, args) {
  const res = spawnSync(buyruq, args, { env, encoding: "utf8" });
  if (res.status !== 0) {
    console.error(`XATO — ${nom}:\n${res.stdout}\n${res.stderr}`);
    process.exit(1);
  }
  return res.stdout;
}

async function main() {
  rmSync(BAZA, { force: true });
  rmSync(`${BAZA}-journal`, { force: true });

  bajar("migratsiya", process.execPath, ["scripts/db-migrate.mjs"]);
  bajar("seed", process.execPath, ["-r", "ts-node/register", "prisma/seed.ts"]);

  const { createClient } = await import("@libsql/client");
  const c = createClient({ url: E2E_URL });

  const tenant = await c.execute(`SELECT "id" FROM "Tenant" LIMIT 1`);
  const tenantId = String(tenant.rows[0].id);

  await c.execute({
    sql: `UPDATE "Tenant" SET "plan" = 'PRO', "status" = 'ACTIVE' WHERE "id" = ?`,
    args: [tenantId],
  });

  // Seed demo adminni parol almashtirishga majbur qiladi (to'g'ri qaror —
  // demo paroli bilan ishlab ketilmasin). Smoke test esa boshqa narsani
  // tekshiradi: shu bayroq qolsa HAR sahifa "Parolni o'zgartirish" ga
  // yo'naltiriladi va testlar aslida hech narsani sinamaydi.
  await c.execute(`UPDATE "User" SET "mustChangePassword" = 0`);

  for (const code of MODULLAR) {
    await c.execute({
      sql: `INSERT OR IGNORE INTO "TenantModule" ("id","tenantId","code","isActive","createdAt")
            VALUES (?, ?, ?, 1, ?)`,
      args: [`tm_${code.toLowerCase()}`, tenantId, code, new Date().toISOString()],
    });
  }

  const soni = await c.execute(
    `SELECT COUNT(*) n FROM "TenantModule" WHERE "isActive" = 1`
  );
  console.log(`E2E bazasi tayyor: ${BAZA} · ${Number(soni.rows[0].n)} modul yoqilgan`);
}

main().catch((e) => {
  console.error("XATO:", e.message);
  process.exit(1);
});
