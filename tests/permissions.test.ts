/**
 * FOYDALANUVCHI BOSHQARUVI QOIDALARI (H-1) — lib/auth/userPolicy.ts.
 *
 * Tenant ichida hisob egallashning oldini oladigan qoidalar:
 *  - direktor hisobiga faqat direktor tegadi (ADMIN emas);
 *  - OWNER rolini faqat OWNER beradi;
 *  - o'z rolini o'zgartirish va o'zini nofaollashtirish taqiq;
 *  - oxirgi faol direktor himoyalanadi.
 *
 * Ishga tushirish: npm run test:permissions
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  userTahririniTekshir,
  userOchirishniTekshir,
  userYaratishniTekshir,
} from "@/lib/auth/userPolicy";

const owner = { userId: "u-owner", rol: "OWNER" as const };
const admin = { userId: "u-admin", rol: "ADMIN" as const };

const ownerTarget = { id: "u-owner2", rol: "OWNER" as const, isActive: true };
const kassirTarget = { id: "u-kassir", rol: "CASHIER" as const, isActive: true };

test("ADMIN direktor (OWNER) hisobini tahrirlay olmaydi — parolini ham", () => {
  const xato = userTahririniTekshir({
    aktor: admin,
    target: ownerTarget,
    ozgarish: {},
    faolOwnerSoni: 2,
  });
  assert.ok(xato, "rad etilishi kerak");
  assert.equal(xato!.status, 403);
  assert.match(xato!.xato, /faqat boshqa direktor/i);
});

test("ADMIN hech kimga OWNER rolini bera olmaydi (PATCH va POST)", () => {
  const patch = userTahririniTekshir({
    aktor: admin,
    target: kassirTarget,
    ozgarish: { rol: "OWNER" },
    faolOwnerSoni: 2,
  });
  assert.equal(patch!.status, 403);

  const post = userYaratishniTekshir({ aktorRol: "ADMIN", yangiRol: "OWNER" });
  assert.equal(post!.status, 403);

  assert.equal(userYaratishniTekshir({ aktorRol: "OWNER", yangiRol: "OWNER" }), null);
  assert.equal(userYaratishniTekshir({ aktorRol: "ADMIN", yangiRol: "CASHIER" }), null);
});

test("o'z rolini o'zgartirish taqiq — yagona direktor o'zini kassir qila olmaydi", () => {
  const xato = userTahririniTekshir({
    aktor: owner,
    target: { id: owner.userId, rol: "OWNER", isActive: true },
    ozgarish: { rol: "CASHIER" },
    faolOwnerSoni: 2,
  });
  assert.equal(xato!.status, 400);
  assert.match(xato!.xato, /o'z rolingizni/i);
});

test("o'zini nofaollashtirish taqiq", () => {
  const xato = userTahririniTekshir({
    aktor: owner,
    target: { id: owner.userId, rol: "OWNER", isActive: true },
    ozgarish: { isActive: false },
    faolOwnerSoni: 2,
  });
  assert.equal(xato!.status, 400);
  assert.match(xato!.xato, /nofaollashtira olmaysiz/i);
});

test("oxirgi faol direktor tushirilmaydi/nofaollashtirilmaydi/o'chirilmaydi", () => {
  const tushirish = userTahririniTekshir({
    aktor: owner,
    target: ownerTarget,
    ozgarish: { rol: "CASHIER" },
    faolOwnerSoni: 1,
  });
  assert.match(tushirish!.xato, /kamida bitta faol direktor/i);

  const nofaol = userTahririniTekshir({
    aktor: owner,
    target: ownerTarget,
    ozgarish: { isActive: false },
    faolOwnerSoni: 1,
  });
  assert.match(nofaol!.xato, /kamida bitta faol direktor/i);

  const ochirish = userOchirishniTekshir({
    aktor: owner,
    target: ownerTarget,
    faolOwnerSoni: 1,
  });
  assert.match(ochirish!.xato, /kamida bitta faol direktor/i);

  // Ikkinchi faol direktor bo'lsa — ruxsat.
  assert.equal(
    userTahririniTekshir({
      aktor: owner,
      target: ownerTarget,
      ozgarish: { rol: "CASHIER" },
      faolOwnerSoni: 2,
    }),
    null
  );
});

test("ADMIN direktorni o'chira olmaydi; o'zini ham hech kim o'chira olmaydi", () => {
  const xato = userOchirishniTekshir({ aktor: admin, target: ownerTarget, faolOwnerSoni: 2 });
  assert.equal(xato!.status, 403);

  const ozini = userOchirishniTekshir({
    aktor: owner,
    target: { id: owner.userId, rol: "OWNER", isActive: true },
    faolOwnerSoni: 2,
  });
  assert.equal(ozini!.status, 400);
});

test("oddiy amallar bloklanmaydi: OWNER kassirni tahrirlaydi, ADMIN kassirni tahrirlaydi", () => {
  assert.equal(
    userTahririniTekshir({
      aktor: owner,
      target: kassirTarget,
      ozgarish: { rol: "SELLER", isActive: true },
      faolOwnerSoni: 1,
    }),
    null
  );
  assert.equal(
    userTahririniTekshir({ aktor: admin, target: kassirTarget, ozgarish: {}, faolOwnerSoni: 1 }),
    null
  );
});
