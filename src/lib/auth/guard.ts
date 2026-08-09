import { NextResponse } from "next/server";
import type { Rol } from "./session";
import { isManager, rolDaraja } from "./roles";

export class ForbiddenError extends Error {
  constructor(message = "Ruxsat yo'q") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message = "Avtorizatsiyadan o'ting") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** Foydalanuvchi xatosi (400) — masalan "Omborda yetarli emas". */
export class BadRequestError extends Error {
  constructor(message = "Xato so'rov") {
    super(message);
    this.name = "BadRequestError";
  }
}

export function requireRole(rol: Rol, allowed: Rol): void {
  if (rol !== allowed) {
    throw new ForbiddenError();
  }
}

/** Tenant boshqaruvchisi (OWNER/ADMIN) talab qilinadi — avvalgi "admin" tekshiruvi o'rnida. */
export function requireManager(rol: Rol): void {
  if (!isManager(rol)) {
    throw new ForbiddenError();
  }
}

/** Sotuvchi (SELLER) faqat kirim/chiqim kirita oladi — boshqa modullar taqiqlanadi. */
export function forbidSeller(rol: Rol): void {
  if (rol === "SELLER") {
    throw new ForbiddenError("Sotuvchi faqat kirim va chiqim kirita oladi");
  }
}

/**
 * Foydalanuvchi boshqaruvida rol ierarxiyasi (audit H-13):
 * quyi boshqaruvchi yuqori rolli foydalanuvchini o'zgartira/o'chira olmaydi —
 * aks holda ADMIN direktorning parolini almashtirib hisobni egallab olardi.
 * Teng darajada faqat o'zini o'zgartirish mumkin; OWNER bundan mustasno
 * (ikkita direktor bir-birini boshqara oladi — undan yuqori pog'ona yo'q).
 */
export function requireRolAuthority(
  aktorRol: Rol,
  aktorId: string,
  nishonRol: string,
  nishonId: string
): void {
  const aktor = rolDaraja(aktorRol);
  const nishon = rolDaraja(nishonRol);
  if (nishon > aktor) {
    throw new ForbiddenError("Sizdan yuqori rolli foydalanuvchini o'zgartira olmaysiz");
  }
  if (nishon === aktor && nishonId !== aktorId && aktorRol !== "OWNER") {
    throw new ForbiddenError("Teng rolli foydalanuvchini faqat direktor o'zgartira oladi");
  }
}

/** Rol berishda ham ierarxiya: hech kim o'zidan yuqori rol tayinlay olmaydi. */
export function requireRolAssignable(aktorRol: Rol, yangiRol: string): void {
  if (rolDaraja(yangiRol) > rolDaraja(aktorRol)) {
    throw new ForbiddenError("O'zingizdan yuqori rol tayinlay olmaysiz");
  }
}

/** Boshqaruvchi (OWNER/ADMIN) har doim, boshqalar faqat o'z yozuvini o'zgartira oladi. */
export function requireOwnerOrAdmin(rol: Rol, userId: string, ownerId: string): void {
  if (isManager(rol)) return;
  if (userId === ownerId) return;
  throw new ForbiddenError("Faqat o'zingiz kiritgan yozuvni o'zgartira olasiz");
}

/** Route handlerlarda try/catch orqali xatolarni HTTP javobga aylantiradi. */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof BadRequestError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error(error);
  return NextResponse.json({ error: "Server xatosi yuz berdi" }, { status: 500 });
}
