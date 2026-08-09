/**
 * ROL IERARXIYASI (audit H-13) — foydalanuvchi boshqaruvida kim kimni
 * o'zgartira oladi.
 *
 * Yopilgan teshik: `requireManager` OWNER va ADMIN'ni tenglashtirardi,
 * shuning uchun ADMIN direktorning PAROLINI almashtirib butun tenantni
 * egallab olishi mumkin edi. Endi:
 *   - o'zidan yuqori rolli foydalanuvchiga tegib bo'lmaydi;
 *   - teng darajada faqat o'zini o'zgartirish mumkin (OWNER mustasno);
 *   - hech kim o'zidan yuqori rol tayinlay olmaydi (yaratishda ham).
 *
 * Ishga tushirish: npm run test:rol-ierarxiya
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ForbiddenError,
  requireRolAssignable,
  requireRolAuthority,
} from "@/lib/auth/guard";

const otadi = (fn: () => void) => assert.doesNotThrow(fn);
const rad = (fn: () => void) => assert.throws(fn, ForbiddenError);

test("ADMIN direktorga (OWNER) tega olmaydi — parol almashtirish yopildi", () => {
  rad(() => requireRolAuthority("ADMIN", "a1", "OWNER", "o1"));
});

test("ADMIN boshqa ADMIN'ga tega olmaydi (yonlama egallash)", () => {
  rad(() => requireRolAuthority("ADMIN", "a1", "ADMIN", "a2"));
});

test("ADMIN o'zini o'zgartira oladi", () => {
  otadi(() => requireRolAuthority("ADMIN", "a1", "ADMIN", "a1"));
});

test("ADMIN kassir va sotuvchini boshqara oladi", () => {
  otadi(() => requireRolAuthority("ADMIN", "a1", "CASHIER", "k1"));
  otadi(() => requireRolAuthority("ADMIN", "a1", "SELLER", "s1"));
});

test("OWNER hammani, jumladan boshqa OWNER'ni ham boshqara oladi", () => {
  otadi(() => requireRolAuthority("OWNER", "o1", "OWNER", "o2"));
  otadi(() => requireRolAuthority("OWNER", "o1", "ADMIN", "a1"));
  otadi(() => requireRolAuthority("OWNER", "o1", "CASHIER", "k1"));
});

test("eski (migratsiyagacha) rol nomi ham ierarxiyadan o'tadi", () => {
  // Bazada "admin" (eski nom, normalizeRol → OWNER) qolgan bo'lishi mumkin —
  // ADMIN unga ham tega olmasligi kerak.
  rad(() => requireRolAuthority("ADMIN", "a1", "admin", "o1"));
});

test("hech kim o'zidan yuqori rol tayinlay olmaydi", () => {
  rad(() => requireRolAssignable("ADMIN", "OWNER"));
  otadi(() => requireRolAssignable("OWNER", "OWNER"));
  otadi(() => requireRolAssignable("ADMIN", "CASHIER"));
  otadi(() => requireRolAssignable("ADMIN", "ADMIN"));
});
