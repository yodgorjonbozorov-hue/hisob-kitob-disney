import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@libsql/client";

/**
 * Bir martalik migratsiya endpoint'i — sxema o'zgarishlarini Turso'ga xavfsiz
 * qo'llaydi (mavjudligini tekshirib, faqat yetishmaganini qo'shadi; jadval
 * qayta qurmaydi). Runtime env (DATABASE_URL/AUTH_TOKEN) Vercel'da mavjud.
 * Kalit bilan himoyalangan; idempotent — qayta chaqirish zararsiz.
 */
const KEY = "batch1-2026-07-migrate";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const key = new URL(request.url).searchParams.get("key");
  if (key !== KEY) return NextResponse.json({ error: "forbidden" }, { status: 401 });

  const url = process.env.DATABASE_URL;
  if (!url) return NextResponse.json({ error: "DATABASE_URL yo'q" }, { status: 500 });
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });

  const applied: string[] = [];

  async function tableExists(name: string): Promise<boolean> {
    const r = await client.execute({
      sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
      args: [name],
    });
    return r.rows.length > 0;
  }
  async function columnExists(table: string, col: string): Promise<boolean> {
    const r = await client.execute(`PRAGMA table_info("${table}")`);
    return r.rows.some((row) => String((row as Record<string, unknown>).name) === col);
  }

  try {
    if (!(await columnExists("Transaction", "deletedAt"))) {
      await client.execute('ALTER TABLE "Transaction" ADD COLUMN "deletedAt" DATETIME');
      await client.execute('CREATE INDEX IF NOT EXISTS "Transaction_deletedAt_idx" ON "Transaction"("deletedAt")');
      applied.push("Transaction.deletedAt");
    }
    if (!(await columnExists("User", "lastLoginAt"))) {
      await client.execute('ALTER TABLE "User" ADD COLUMN "lastLoginAt" DATETIME');
      applied.push("User.lastLoginAt");
    }
    if (!(await columnExists("User", "mustChangePassword"))) {
      await client.execute('ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false');
      applied.push("User.mustChangePassword");
    }
    if (!(await tableExists("AuditLog"))) {
      await client.execute(`CREATE TABLE "AuditLog" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "businessId" TEXT,
        "userId" TEXT,
        "userIsm" TEXT,
        "action" TEXT NOT NULL,
        "entity" TEXT NOT NULL,
        "entityId" TEXT NOT NULL,
        "before" TEXT,
        "after" TEXT,
        "ip" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      await client.execute('CREATE INDEX IF NOT EXISTS "AuditLog_businessId_idx" ON "AuditLog"("businessId")');
      await client.execute('CREATE INDEX IF NOT EXISTS "AuditLog_entity_idx" ON "AuditLog"("entity")');
      await client.execute('CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt")');
      applied.push("AuditLog");
    }
    if (!(await tableExists("Budget"))) {
      await client.execute(`CREATE TABLE "Budget" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "businessId" TEXT NOT NULL,
        "categoryId" TEXT NOT NULL,
        "oy" TEXT NOT NULL,
        "limitSumma" INTEGER NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Budget_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "Budget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )`);
      await client.execute('CREATE INDEX IF NOT EXISTS "Budget_businessId_oy_idx" ON "Budget"("businessId", "oy")');
      await client.execute('CREATE UNIQUE INDEX IF NOT EXISTS "Budget_categoryId_oy_key" ON "Budget"("categoryId", "oy")');
      applied.push("Budget");
    }

    // Migratsiyalarni _applied_migrations'da belgilaymiz (db:apply keyin qayta urinмasin).
    await client.execute(
      "CREATE TABLE IF NOT EXISTS _applied_migrations (name TEXT PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP)"
    );
    for (const m of ["20260722062752_init", "20260722135458_ombor", "20260724051808_features_batch1"]) {
      await client.execute({ sql: "INSERT OR IGNORE INTO _applied_migrations (name) VALUES (?)", args: [m] });
    }

    const state = {
      "Transaction.deletedAt": await columnExists("Transaction", "deletedAt"),
      "User.lastLoginAt": await columnExists("User", "lastLoginAt"),
      "User.mustChangePassword": await columnExists("User", "mustChangePassword"),
      AuditLog: await tableExists("AuditLog"),
      Budget: await tableExists("Budget"),
    };

    return NextResponse.json({ ok: true, applied, state });
  } catch (e) {
    return NextResponse.json({ error: String(e), applied }, { status: 500 });
  }
}
