/**
 * HUQUQ OSHIRISH (PRIVILEGE ESCALATION) HIMOYASI.
 *
 * 2026-09-02 auditining #1 xavfi: `bazaRol = ADMIN` bilan ishlaydigan
 * administrator kompaniyani EGALLAB olardi — o'ziga OWNER berib, direktorning
 * parolini almashtirib yoki uni nofaollashtirib. Endi OWNER darajasi alohida
 * qo'riqlanadi (`lib/services/userGuard.ts`).
 *
 * Qo'riqlanadigan qoidalar:
 *   1. OWNER rolini FAQAT OWNER bera oladi (maxsus rolning `bazaRol` i orqali ham);
 *   2. OWNER hisobiga (parol/login/rol/faollik/o'chirish) FAQAT OWNER tegadi;
 *   3. hech kim O'Z rolini o'zi o'zgartira olmaydi;
 *   4. kompaniyada kamida bitta FAOL OWNER qoladi — ADMIN bu hisobga kirmaydi;
 *   5. maxsus rol (`Role.bazaRol`) orqali OWNER berish yo'li YOPIQ;
 *   6. rad etilgan urinish audit jurnaliga tushadi.
 *
 * Ishga tushirish: npm run test:eskalatsiya
 * Alohida test bazasi (prisma/test-eskalatsiya.db) — dev/prod bazaga tegmaydi.
 */
process.env.DATABASE_URL = "file:./prisma/test-eskalatsiya.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync, readFileSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: any;
let egalikniQoriqla: any;
let egalikTekshir: any;
let egami: any;
let oxirgiBoshqaruvchiTekshir: any;
let ForbiddenError: any;
let BAZA_ROLLAR: readonly string[];

const T = "t_esk";
const BIZ = "biz_esk";

const EGA = { userId: "u_esk_ega", rol: "OWNER" };
const EGA2 = { userId: "u_esk_ega2", rol: "OWNER" };
const ADMIN = { userId: "u_esk_admin", rol: "ADMIN" };
const KASSIR = { userId: "u_esk_kassir", rol: "CASHIER" };

/** Nishon xodimning bazadagi holati (guard shu shaklni kutadi). */
const holat = (u: { userId: string; rol: string }, isActive = true) => ({
  id: u.userId,
  rol: u.rol,
  isActive,
});

/** Guard ForbiddenError bilan to'xtatishini tasdiqlaydi. */
function radEtilsin(fn: () => void, izoh: string) {
  assert.throws(fn, (e: any) => e instanceof ForbiddenError, izoh);
}

before(async () => {
  rmSync("prisma/test-eskalatsiya.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ egalikniQoriqla, egalikTekshir, egami, oxirgiBoshqaruvchiTekshir } = await import(
    "@/lib/services/userGuard"
  ));
  ({ ForbiddenError } = await import("@/lib/auth/guard"));
  ({ BAZA_ROLLAR } = await import("@/lib/validation/rol"));

  await rawPrisma.tenant.create({
    data: { id: T, name: "Eskalatsiya", slug: "esk", status: "ACTIVE" },
  });
  await rawPrisma.business.create({ data: { id: BIZ, nomi: "Biznes", tenantId: T } });
  for (const u of [EGA, EGA2, ADMIN, KASSIR]) {
    await rawPrisma.user.create({
      data: {
        id: u.userId,
        ism: u.userId,
        login: u.userId,
        parolHash: "x",
        rol: u.rol,
        tenantId: T,
        // Ikkinchi direktor testlar boshida NOFAOL — "yagona ega" holati
        // shu bilan hosil qilinadi, keyin ataylab yoqiladi.
        isActive: u.userId !== EGA2.userId,
      },
    });
  }
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// 1. OWNER ROLINI BERISH
// ---------------------------------------------------------------------------

test("ADMIN yangi xodimga OWNER roli bera OLMAYDI", () => {
  radEtilsin(() => egalikniQoriqla(ADMIN, { yangiRol: "OWNER" }), "yaratishda");
});

test("ADMIN mavjud xodimni OWNER darajasiga ko'tara OLMAYDI", () => {
  radEtilsin(
    () => egalikniQoriqla(ADMIN, { yangiRol: "OWNER", nishon: holat(KASSIR) }),
    "tahrirlashda"
  );
});

test("ADMIN o'ZINI OWNER qila OLMAYDI", () => {
  radEtilsin(() => egalikniQoriqla(ADMIN, { yangiRol: "OWNER", nishon: holat(ADMIN) }), "o'ziga");
});

test("OWNER esa OWNER roli bera OLADI", () => {
  egalikniQoriqla(EGA, { yangiRol: "OWNER" });
  egalikniQoriqla(EGA, { yangiRol: "OWNER", nishon: holat(KASSIR) });
});

// ---------------------------------------------------------------------------
// 2. OWNER HISOBIGA TEGISH
// ---------------------------------------------------------------------------

test("ADMIN direktorning parolini/loginini o'zgartira OLMAYDI", () => {
  // Parol/login o'zgarishi `yangiRol` siz keladi — nishon OWNER bo'lgani
  // uchun guard baribir to'xtatadi.
  radEtilsin(() => egalikniQoriqla(ADMIN, { nishon: holat(EGA) }), "parol/login");
});

test("ADMIN direktorni nofaollashtira yoki o'chira OLMAYDI", () => {
  radEtilsin(() => egalikniQoriqla(ADMIN, { nishon: holat(EGA) }), "nofaollashtirish/o'chirish");
});

test("ADMIN direktorni kassirga tushira OLMAYDI", () => {
  radEtilsin(() => egalikniQoriqla(ADMIN, { yangiRol: "CASHIER", nishon: holat(EGA) }), "tushirish");
});

test("KASSIR ham direktor hisobiga tega olmaydi", () => {
  radEtilsin(() => egalikniQoriqla(KASSIR, { nishon: holat(EGA) }), "kassir");
});

test("OWNER boshqa direktorni tahrirlay oladi", () => {
  egalikniQoriqla(EGA, { nishon: holat(EGA2) });
  egalikniQoriqla(EGA, { yangiRol: "CASHIER", nishon: holat(EGA2) });
});

test("ADMIN kassirni bemalol tahrirlaydi (qoida faqat OWNER darajasiga tegishli)", () => {
  egalikniQoriqla(ADMIN, { nishon: holat(KASSIR) });
  egalikniQoriqla(ADMIN, { yangiRol: "SELLER", nishon: holat(KASSIR) });
});

// ---------------------------------------------------------------------------
// 3. O'Z ROLINI O'ZI O'ZGARTIRISH
// ---------------------------------------------------------------------------

test("hech kim o'z rolini o'zi o'zgartira olmaydi — ADMIN ham, OWNER ham", () => {
  radEtilsin(() => egalikniQoriqla(ADMIN, { yangiRol: "SELLER", nishon: holat(ADMIN) }), "ADMIN");
  radEtilsin(() => egalikniQoriqla(EGA, { yangiRol: "ADMIN", nishon: holat(EGA) }), "OWNER");
});

test("rol O'ZGARMASA o'zini tahrirlash ochiq qoladi (ism/parol)", () => {
  // UI saqlashda joriy rolni ham yuborishi mumkin — bu o'zgarish emas.
  egalikniQoriqla(ADMIN, { yangiRol: "ADMIN", nishon: holat(ADMIN) });
  egalikniQoriqla(ADMIN, { nishon: holat(ADMIN) });
});

test("eski rol qiymati ('admin') OWNER deb o'qiladi", () => {
  assert.equal(egami("admin"), true, "migratsiyagacha yozilgan qiymat");
  assert.equal(egami("OWNER"), true);
  assert.equal(egami("ADMIN"), false, "administrator EGA EMAS");
  assert.equal(egami("CASHIER"), false);
  radEtilsin(
    () => egalikniQoriqla(ADMIN, { nishon: { id: "u_eski", rol: "admin", isActive: true } }),
    "eski qiymatli direktor ham himoyalangan"
  );
});

// ---------------------------------------------------------------------------
// 4. OXIRGI DIREKTOR — ADMIN uni ALMASHTIRMAYDI
// ---------------------------------------------------------------------------

test("yagona faol direktorni nofaollashtirib bo'lmaydi", async () => {
  await assert.rejects(
    () => runWithTenant(T, () => oxirgiBoshqaruvchiTekshir(holat(EGA), { yangiFaol: false })),
    /yagona direktor/,
    "kompaniya egasiz qolmaydi"
  );
});

test("yagona faol direktorni ADMIN darajasiga TUSHIRIB ham bo'lmaydi", async () => {
  // Eski tekshiruv bu yerda o'tkazib yuborardi: "boshqaruvchi qoldimi?"
  // degan savolga administrator bilan "ha" deb javob berardi va kompaniya
  // egasiz qolardi.
  await assert.rejects(
    () => runWithTenant(T, () => oxirgiBoshqaruvchiTekshir(holat(EGA), { yangiRol: "ADMIN" })),
    /yagona direktor/
  );
});

test("ikkinchi direktor FAOL bo'lsa — birinchisini tushirish mumkin", async () => {
  await rawPrisma.user.update({ where: { id: EGA2.userId }, data: { isActive: true } });
  await runWithTenant(T, () => oxirgiBoshqaruvchiTekshir(holat(EGA), { yangiRol: "ADMIN" }));
  await runWithTenant(T, () => oxirgiBoshqaruvchiTekshir(holat(EGA), { yangiFaol: false }));
  // Holatni qaytaramiz — keyingi testlar yagona ega holatiga tayanadi.
  await rawPrisma.user.update({ where: { id: EGA2.userId }, data: { isActive: false } });
});

test("ADMIN nishon bo'lsa — ega sanog'i qo'llanmaydi (u ega emas)", async () => {
  // Faol OWNER (EGA) turgani uchun administratorni tushirish mumkin.
  await runWithTenant(T, () => oxirgiBoshqaruvchiTekshir(holat(ADMIN), { yangiRol: "CASHIER" }));
});

// ---------------------------------------------------------------------------
// 5. MAXSUS ROL (PRO) ORQALI YO'L
// ---------------------------------------------------------------------------

test("maxsus rolning bazaRol tanlovida OWNER umuman YO'Q", () => {
  assert.ok(!BAZA_ROLLAR.includes("OWNER"), "sxema darajasida yopiq");
  assert.deepEqual([...BAZA_ROLLAR], ["ADMIN", "CASHIER", "SELLER"]);
});

test("bazaRol qo'lda OWNER qilib qo'yilsa ham TAYINLASH to'xtaydi", () => {
  // Route effektiv rolni (`role.bazaRol`) guardga uzatadi — ya'ni bazada
  // qo'lda o'zgartirilgan rol ham administrator qo'lida ishlamaydi.
  radEtilsin(() => egalikniQoriqla(ADMIN, { yangiRol: "OWNER" }), "effektiv rol tekshiriladi");
});

// ---------------------------------------------------------------------------
// 6. AUDIT — RAD ETILGAN URINISH IZ QOLDIRADI
// ---------------------------------------------------------------------------

test("rad etilgan eskalatsiya urinishi audit jurnaliga tushadi", async () => {
  await assert.rejects(
    () =>
      runWithTenant(T, () =>
        egalikTekshir(ADMIN, { yangiRol: "OWNER", nishon: holat(KASSIR) }, KASSIR.userId)
      ),
    (e: any) => e instanceof ForbiddenError
  );

  const yozuv = await rawPrisma.auditLog.findFirst({
    where: { entity: "user", entityId: KASSIR.userId },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(yozuv, "audit yozuvi yaratilgan");
  assert.equal(yozuv.tenantId, T, "tenantga bog'langan");
  const after = JSON.parse(yozuv.after);
  assert.equal(after.radEtildi, "EGALIK_ESKALATSIYASI");
  assert.equal(after.aktorId, ADMIN.userId);
  assert.equal(after.soralganRol, "OWNER");
});

test("muvaffaqiyatli tekshiruv audit shovqini yaratmaydi", async () => {
  const oldin = await rawPrisma.auditLog.count({ where: { entity: "user" } });
  await runWithTenant(T, () => egalikTekshir(EGA, { yangiRol: "OWNER" }, "yangi"));
  const keyin = await rawPrisma.auditLog.count({ where: { entity: "user" } });
  assert.equal(keyin, oldin, "faqat RAD ETILGAN urinish yoziladi");
});

// ---------------------------------------------------------------------------
// 7. ROUTE ULANISHI — himoya chaqirilmay qolib ketmasin
// ---------------------------------------------------------------------------

const ROOT_ROUTE = readFileSync("src/app/api/users/route.ts", "utf8");
const ID_ROUTE = readFileSync("src/app/api/users/[id]/route.ts", "utf8");

test("POST /api/users egalikni EFFEKTIV rol bo'yicha tekshiradi", () => {
  assert.match(ROOT_ROUTE, /egalikTekshir\(\s*\{ userId: user\.userId, rol: user\.rol \},\s*\{ yangiRol: effectiveRol \}/);
});

test("PATCH va DELETE ham egalikTekshir dan o'tadi", () => {
  assert.equal((ID_ROUTE.match(/egalikTekshir\(/g) ?? []).length, 2, "PATCH va DELETE");
  assert.match(ID_ROUTE, /\{ yangiRol: rol, nishon: existing \}/, "PATCH: nishon uzatiladi");
  assert.match(ID_ROUTE, /\{ nishon: target \}/, "DELETE: nishon uzatiladi");
});

test("PATCH da tekshiruv maxsus rol hal qilinGANDAN KEYIN turadi", () => {
  // `rol` yuqorida `role.bazaRol` bilan almashtiriladi — guard undan oldin
  // chaqirilsa, maxsus rol orqali kelgan daraja tekshirilmay o'tib ketardi.
  const bazaRolJoyi = ID_ROUTE.indexOf("rol = role.bazaRol as typeof rol;");
  const guardJoyi = ID_ROUTE.indexOf("egalikTekshir(");
  assert.ok(bazaRolJoyi > 0 && guardJoyi > bazaRolJoyi, "tartib to'g'ri");
});

test("rol o'zgarishi audit jurnaliga alohida yoziladi", () => {
  assert.match(ID_ROUTE, /rol !== undefined && rol !== existing\.rol/);
  assert.match(ID_ROUTE, /entity: "user"/);
});

// ---------------------------------------------------------------------------
// 8. BUILD ZANJIRI — hardcode parolli skript qaytib kelmasin
// ---------------------------------------------------------------------------

test("build zanjirida bir martalik parol skripti YO'Q", () => {
  const pkg = readFileSync("package.json", "utf8");
  assert.ok(!pkg.includes("bir-martalik-parol"), "skript zanjirdan olib tashlangan");
  // O'rnida env bilan ishlaydigan umumiy mexanizm qoladi.
  assert.match(pkg, /scripts\/bootstrap-superadmin\.mjs/);
});

test("superadmin bootstrap FAQAT env dan o'qiydi (kodda login/xesh yo'q)", () => {
  const skript = readFileSync("scripts/bootstrap-superadmin.mjs", "utf8");
  assert.match(skript, /process\.env\.SUPERADMIN_LOGIN/);
  assert.match(skript, /process\.env\.SUPERADMIN_PAROL/);
  assert.ok(!/\$2[aby]\$/.test(skript), "kodda bcrypt xeshi bo'lmasligi kerak");
});
