/**
 * DAVOMAT 2.0 — selfie+GPS check-in, jadval, jarima, bonus va oylik.
 *
 * Asosiy invariantlar:
 *  - vaqt FAQAT server soati (mijoz vaqti umuman o'qilmaydi);
 *  - GPS radius tekshiruvi serverda (Haversine);
 *  - bir xodim + bir kun = bitta davomat (parallel bosishdan himoya);
 *  - jarima avtomatik OCHILADI, lekin oylikka faqat TASDIQLANGANI kiradi;
 *  - tenant/biznes izolyatsiyasi buzilmaydi.
 *
 * Ishga tushirish: npm run test:davomat
 */
process.env.DATABASE_URL = "file:./prisma/test-davomat.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: any;
let hr: any;
let davomat: any;
let jadvalSvc: any;
let jarimaSvc: any;
let queries: any;
let vaqt: any;
let geo: any;
let createTenantWithOwner: any;

let t: any;
let t2: any;
let azizbek: any; // to'liq siyosat: selfie + GPS + radius
let javlon: any; // kechikuvchi
let sardor: any; // kelmaganlik testi
let dala: any; // radius talab qilinmaydigan dala xodimi
let jadval: any;

// 2026-08-27 — payshanba (ish kuni), 2026-08-30 — yakshanba (dam).
const SANA = "2026-08-27";
const OY = "2026-08";

// Ish joyi: Toshkent markazi, radius 100 m.
const JOY = { lat: 41.311, lng: 69.24 };
const ICHKARIDA = { lat: 41.31155, lng: 69.24 }; // ~61 m
const TASHQARIDA = { lat: 41.315, lng: 69.24 }; // ~445 m

const SELFIE = Buffer.from("test-selfie-jpeg-mazmuni").toString("base64");

/** Toshkent devor soatini UTC instant'ga aylantiradi (testda vaqt in'eksiyasi). */
function tv(sana: string, hhmm: string): Date {
  return vaqt.toshkentVaqtniUTCga(sana, hhmm);
}

function T<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(t.tenant.id, fn, { userId: t.user.id, ism: "Direktor" });
}

function T2<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(t2.tenant.id, fn, { userId: t2.user.id, ism: "Begona" });
}

function tolisSelfie() {
  return { lat: ICHKARIDA.lat, lng: ICHKARIDA.lng, aniqlikM: 12, selfieBase64: SELFIE, selfieMime: "image/jpeg" };
}

before(async () => {
  rmSync("prisma/test-davomat.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  hr = await import("@/lib/services/hr");
  davomat = await import("@/lib/services/davomat");
  jadvalSvc = await import("@/lib/services/davomatJadval");
  jarimaSvc = await import("@/lib/services/jarima");
  queries = await import("@/lib/queries/davomat");
  vaqt = await import("@/lib/davomat/vaqt");
  geo = await import("@/lib/davomat/geo");
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));

  t = await createTenantWithOwner({
    kompaniyaNomi: "Davomat test",
    ism: "Direktor",
    login: "+998922223601",
    parol: "parol12345",
  });
  t2 = await createTenantWithOwner({
    kompaniyaNomi: "Begona firma",
    ism: "Begona",
    login: "+998922223602",
    parol: "parol12345",
  });

  await T(async () => {
    jadval = await jadvalSvc.createJadval(t.business.id, {
      nomi: "Ofis xodimlari",
      imtiyozDaqiqa: 5,
      standart: true,
      kunlar: [0, 1, 2, 3, 4, 5, 6].map((hafta) => ({
        hafta,
        ishKuni: hafta !== 0,
        boshlanish: hafta === 0 ? null : "09:00",
        tugash: hafta === 0 ? null : hafta === 6 ? "14:00" : "18:00",
      })),
    });
    await jadvalSvc.createIshJoyi(t.business.id, {
      nomi: "Bosh ofis",
      lat: JOY.lat,
      lng: JOY.lng,
      radiusM: 100,
      standart: true,
    });
    await jarimaSvc.standartQoidalarniOrnat(t.business.id);

    azizbek = await hr.createEmployee(t.business.id, {
      ism: "Azizbek",
      stavka: 5_000_000,
      stavkaTuri: "oylik",
    });
    javlon = await hr.createEmployee(t.business.id, {
      ism: "Javlon",
      stavka: 5_000_000,
      stavkaTuri: "oylik",
    });
    sardor = await hr.createEmployee(t.business.id, {
      ism: "Sardor",
      stavka: 3_000_000,
      stavkaTuri: "oylik",
    });
    dala = await hr.createEmployee(t.business.id, {
      ism: "Dala sotuvchi",
      stavka: 4_000_000,
      stavkaTuri: "oylik",
    });
    await jadvalSvc.updateXodimSiyosati(t.business.id, dala.id, { radiusTalab: false });
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- Sof funksiyalar: kechikish chegarasi va Haversine ----------

test("kechikish chegarasi: 09:00/09:04/09:05 vaqtida, 09:06 kechikdi", () => {
  const asos = { sana: SANA, boshlanish: "09:00", imtiyozDaqiqa: 5 };
  const h0 = vaqt.kechikishHisobla({ ...asos, kelgan: tv(SANA, "09:00") });
  const h4 = vaqt.kechikishHisobla({ ...asos, kelgan: tv(SANA, "09:04") });
  const h5 = vaqt.kechikishHisobla({ ...asos, kelgan: tv(SANA, "09:05") });
  const h6 = vaqt.kechikishHisobla({ ...asos, kelgan: tv(SANA, "09:06") });
  assert.equal(h0.vaqtida && h4.vaqtida && h5.vaqtida, true);
  assert.equal(h0.jarimaDaqiqa + h4.jarimaDaqiqa + h5.jarimaDaqiqa, 0);
  assert.equal(h6.vaqtida, false);
  assert.equal(h6.xomDaqiqa, 6);
  assert.equal(h6.jarimaDaqiqa, 6);
});

test("Haversine: radius ichida ~61 m, tashqarida ~445 m", () => {
  const ichkari = geo.masofaM(ICHKARIDA.lat, ICHKARIDA.lng, JOY.lat, JOY.lng);
  const tashqari = geo.masofaM(TASHQARIDA.lat, TASHQARIDA.lng, JOY.lat, JOY.lng);
  assert.ok(ichkari > 40 && ichkari < 80, `ichkari=${ichkari}`);
  assert.ok(tashqari > 400 && tashqari < 500, `tashqari=${tashqari}`);
});

// ---------- Check-in: GPS/selfie siyosati ----------

test("radius tashqarisidan check-in RAD etiladi", async () => {
  await T(async () => {
    await assert.rejects(
      davomat.ishniBoshla({
        businessId: t.business.id,
        employeeId: azizbek.id,
        input: { ...tolisSelfie(), lat: TASHQARIDA.lat, lng: TASHQARIDA.lng },
        hozir: tv(SANA, "08:57"),
      }),
      /hududida emassiz/
    );
    const soni = await rawPrisma.attendance.count({
      where: { businessId: t.business.id, employeeId: azizbek.id },
    });
    assert.equal(soni, 0);
  });
});

test("selfie yo'q bo'lsa RAD, GPS yo'q bo'lsa RAD, aniqlik past bo'lsa RAD", async () => {
  await T(async () => {
    await assert.rejects(
      davomat.ishniBoshla({
        businessId: t.business.id,
        employeeId: azizbek.id,
        input: { ...tolisSelfie(), selfieBase64: null, selfieMime: null },
        hozir: tv(SANA, "08:57"),
      }),
      /selfie talab qilinadi/
    );
    await assert.rejects(
      davomat.ishniBoshla({
        businessId: t.business.id,
        employeeId: azizbek.id,
        input: { ...tolisSelfie(), lat: null, lng: null },
        hozir: tv(SANA, "08:57"),
      }),
      /lokatsiyaga ruxsat/
    );
    await assert.rejects(
      davomat.ishniBoshla({
        businessId: t.business.id,
        employeeId: azizbek.id,
        input: { ...tolisSelfie(), aniqlikM: 900 },
        hozir: tv(SANA, "08:57"),
      }),
      /aniqligi juda past/
    );
  });
});

test("dala xodimi radius tashqarisidan ham check-in qila oladi (radiusTalab=false)", async () => {
  await T(async () => {
    const n = await davomat.ishniBoshla({
      businessId: t.business.id,
      employeeId: dala.id,
      input: { ...tolisSelfie(), lat: TASHQARIDA.lat, lng: TASHQARIDA.lng },
      hozir: tv(SANA, "08:50"),
    });
    assert.equal(n.vaqtida, true);
  });
});

// ---------- Check-in: vaqtida / kechikish / dublikat ----------

test("Azizbek 08:57 da keladi — vaqtida, selfie DB da, masofa yozilgan", async () => {
  await T(async () => {
    const n = await davomat.ishniBoshla({
      businessId: t.business.id,
      employeeId: azizbek.id,
      input: tolisSelfie(),
      hozir: tv(SANA, "08:57"),
    });
    assert.equal(n.vaqtida, true);
    assert.equal(n.kechikishDaqiqa, 0);

    const yozuv = await rawPrisma.attendance.findFirst({
      where: { businessId: t.business.id, employeeId: azizbek.id },
      include: { checks: true },
    });
    assert.equal(yozuv.holat, "keldi");
    assert.equal(yozuv.manba, "selfie_gps");
    assert.equal(yozuv.rejaBoshlanish, "09:00");
    assert.equal(yozuv.checks.length, 1);
    assert.ok(yozuv.checks[0].masofaM < 100);
    assert.ok(yozuv.checks[0].selfieId);

    const selfie = await rawPrisma.attendanceSelfie.findUnique({
      where: { id: yozuv.checks[0].selfieId },
    });
    assert.equal(selfie.saqlagich, "db");
    assert.equal(selfie.mazmun, SELFIE);
    // Jarima OCHILMAGAN — vaqtida kelgan.
    const jarimalar = await rawPrisma.employeePenalty.count({
      where: { employeeId: azizbek.id },
    });
    assert.equal(jarimalar, 0);
  });
});

test("takroriy check-in RAD etiladi", async () => {
  await T(async () => {
    await assert.rejects(
      davomat.ishniBoshla({
        businessId: t.business.id,
        employeeId: azizbek.id,
        input: tolisSelfie(),
        hozir: tv(SANA, "09:10"),
      }),
      /allaqachon boshlangan/
    );
  });
});

test("Javlon 09:18 — 18 daqiqa kechikdi, 50 000 jarima KUTILMOQDA ochiladi", async () => {
  await T(async () => {
    const n = await davomat.ishniBoshla({
      businessId: t.business.id,
      employeeId: javlon.id,
      input: tolisSelfie(),
      hozir: tv(SANA, "09:18"),
    });
    assert.equal(n.vaqtida, false);
    assert.equal(n.kechikishDaqiqa, 18);
    assert.equal(n.jarimaDaqiqa, 18);

    const jarima = await rawPrisma.employeePenalty.findFirst({
      where: { employeeId: javlon.id },
    });
    assert.equal(jarima.summa, 50_000); // 16-30 daqiqa qoidasi
    assert.equal(jarima.holat, "kutilmoqda");
    assert.equal(jarima.manba, "avto");
    assert.match(jarima.sabab, /18 daqiqa/);
  });
});

// ---------- Check-out ----------

test("check-in'siz check-out RAD etiladi", async () => {
  await T(async () => {
    await assert.rejects(
      davomat.ishniTugat({
        businessId: t.business.id,
        employeeId: sardor.id,
        input: tolisSelfie(),
        hozir: tv(SANA, "18:00"),
      }),
      /Avval ishni boshlang/
    );
  });
});

test("Azizbek 18:11 da ketadi — 9 soat 14 daqiqa, takroriy check-out RAD", async () => {
  await T(async () => {
    const n = await davomat.ishniTugat({
      businessId: t.business.id,
      employeeId: azizbek.id,
      input: tolisSelfie(),
      hozir: tv(SANA, "18:11"),
    });
    assert.equal(n.ishlanganDaqiqa, 9 * 60 + 14);
    assert.equal(n.ortiqchaDaqiqa, 11);
    assert.equal(n.ertaKetishDaqiqa, 0);

    await assert.rejects(
      davomat.ishniTugat({
        businessId: t.business.id,
        employeeId: azizbek.id,
        input: tolisSelfie(),
        hozir: tv(SANA, "18:30"),
      }),
      /allaqachon tugatilgan/
    );
  });
});

// ---------- Direktor paneli ----------

test("bugungi panel: ishda/tugatdi/kechikdi/kelmagan to'g'ri sanaladi", async () => {
  await T(async () => {
    const b = await queries.getBugungiDavomat(t.business.id, SANA);
    assert.equal(b.jami, 4);
    assert.equal(b.tugatdi, 1); // Azizbek
    assert.equal(b.ishda, 2); // Javlon, Dala
    assert.equal(b.kechikdi, 1); // Javlon
    assert.equal(b.kelmagan, 1); // Sardor (hali kelmagan)
    assert.equal(b.kutilayotganJarima, 50_000);
    const aziz = b.xodimlar.find((x: any) => x.ism === "Azizbek");
    assert.equal(aziz.kelgan, "08:57");
    assert.equal(aziz.ketgan, "18:11");
    assert.ok(aziz.kelishSelfieId);
  });
});

// ---------- Tenant izolyatsiyasi ----------

test("begona tenant A xodimiga check-in qila olmaydi va ma'lumot ko'rmaydi", async () => {
  await T2(async () => {
    await assert.rejects(
      davomat.ishniBoshla({
        businessId: t.business.id, // begona biznes ID (URL orqali urinish)
        employeeId: azizbek.id,
        input: tolisSelfie(),
        hozir: tv(SANA, "09:00"),
      })
    );
    // O'z biznesi bo'yicha so'rov — A yozuvlari ko'rinmaydi.
    const b = await queries.getBugungiDavomat(t2.business.id, SANA);
    assert.equal(b.jami, 0);
    const jarimalar = await queries.listJarimalar(t2.business.id, {});
    assert.equal(jarimalar.length, 0);
  });
});

test("tenant klienti orqali begona selfie o'qilmaydi", async () => {
  const selfie = await rawPrisma.attendanceSelfie.findFirst({
    where: { businessId: t.business.id },
  });
  await T2(async () => {
    const { prisma } = await import("@/lib/prisma");
    const urinish = await prisma.attendanceSelfie.findFirst({ where: { id: selfie.id } });
    assert.equal(urinish, null);
  });
});

// ---------- Admin tuzatishi ----------

test("admin tuzatishi: vaqt o'zgaradi, dalil yozuvi (sabab, oldingi qiymat) qoladi", async () => {
  await T(async () => {
    await davomat.davomatTuzat({
      businessId: t.business.id,
      userId: t.user.id,
      data: {
        employeeId: javlon.id,
        sana: SANA,
        kelganVaqt: "09:03",
        ketganVaqt: null,
        sabab: "Telefoni ishlamagan, o'zi ishda edi",
      },
    });
    const yozuv = await rawPrisma.attendance.findFirst({
      where: { employeeId: javlon.id },
      include: { checks: { orderBy: { createdAt: "asc" } } },
    });
    assert.equal(yozuv.kechikishDaqiqa, 3);
    assert.equal(yozuv.jarimaDaqiqa, 0); // imtiyoz ichida
    assert.equal(yozuv.manba, "admin");
    const adminCheck = yozuv.checks.find((c: any) => c.manba === "admin");
    assert.ok(adminCheck);
    assert.match(adminCheck.sabab, /Telefoni ishlamagan/);
    assert.ok(adminCheck.oldingiVaqt); // asl 09:18 saqlangan
    // Asl selfie_gps dalili o'chmagan.
    assert.ok(yozuv.checks.some((c: any) => c.manba === "selfie_gps"));
    // KUTILMOQDA avto-jarima yangi hisobga moslanib O'CHIRILGAN (jarima daqiqa 0).
    const jarima = await rawPrisma.employeePenalty.findFirst({
      where: { employeeId: javlon.id, manba: "avto" },
    });
    assert.equal(jarima, null);
  });
});

// ---------- Jarima tasdiqlash va oylik ----------

test("jarima faqat TASDIQLANGANDA oylikka kiradi; rad/kutilmoqda kirmaydi", async () => {
  await T(async () => {
    // Javlonga uchta qo'lda jarima: tasdiqlanadi (summasi tahrir bilan), rad, kutilmoqda.
    const j1 = await jarimaSvc.createJarima(t.business.id, t.user.id, {
      employeeId: javlon.id,
      sana: SANA,
      summa: 50_000,
      sabab: "Kechikish — 18 daqiqa",
    });
    const j2 = await jarimaSvc.createJarima(t.business.id, t.user.id, {
      employeeId: javlon.id,
      sana: SANA,
      summa: 70_000,
      sabab: "Rad etiladigan jarima",
    });
    await jarimaSvc.createJarima(t.business.id, t.user.id, {
      employeeId: javlon.id,
      sana: SANA,
      summa: 90_000,
      sabab: "Qaror kutilayotgan jarima",
    });

    // Tasdiqda summa 40 000 ga tahrirlanadi — asl summa auditda qoladi.
    const tasdiq = await jarimaSvc.jarimaQaror({
      businessId: t.business.id,
      userId: t.user.id,
      penaltyId: j1.id,
      data: { amal: "tasdiqlash", summa: 40_000 },
    });
    assert.equal(tasdiq.holat, "tasdiqlandi");
    assert.equal(tasdiq.summa, 40_000);
    assert.equal(tasdiq.aslSumma, 50_000);

    await jarimaSvc.jarimaQaror({
      businessId: t.business.id,
      userId: t.user.id,
      penaltyId: j2.id,
      data: { amal: "rad" },
    });

    // Takroriy qaror RAD etiladi.
    await assert.rejects(
      jarimaSvc.jarimaQaror({
        businessId: t.business.id,
        userId: t.user.id,
        penaltyId: j1.id,
        data: { amal: "rad" },
      }),
      /allaqachon qabul qilingan/
    );

    // Bonus.
    await jarimaSvc.createBonus(t.business.id, t.user.id, {
      employeeId: javlon.id,
      sana: SANA,
      summa: 300_000,
      sabab: "Avgust savdo natijasi",
    });

    // Oylik: 5 000 000 + 300 000 bonus − 40 000 tasdiqlangan jarima.
    const payroll = await hr.oylikHisobla(t.business.id, t.user.id, {
      employeeId: javlon.id,
      oy: OY,
    });
    assert.equal(payroll.bonuslar, 300_000);
    assert.equal(payroll.jarimalar, 40_000);
    assert.equal(payroll.tolanadigan, 5_000_000 + 300_000 - 40_000);
  });
});

// ---------- Kelmaganlarni belgilash (cron mantig'i) ----------

test("ish kunida kelmagan xodim 'kelmadi' + 200 000 jarima; dam kuni tegilmaydi; idempotent", async () => {
  await T(async () => {
    const n1 = await davomat.kelmaganlarniBelgila(t.business.id, SANA);
    // Sardor kelmagan (Azizbek/Javlon/Dala yozuvlari bor).
    assert.equal(n1.belgilandi, 1);
    const yozuv = await rawPrisma.attendance.findFirst({
      where: { employeeId: sardor.id },
    });
    assert.equal(yozuv.holat, "kelmadi");
    const jarima = await rawPrisma.employeePenalty.findFirst({
      where: { employeeId: sardor.id },
    });
    assert.equal(jarima.summa, 200_000);
    assert.equal(jarima.holat, "kutilmoqda");

    // Idempotent: qayta chaqirilsa yangi yozuv ochilmaydi.
    const n2 = await davomat.kelmaganlarniBelgila(t.business.id, SANA);
    assert.equal(n2.belgilandi, 0);

    // Yakshanba — dam olish kuni: hech kim "kelmadi" bo'lmaydi.
    const n3 = await davomat.kelmaganlarniBelgila(t.business.id, "2026-08-30");
    assert.equal(n3.belgilandi, 0);
  });
});

// ---------- Jadval qoidalari ----------

test("jarima qoidalari kesishuvi RAD etiladi", async () => {
  await T(async () => {
    await assert.rejects(
      jarimaSvc.createJarimaQoidasi(t.business.id, {
        turi: "kechikish",
        minDaqiqa: 10,
        maxDaqiqa: 20,
        summa: 30_000,
      }),
      /kesishadi/
    );
  });
});

test("xodim siyosatiga begona biznes jadvalini biriktirib bo'lmaydi", async () => {
  const begonaJadval = await T2(async () =>
    jadvalSvc.createJadval(t2.business.id, {
      nomi: "Begona jadval",
      imtiyozDaqiqa: 5,
      kunlar: [0, 1, 2, 3, 4, 5, 6].map((hafta) => ({
        hafta,
        ishKuni: false,
        boshlanish: null,
        tugash: null,
      })),
    })
  );
  await T(async () => {
    await assert.rejects(
      jadvalSvc.updateXodimSiyosati(t.business.id, azizbek.id, {
        workScheduleId: begonaJadval.id,
      }),
      /topilmadi/
    );
  });
});
