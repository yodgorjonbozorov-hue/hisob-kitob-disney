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

  try {
    const javob = await handlePaymeRequest(body as never, request.headers.get("authorization"));
    return NextResponse.json(javob, { status: 200 });
  } catch (error) {
    // Payme protokoli HTTP 500 ni qabul qilmaydi — kutilmagan xato ham
    // HTTP 200 + JSON-RPC error bo'lib qaytishi shart (-32400: tizim xatosi).
    console.error("Payme so'rovida kutilmagan xato:", error);
    const id = (body as { id?: number | string | null } | null)?.id ?? null;
    return NextResponse.json(
      {
        id,
        error: {
          code: -32400,
          message: { uz: "Tizim xatosi", ru: "Системная ошибка", en: "System error" },
        },
      },
      { status: 200 }
    );
  }
}
