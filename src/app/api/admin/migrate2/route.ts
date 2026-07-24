import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@libsql/client";

/** Bir martalik batch2 migratsiyasi (ShiftClose + RecurringTransaction). Kalit bilan, idempotent. */
const KEY = "batch2-2026-07-migrate";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const key = new URL(request.url).searchParams.get("key");
  if (key !== KEY) return NextResponse.json({ error: "forbidden" }, { status: 401 });

  const url = process.env.DATABASE_URL;
  if (!url) return NextResponse.json({ error: "DATABASE_URL yo'q" }, { status: 500 });
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  const applied: string[] = [];

  async function tableExists(name: string): Promise<boolean> {
    const r = await client.execute({ sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?", args: [name] });
    return r.rows.length > 0;
  }

  try {
    if (!(await tableExists("ShiftClose"))) {
      await client.execute(`CREATE TABLE "ShiftClose" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "businessId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "userIsm" TEXT,
        "sana" DATETIME NOT NULL,
        "kutilganNaqd" INTEGER NOT NULL,
        "sanalganNaqd" INTEGER NOT NULL,
        "farq" INTEGER NOT NULL,
        "izoh" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ShiftClose_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )`);
      await client.execute('CREATE INDEX IF NOT EXISTS "ShiftClose_businessId_sana_idx" ON "ShiftClose"("businessId", "sana")');
      applied.push("ShiftClose");
    }
    if (!(await tableExists("RecurringTransaction"))) {
      await client.execute(`CREATE TABLE "RecurringTransaction" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "businessId" TEXT NOT NULL,
        "categoryId" TEXT NOT NULL,
        "turi" TEXT NOT NULL,
        "summa" INTEGER NOT NULL,
        "izoh" TEXT,
        "kun" INTEGER NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "lastGenerated" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "RecurringTransaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "RecurringTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )`);
      await client.execute('CREATE INDEX IF NOT EXISTS "RecurringTransaction_businessId_idx" ON "RecurringTransaction"("businessId")');
      applied.push("RecurringTransaction");
    }
    await client.execute("CREATE TABLE IF NOT EXISTS _applied_migrations (name TEXT PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP)");
    await client.execute({ sql: "INSERT OR IGNORE INTO _applied_migrations (name) VALUES (?)", args: ["20260724114014_features_batch2"] });

    return NextResponse.json({
      ok: true,
      applied,
      state: { ShiftClose: await tableExists("ShiftClose"), RecurringTransaction: await tableExists("RecurringTransaction") },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e), applied }, { status: 500 });
  }
}
