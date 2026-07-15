import { NextResponse } from "next/server";
import type { Rol } from "./session";

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

export function requireRole(rol: Rol, allowed: Rol): void {
  if (rol !== allowed) {
    throw new ForbiddenError();
  }
}

/** Admin har doim, kassir faqat o'z yozuvini o'zgartira oladi. */
export function requireOwnerOrAdmin(rol: Rol, userId: string, ownerId: string): void {
  if (rol === "admin") return;
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
  console.error(error);
  return NextResponse.json({ error: "Server xatosi yuz berdi" }, { status: 500 });
}
