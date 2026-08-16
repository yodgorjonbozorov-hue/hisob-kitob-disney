/**
 * TO'LIQ ISHGA TUSHIRISH — `npm run launch` (scripts/toliq-ishga-tushirish.mjs).
 *
 * Haqiqiy Turso/Vercel'ga tegib bo'lmaydi, shuning uchun ikkala API va sayt
 * SOXTA HTTP server bilan taqlid qilinadi (deploy-zaxira testidagi Telegram
 * uslubi). Har so'rov yozib boriladi — testlar skript API'larni AYNAN qaysi
 * tartibda va qaysi qiymatlar bilan chaqirganini tekshiradi.
 *
 * Sinaladigan himoyalar:
 *  - tokenlar yo'q bo'lsa umuman boshlanmasligi (fail-closed);
 *  - Turso yo'li: guruh + baza + token yaratilib, env'ga AYNAN yangi URL yozilishi;
 *  - ko'chirish yiqilsa Vercel'ga UMUMAN tegilmasligi;
 *  - to'liq oqim haqiqiy ma'lumot bilan (file: bazalar, asl kochirish.mjs);
 *  - health-check yiqilsa env ESKI qiymatlarga qaytarilishi (rollback).
 *
 * MUHIM: soxta server shu test jarayonining o'zida turadi, shuning uchun
 * launch skripti `spawn` (async) bilan ishga tushiriladi — `spawnSync`
 * ota jarayonni bloklab, server ulanish qabul qila olmay DEADLOCK bo'ladi
 * (bu tuzoq deploy-zaxira testida bir marta bosilgan).
 *
 * Ishga tushirish: npm run test:launch
 */
process.env.DATABASE_URL = "file:./prisma/test-launch-eski.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import { readdirSync, readFileSync, existsSync, rmSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
// Faqat tip (runtime'da o'chib ketadi) — `c.execute` argumentlari uchun.
import type { InArgs } from "@libsql/client";

const ESKI_DB = "prisma/test-launch-eski.db";
const YANGI_DB = "prisma/test-launch-yangi.db";
const SURAT = "prisma/backups/test-launch-surat.json";

// ─────────────────────────── Soxta serverlar ───────────────────────────

type Sorov = { method: string; url: string; body: string };
const sorovlar: Sorov[] = [];
const holat = { saytStatus: 200, sayt2Status: 200, deployUrlBer: false };
let server: Server;
let baza = "";

function soxtaServer(): Promise<void> {
  server = createServer((req, res) => {
    let tana = "";
    req.on("data", (c) => (tana += c));
    req.on("end", () => {
      sorovlar.push({ method: req.method!, url: req.url!, body: tana });
      const j = (kod: number, obj: unknown, sarlavha: Record<string, string> = {}) => {
        res.writeHead(kod, { "Content-Type": "application/json", ...sarlavha });
        res.end(JSON.stringify(obj));
      };
      const u = req.url!;
      // ---- Turso ----
      if (u === "/v1/organizations" && req.method === "GET")
        return j(200, [{ slug: "balansa" }]);
      if (u === "/v1/organizations/balansa/groups" && req.method === "GET")
        return j(200, { groups: [] });
      if (u === "/v1/organizations/balansa/groups" && req.method === "POST") return j(200, {});
      if (u === "/v1/organizations/balansa/databases" && req.method === "POST")
        return j(200, { database: { Hostname: "balansa-fra-balansa.turso.io" } });
      if (u === "/v1/organizations/balansa/databases/balansa-fra/auth/tokens")
        return j(200, { jwt: "jwt-sinov" });
      // ---- Vercel ----
      if (u === "/v9/projects?limit=100")
        return j(200, {
          projects: [
            {
              id: "prj_1",
              name: "hisob-kitob-disneyn1",
              link: { type: "github", repoId: 777, productionBranch: "main" },
            },
          ],
        });
      if (u === "/v10/projects/prj_1/env?upsert=true") return j(200, {});
      if (u === "/v9/projects/prj_1" && req.method === "PATCH") return j(200, {});
      if (u === "/v13/deployments" && req.method === "POST")
        return j(200, { id: "dpl_1", readyState: "QUEUED" });
      if (u === "/v13/deployments/dpl_1")
        return j(200, {
          readyState: "READY",
          ...(holat.deployUrlBer ? { url: `${baza}/sayt2` } : {}),
        });
      // ---- Sayt (alias) va deployment URL ----
      if (u === "/sayt/login")
        return j(holat.saytStatus, { ok: holat.saytStatus === 200 }, { "x-vercel-id": "fra1::abc" });
      if (u === "/sayt2/login")
        return j(holat.sayt2Status, { ok: holat.sayt2Status === 200 }, { "x-vercel-id": "fra1::dpl" });
      j(404, { xato: `nomalum yol: ${u}` });
    });
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r()));
}

// ─────────────────────────── Yordamchilar ───────────────────────────

/** launch skriptini ASYNC ishga tushiradi (deadlock bo'lmasin). */
function launch(env: Record<string, string | undefined>): Promise<{
  status: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((hal) => {
    const bola = spawn(process.execPath, ["scripts/toliq-ishga-tushirish.mjs"], {
      env: {
        ...process.env,
        DATABASE_URL: `file:./${ESKI_DB}`,
        TURSO_API_URL: baza,
        VERCEL_API_URL: baza,
        SAYT_URL: `${baza}/sayt`,
        VERCEL_TOKEN: "vt-sinov",
        LAUNCH_KUTISH_MS: "25",
        LAUNCH_TIMEOUT_MS: "5000",
        KOCHIRISH_SURAT: SURAT,
        ...env,
      },
    });
    let stdout = "";
    let stderr = "";
    bola.stdout.on("data", (c) => (stdout += c));
    bola.stderr.on("data", (c) => (stderr += c));
    bola.on("close", (status) => hal({ status, stdout, stderr }));
  });
}

/** Soxta ko'chirish skriptlari (API oqimini haqiqiy bazasiz sinash uchun). */
const stubDir = mkdtempSync(join(tmpdir(), "launch-stub-"));
const STUB_OK = join(stubDir, "ok.mjs");
const STUB_XATO = join(stubDir, "xato.mjs");
writeFileSync(STUB_OK, "console.log('stub: kochirish OK'); process.exit(0);\n");
writeFileSync(STUB_XATO, "console.error('stub: kochirish yiqildi'); process.exit(1);\n");

function tozala() {
  for (const f of [ESKI_DB, YANGI_DB]) {
    rmSync(f, { force: true });
    rmSync(`${f}-journal`, { force: true });
  }
  rmSync(SURAT, { force: true });
}

/** Eski bazani joriy sxema + ma'lumot bilan quradi (to'liq oqim testi uchun). */
async function eskiBazaniQur() {
  const { createClient } = await import("@libsql/client");
  const c = createClient({ url: `file:./${ESKI_DB}` });
  const hammasi = readdirSync("prisma/migrations")
    .filter((d) => existsSync(join("prisma/migrations", d, "migration.sql")))
    .sort();
  await c.execute(
    "CREATE TABLE IF NOT EXISTS _applied_migrations (name TEXT PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP)"
  );
  for (const d of hammasi) {
    await c.executeMultiple(readFileSync(join("prisma/migrations", d, "migration.sql"), "utf8"));
    await c.execute({ sql: "INSERT INTO _applied_migrations (name) VALUES (?)", args: [d] });
  }
  const iso = (s: string) => new Date(s).toISOString();
  const q = (sql: string, args: InArgs = []) => c.execute({ sql, args });
  await q(
    `INSERT INTO "Tenant" ("id","name","slug","status","plan","createdAt","updatedAt")
     VALUES ('T1','Alfa','alfa','ACTIVE','PRO',?,?)`,
    [iso("2026-07-01"), iso("2026-07-01")]
  );
  await q(
    `INSERT INTO "Business" ("id","nomi","isActive","omborli","turi","createdAt","tenantId")
     VALUES ('B1','Alfa do''kon',1,1,'umumiy',?,'T1')`,
    [iso("2026-07-01")]
  );
  await q(
    `INSERT INTO "User" ("id","ism","login","parolHash","rol","isActive","createdAt","mustChangePassword","tenantId")
     VALUES ('U1','Egasi','+998901000001','h','OWNER',1,?,0,'T1')`,
    [iso("2026-07-01")]
  );
  await q(
    `INSERT INTO "Category" ("id","nomi","turi","tartib","isActive","createdAt","businessId")
     VALUES ('C1','Sotuv','kirim',0,1,?,'B1')`,
    [iso("2026-07-01")]
  );
  await q(
    `INSERT INTO "Account" ("id","businessId","nomi","turi","isActive","tartib","createdAt")
     VALUES ('A1','B1','Naqd kassa','naqd',1,0,?)`,
    [iso("2026-07-01")]
  );
  for (let i = 1; i <= 5; i++) {
    await q(
      `INSERT INTO "Transaction" ("id","turi","categoryId","businessId","accountId","summa","sana","userId","createdAt")
       VALUES (?,'kirim','C1','B1','A1',?,?,'U1',?)`,
      [`TX${i}`, 100_000 * i, iso("2026-07-10"), iso("2026-07-10")]
    );
  }
  c.close?.();
}

before(async () => {
  tozala();
  await soxtaServer();
  const manzil = server.address() as { port: number };
  baza = `http://127.0.0.1:${manzil.port}`;
  await eskiBazaniQur();
});

after(() => {
  server?.close();
  tozala();
  rmSync(stubDir, { recursive: true, force: true });
});

// ─────────────────────────────── Testlar ───────────────────────────────

test("VERCEL_TOKEN yo'q — hech qanday API chaqirilmaydi (fail-closed)", async () => {
  sorovlar.length = 0;
  const r = await launch({ VERCEL_TOKEN: undefined, TURSO_API_TOKEN: "tt" });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /VERCEL_TOKEN/);
  assert.equal(sorovlar.length, 0);
});

test("TURSO_API_TOKEN ham, YANGI_DATABASE_URL ham yo'q — to'xtaydi", async () => {
  sorovlar.length = 0;
  const r = await launch({});
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /TURSO_API_TOKEN/);
  assert.equal(sorovlar.length, 0);
});

test("Turso yo'li: guruh+baza+token yaratiladi, env'ga aynan yangi URL yoziladi", async () => {
  sorovlar.length = 0;
  const r = await launch({ TURSO_API_TOKEN: "tt", LAUNCH_KOCHIRISH_SKRIPT: STUB_OK });
  assert.equal(r.status, 0, `launch yiqildi:\n${r.stdout}\n${r.stderr}`);

  const yollar = sorovlar.map((s) => `${s.method} ${s.url}`);
  assert.ok(yollar.includes("POST /v1/organizations/balansa/groups"), "guruh yaratilmadi");
  assert.ok(yollar.includes("POST /v1/organizations/balansa/databases"), "baza yaratilmadi");
  assert.ok(
    yollar.includes("POST /v1/organizations/balansa/databases/balansa-fra/auth/tokens"),
    "token olinmadi"
  );

  const envSorov = sorovlar.find((s) => s.url === "/v10/projects/prj_1/env?upsert=true");
  assert.ok(envSorov, "Vercel env yozilmadi");
  const envTana = JSON.parse(envSorov!.body);
  assert.equal(
    envTana.find((e: any) => e.key === "DATABASE_URL").value,
    "libsql://balansa-fra-balansa.turso.io"
  );
  assert.equal(envTana.find((e: any) => e.key === "DATABASE_AUTH_TOKEN").value, "jwt-sinov");

  const deploy = sorovlar.find((s) => s.method === "POST" && s.url === "/v13/deployments");
  assert.ok(deploy, "redeploy chaqirilmadi");
  const deployTana = JSON.parse(deploy!.body);
  assert.equal(deployTana.gitSource.repoId, 777);
  assert.equal(deployTana.gitSource.ref, "main");
  assert.ok(yollar.includes("PATCH /v9/projects/prj_1"), "region PATCH chaqirilmadi");
});

test("ko'chirish yiqilsa — Vercel env'ga UMUMAN tegilmaydi", async () => {
  sorovlar.length = 0;
  const r = await launch({ TURSO_API_TOKEN: "tt", LAUNCH_KOCHIRISH_SKRIPT: STUB_XATO });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Ko'chirish muvaffaqiyatsiz/);
  const vercelYozuvlar = sorovlar.filter(
    (s) => s.url.startsWith("/v10/") || (s.method === "PATCH" && s.url.startsWith("/v9/")) || s.url.startsWith("/v13/")
  );
  assert.equal(vercelYozuvlar.length, 0, "Vercel'ga yozuv ketgan!");
});

test("to'liq oqim: haqiqiy ma'lumot file: bazalar orqali ko'chadi", async () => {
  sorovlar.length = 0;
  rmSync(YANGI_DB, { force: true });
  const r = await launch({ YANGI_DATABASE_URL: `file:./${YANGI_DB}` });
  assert.equal(r.status, 0, `launch yiqildi:\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /TO'LIQ ISHGA TUSHDI/);

  const { createClient } = await import("@libsql/client");
  const y = createClient({ url: `file:./${YANGI_DB}` });
  const n = Number((await y.execute('SELECT COUNT(*) n FROM "Transaction"')).rows[0].n);
  const sum = Number((await y.execute('SELECT SUM(summa) n FROM "Transaction"')).rows[0].n);
  y.close?.();
  assert.equal(n, 5);
  assert.equal(sum, 1_500_000);

  const envSorov = sorovlar.find((s) => s.url === "/v10/projects/prj_1/env?upsert=true");
  assert.ok(envSorov, "env yozilmadi");
  assert.equal(
    JSON.parse(envSorov!.body).find((e: any) => e.key === "DATABASE_URL").value,
    `file:./${YANGI_DB}`
  );
});

test("alias yiqilsa lekin deployment URL ishlasa — muvaffaqiyat, rollback YO'Q", async () => {
  // Host-darajali redirect (eski vercel.app → balansa.uz) ostidagi alias
  // domen DNS'da bo'lmasa yiqiladi — bu baza ko'chirishning aybi emas.
  sorovlar.length = 0;
  holat.saytStatus = 500;
  holat.deployUrlBer = true;
  try {
    const r = await launch({ TURSO_API_TOKEN: "tt", LAUNCH_KOCHIRISH_SKRIPT: STUB_OK });
    assert.equal(r.status, 0, `launch yiqildi:\n${r.stdout}\n${r.stderr}`);
    assert.match(r.stdout, /alias\/domen masalasi/);
    const envSorovlar = sorovlar.filter((s) => s.url === "/v10/projects/prj_1/env?upsert=true");
    assert.equal(envSorovlar.length, 1, "rollback bo'lmasligi kerak edi");
  } finally {
    holat.saytStatus = 200;
    holat.deployUrlBer = false;
  }
});

test("health-check yiqilsa — env ESKI qiymatlarga qaytadi (rollback)", async () => {
  sorovlar.length = 0;
  holat.saytStatus = 500;
  try {
    const r = await launch({ TURSO_API_TOKEN: "tt", LAUNCH_KOCHIRISH_SKRIPT: STUB_OK });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /Tekshiruv yiqildi|bekor qilindi/);

    const envSorovlar = sorovlar.filter((s) => s.url === "/v10/projects/prj_1/env?upsert=true");
    assert.equal(envSorovlar.length, 2, "rollback env yozuvi yo'q");
    const oxirgi = JSON.parse(envSorovlar[1].body);
    assert.equal(
      oxirgi.find((e: any) => e.key === "DATABASE_URL").value,
      `file:./${ESKI_DB}`,
      "rollback eski URL'ni qaytarmadi"
    );

    const deploylar = sorovlar.filter((s) => s.method === "POST" && s.url === "/v13/deployments");
    assert.equal(deploylar.length, 2, "rollback redeploy chaqirilmadi");
  } finally {
    holat.saytStatus = 200;
  }
});
