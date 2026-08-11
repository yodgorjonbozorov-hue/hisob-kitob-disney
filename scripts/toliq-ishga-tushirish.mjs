/**
 * TO'LIQ ISHGA TUSHIRISH — Frankfurtga ko'chirishning HAMMA qadami bitta buyruqda.
 *
 *   TURSO_API_TOKEN=... VERCEL_TOKEN=... npm run launch
 *
 * Nima qiladi (tartib bilan, har qadam oldingisiga bog'liq):
 *   1. Turso'da Frankfurt guruhida yangi baza yaratadi (bor bo'lsa — qayta ishlatadi)
 *   2. Ma'lumotni ko'chiradi — `scripts/kochirish.mjs` (zaxira → migratsiya →
 *      tiklash → ikkala jonli bazani solishtirish; eski bazaga faqat o'qish)
 *   3. Vercel'da DATABASE_URL/DATABASE_AUTH_TOKEN ni yangisiga almashtiradi
 *   4. Funksiya regionini fra1 qiladi
 *   5. Production'ni qayta deploy qilib, tayyor bo'lishini kutadi
 *   6. Saytni tekshiradi (health-check)
 *   7. Tekshiruv YIQILSA — env'ni ESKI qiymatlarga o'zi qaytarib, qayta
 *      deploy qiladi (avtomatik rollback) va xato bilan to'xtaydi
 *
 * Kerakli sekretlar (ikkalasini faqat egasi bera oladi):
 *   TURSO_API_TOKEN — Turso dashboard → Account → API Tokens
 *   VERCEL_TOKEN    — Vercel → Account Settings → Tokens
 * Eski baza — DATABASE_URL / DATABASE_AUTH_TOKEN (Vercel env'dagi joriy qiymatlar).
 *
 * Ixtiyoriy: TURSO_ORG (bitta bo'lsa o'zi topadi), TURSO_GURUH=frankfurt,
 * TURSO_REGION=fra, YANGI_BAZA_NOMI=balansa-fra, VERCEL_PROJECT_NAME (bitta
 * bo'lsa o'zi topadi), VERCEL_REGION=fra1, SAYT_URL, YANGI_DATABASE_URL
 * (bazani o'zingiz yaratgan bo'lsangiz — Turso qadami o'tkazib yuboriladi).
 *
 * Pul-ma'lumot xavfsizligi kochirish.mjs ichida: yangi baza bo'sh bo'lishi
 * shart, eski baza faqat o'qiladi, sonlar/summalar mustaqil solishtiriladi.
 * Bu skriptning o'zi eski bazaga umuman ulanmaydi.
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";

const YASHIL = "\x1b[32m";
const QIZIL = "\x1b[31m";
const SARIQ = "\x1b[33m";
const TOZA = "\x1b[0m";
const ok = (m) => console.log(`${YASHIL}✓${TOZA} ${m}`);
const xato = (m) => console.error(`${QIZIL}✗${TOZA} ${m}`);
const ogoh = (m) => console.log(`${SARIQ}⚠${TOZA}  ${m}`);
const bolim = (n, t) => console.log(`\n${"─".repeat(60)}\n${n}. ${t}\n${"─".repeat(60)}`);

function toxta(sabab, yechim) {
  xato(sabab);
  if (yechim) console.error(`\n${SARIQ}Yechim:${TOZA} ${yechim}`);
  process.exit(1);
}

const TURSO_API = process.env.TURSO_API_URL || "https://api.turso.tech";
const VERCEL_API = process.env.VERCEL_API_URL || "https://api.vercel.com";
const KUTISH_MS = Number(process.env.LAUNCH_KUTISH_MS || 10_000);
const TIMEOUT_MS = Number(process.env.LAUNCH_TIMEOUT_MS || 900_000);

/** JSON so'rov; xato bo'lsa javob matni bilan istisno otadi. */
async function soratish(url, token, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const matn = await res.text();
  let body;
  try {
    body = matn ? JSON.parse(matn) : {};
  } catch {
    body = { xom: matn };
  }
  if (!res.ok) {
    const e = new Error(`${res.status} ${matn.slice(0, 300)}`);
    e.status = res.status;
    e.body = body;
    throw e;
  }
  return body;
}

// ─────────────────────────── 1. Turso: yangi baza ───────────────────────────

async function yangiBazaniTayyorla() {
  bolim(1, "Turso: Frankfurt bazasi");

  if (process.env.YANGI_DATABASE_URL) {
    ok("YANGI_DATABASE_URL berilgan — Turso qadami o'tkazib yuborildi.");
    return {
      url: process.env.YANGI_DATABASE_URL,
      token: process.env.YANGI_DATABASE_AUTH_TOKEN,
    };
  }

  const apiToken = process.env.TURSO_API_TOKEN;
  const guruh = process.env.TURSO_GURUH || "frankfurt";
  const region = process.env.TURSO_REGION || "fra";
  const nom = process.env.YANGI_BAZA_NOMI || "balansa-fra";

  // Tashkilot: berilmagan bo'lsa — ro'yxatda bitta bo'lsa o'sha.
  let org = process.env.TURSO_ORG;
  if (!org) {
    const orglar = await soratish(`${TURSO_API}/v1/organizations`, apiToken);
    const royxat = Array.isArray(orglar) ? orglar : orglar.organizations || [];
    if (royxat.length !== 1) {
      toxta(
        `Turso'da ${royxat.length} ta tashkilot topildi: ${royxat.map((o) => o.slug).join(", ") || "(bo'sh)"}`,
        "TURSO_ORG sekretida qaysi biri ekanini ko'rsating."
      );
    }
    org = royxat[0].slug;
  }
  ok(`Tashkilot: ${org}`);

  // Guruh: yo'q bo'lsa Frankfurtda yaratiladi.
  const guruhlar = await soratish(`${TURSO_API}/v1/organizations/${org}/groups`, apiToken);
  const bor = (guruhlar.groups || []).some((g) => g.name === guruh);
  if (!bor) {
    await soratish(`${TURSO_API}/v1/organizations/${org}/groups`, apiToken, {
      method: "POST",
      body: JSON.stringify({ name: guruh, location: region }),
    });
    ok(`Guruh yaratildi: ${guruh} (${region})`);
  } else {
    ok(`Guruh bor: ${guruh}`);
  }

  // Baza: 409 (bor) bo'lsa qayta ishlatiladi — bo'shligini baribir
  // kochirish.mjs tekshiradi, ma'lumotli bazaga hech narsa yozilmaydi.
  let hostname;
  try {
    const javob = await soratish(`${TURSO_API}/v1/organizations/${org}/databases`, apiToken, {
      method: "POST",
      body: JSON.stringify({ name: nom, group: guruh }),
    });
    hostname = javob.database?.Hostname;
    ok(`Baza yaratildi: ${nom}`);
  } catch (e) {
    if (e.status !== 409) throw e;
    const javob = await soratish(
      `${TURSO_API}/v1/organizations/${org}/databases/${nom}`,
      apiToken
    );
    hostname = javob.database?.Hostname;
    ogoh(`Baza allaqachon bor: ${nom} — qayta ishlatiladi (bo'shligi keyin tekshiriladi).`);
  }
  if (!hostname) toxta("Turso javobida Hostname yo'q — API o'zgargan bo'lishi mumkin.");

  const tokenJavob = await soratish(
    `${TURSO_API}/v1/organizations/${org}/databases/${nom}/auth/tokens`,
    apiToken,
    { method: "POST" }
  );
  if (!tokenJavob.jwt) toxta("Turso token javobida jwt yo'q.");
  ok("Baza uchun token olindi.");

  return { url: `libsql://${hostname}`, token: tokenJavob.jwt };
}

// ─────────────────────────── 3-6. Vercel amallari ───────────────────────────

async function loyihaniTop(vt) {
  const javob = await soratish(`${VERCEL_API}/v9/projects?limit=100`, vt);
  const loyihalar = javob.projects || [];
  const istalgan = process.env.VERCEL_PROJECT_NAME;
  if (istalgan) {
    const p = loyihalar.find((x) => x.name === istalgan);
    if (!p) {
      toxta(
        `Vercel'da "${istalgan}" loyihasi topilmadi. Bor: ${loyihalar.map((x) => x.name).join(", ")}`
      );
    }
    return p;
  }
  if (loyihalar.length !== 1) {
    toxta(
      `Vercel'da ${loyihalar.length} ta loyiha bor: ${loyihalar.map((x) => x.name).join(", ") || "(bo'sh)"}`,
      "VERCEL_PROJECT_NAME sekretida qaysi biri ekanini ko'rsating."
    );
  }
  return loyihalar[0];
}

async function envYoz(vt, loyihaId, url, token) {
  const qiymatlar = [
    { key: "DATABASE_URL", value: url, type: "encrypted", target: ["production", "preview"] },
    {
      key: "DATABASE_AUTH_TOKEN",
      value: token ?? "",
      type: "encrypted",
      target: ["production", "preview"],
    },
  ];
  await soratish(`${VERCEL_API}/v10/projects/${loyihaId}/env?upsert=true`, vt, {
    method: "POST",
    body: JSON.stringify(qiymatlar),
  });
}

async function deployQil(vt, loyiha) {
  const repoId = loyiha.link?.repoId;
  if (!repoId) {
    toxta(
      "Loyiha GitHub'ga ulanmagan (link.repoId yo'q) — API orqali redeploy qilib bo'lmaydi.",
      "Vercel'da Deployments → Redeploy tugmasini qo'lda bosing."
    );
  }
  const ref = loyiha.link?.productionBranch || "main";
  const javob = await soratish(`${VERCEL_API}/v13/deployments`, vt, {
    method: "POST",
    body: JSON.stringify({
      name: loyiha.name,
      project: loyiha.id,
      target: "production",
      gitSource: { type: "github", repoId, ref },
    }),
  });
  return javob;
}

async function deployniKut(vt, id) {
  const boshlandi = Date.now();
  for (;;) {
    const d = await soratish(`${VERCEL_API}/v13/deployments/${id}`, vt);
    const holat = d.readyState || d.status;
    if (holat === "READY") return d;
    if (holat === "ERROR" || holat === "CANCELED") {
      throw new Error(`Deploy ${holat} holatida tugadi.`);
    }
    if (Date.now() - boshlandi > TIMEOUT_MS) {
      throw new Error(`Deploy ${TIMEOUT_MS / 60000} daqiqada tayyor bo'lmadi.`);
    }
    await new Promise((r) => setTimeout(r, KUTISH_MS));
  }
}

async function saytniTekshir(saytUrl, region) {
  const res = await fetch(`${saytUrl}/login`, { redirect: "follow" });
  if (!res.ok) throw new Error(`Sayt ${res.status} qaytardi (${saytUrl}/login).`);
  const vercelId = res.headers.get("x-vercel-id") || "";
  if (vercelId && !vercelId.includes(region)) {
    ogoh(`x-vercel-id "${vercelId}" — ${region} ko'rinmayapti (region keshda kechikishi mumkin).`);
  } else if (vercelId) {
    ok(`Region tasdiqlandi: ${vercelId}`);
  }
}

// ─────────────────────────────────── Oqim ───────────────────────────────────

async function main() {
  console.log("\n🚀 BALANSA — to'liq ishga tushirish (Frankfurt)\n");

  const vt = process.env.VERCEL_TOKEN;
  const eskiUrl = process.env.DATABASE_URL;
  const eskiToken = process.env.DATABASE_AUTH_TOKEN;

  if (!eskiUrl) toxta("DATABASE_URL (eski baza) berilmagan.");
  if (!vt) {
    toxta(
      "VERCEL_TOKEN berilmagan.",
      "Vercel → Account Settings → Tokens'dan yarating va sekretga qo'ying."
    );
  }
  if (!process.env.TURSO_API_TOKEN && !process.env.YANGI_DATABASE_URL) {
    toxta(
      "TURSO_API_TOKEN berilmagan.",
      "Turso dashboard → Account → API Tokens'dan yarating va sekretga qo'ying " +
        "(yoki bazani o'zingiz yaratib YANGI_DATABASE_URL bering)."
    );
  }

  // Vercel loyihasi OLDINDAN topiladi — ko'chirishdan keyin "loyiha topilmadi"
  // deb qolish ko'chirilgan-lekin-ulanmagan oraliq holat yaratadi.
  const loyiha = await loyihaniTop(vt);
  ok(`Vercel loyihasi: ${loyiha.name}`);

  const yangi = await yangiBazaniTayyorla();

  bolim(2, "Ma'lumotni ko'chirish (kochirish.mjs)");
  const env = { ...process.env, YANGI_DATABASE_URL: yangi.url };
  delete env.YANGI_DATABASE_AUTH_TOKEN;
  if (yangi.token) env.YANGI_DATABASE_AUTH_TOKEN = yangi.token;
  // Test seam: sinovda soxta ko'chirish skripti qo'yiladi (API oqimini
  // haqiqiy Turso'siz sinash uchun); production'da har doim asl skript.
  const kochirishSkript = process.env.LAUNCH_KOCHIRISH_SKRIPT || "scripts/kochirish.mjs";
  const res = spawnSync(process.execPath, [kochirishSkript], {
    stdio: "inherit",
    env,
    shell: false,
  });
  if (res.status !== 0) {
    toxta(
      "Ko'chirish muvaffaqiyatsiz — yuqoridagi log'da sabab yozilgan.",
      "Eski bazaga va Vercel'ga TEGILMAGAN, sayt avvalgidek ishlayapti. " +
        "Sababni tuzatib qayta ishga tushiring."
    );
  }

  bolim(3, "Vercel: env almashtirish");
  await envYoz(vt, loyiha.id, yangi.url, yangi.token);
  ok("DATABASE_URL va DATABASE_AUTH_TOKEN yangilandi.");

  bolim(4, "Vercel: funksiya regioni");
  const region = process.env.VERCEL_REGION || "fra1";
  try {
    await soratish(`${VERCEL_API}/v9/projects/${loyiha.id}`, vt, {
      method: "PATCH",
      body: JSON.stringify({ serverlessFunctionRegion: region }),
    });
    ok(`Region: ${region}`);
  } catch (e) {
    // Region tezlik masalasi, to'g'rilik emas — oqim to'xtatilmaydi.
    ogoh(`Regionni API bilan o'zgartirib bo'lmadi (${e.message}).`);
    ogoh(`Qo'lda: Settings → Functions → Function Region → ${region}.`);
  }

  bolim(5, "Deploy va tekshiruv");
  const saytUrl = process.env.SAYT_URL || `https://${loyiha.name}.vercel.app`;
  try {
    const d = await deployQil(vt, loyiha);
    ok(`Deploy boshlandi: ${d.id}`);
    await deployniKut(vt, d.id);
    ok("Deploy tayyor.");
    await saytniTekshir(saytUrl, region);
    ok(`Sayt ishlayapti: ${saytUrl}`);
  } catch (e) {
    // ROLLBACK: yangi baza bilan sayt ko'tarilmadi — eski env qaytariladi.
    xato(`Tekshiruv yiqildi: ${e.message}`);
    ogoh("Env ESKI qiymatlarga qaytarilyapti (avtomatik rollback)...");
    await envYoz(vt, loyiha.id, eskiUrl, eskiToken);
    try {
      const orqaga = await deployQil(vt, loyiha);
      await deployniKut(vt, orqaga.id);
      ogoh("Rollback deploy tayyor — sayt ESKI bazada ishlashda davom etadi.");
    } catch (e2) {
      xato(`Rollback deploy ham yiqildi: ${e2.message}`);
      console.error("Vercel'da qo'lda Redeploy bosing — env allaqachon eski qiymatda.");
    }
    toxta(
      "Ko'chirish bekor qilindi, ma'lumot yo'qolmagan.",
      "Log'dagi sababni ko'ring. Yangi baza Turso'da turibdi — qayta urinish xavfsiz."
    );
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`${YASHIL}✅ TO'LIQ ISHGA TUSHDI.${TOZA}`);
  console.log(`${"═".repeat(60)}\n`);
  console.log(`Sayt: ${saytUrl} — yangi (Frankfurt) bazada, region: ${region}.`);
  console.log("Eski bazaga tegilmagan — kamida 2 hafta O'CHIRMANG (orqaga yo'l).");
  console.log("Endi saytda login qilib, dashboard va bitta kirimni ko'zdan kechiring.");
  console.log("Qolgan ixtiyoriy qadam: balansa.uz domeni (ISHGA-TUSHIRISH.md, 5-qadam).\n");
}

main().catch((e) => toxta(`Kutilmagan xato: ${e.message}`));
