import { NextRequest, NextResponse } from "next/server";
import { handlePaymeRequest } from "@/lib/billing/payme";

/**
 * Payme Merchant API endpoint'i (Payme serveri chaqiradi, sessiya yo'q).
 * Avtorizatsiya — Basic auth ("Paycom:<PAYME_KEY>"), protokol mantiqi lib/billing/payme.ts da.
 * Payme har doim HTTP 200 kutadi: xatolar javob tanasida JSON-RPC error sifatida qaytadi.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { id: null, error: { code: -32700, message: { uz: "JSON o'qib bo'lmadi", ru: "Ошибка JSON", en: "Parse error" } } },
      { status: 200 }
    );
  }

  const javob = await handlePaymeRequest(body as never, request.headers.get("authorization"));
  return NextResponse.json(javob, { status: 200 });
}
