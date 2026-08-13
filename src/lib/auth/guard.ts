import { NextResponse } from "next/server";
import type { Rol } from "./session";
import { isManager } from "./roles";

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

/** Boshqaruvchi (OWNER/ADMIN) har doim, boshqalar faqat o'z yozuvini o'zgartira oladi. */
export function requireOwnerOrAdmin(rol: Rol, userId: string, ownerId: string): void {
  if (isManager(rol)) return;
  if (userId === ownerId) return;
  throw new ForbiddenError("Faqat o'zingiz kiritgan yozuvni o'zgartira olasiz");
}

/** Route handlerlarda try/catch orqali xatolarni HTTP javobga aylantiradi. */
export async function handleApiError(error: unknown): Promise<NextResponse> {
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
  // Kutilmagan 500 monitoring'ga ketadi (TASK 3.3); foydalanuvchiga esa
  // baribir umumiy xabar — texnik tafsilot hech qachon chiqmaydi.
  const { xatoniYubor } = await import("@/lib/monitoring/xabar");
  await xatoniYubor(error, "api:500");
  return NextResponse.json({ error: "Server xatosi yuz berdi" }, { status: 500 });
}
