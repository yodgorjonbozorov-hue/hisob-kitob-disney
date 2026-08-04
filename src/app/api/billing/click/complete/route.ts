import { NextRequest, NextResponse } from "next/server";
import { handleClickComplete, CLICK_ERROR, type ClickRequest } from "@/lib/billing/click";
import { clickBodyOqish } from "../parse";

/** Click SHOP API — Complete (action=1). To'lov yakunlanadi va obuna uzayadi. */
export async function POST(request: NextRequest) {
  const body = await clickBodyOqish(request);
  if (!body) {
    return NextResponse.json({ error: CLICK_ERROR.SOROV_XATOSI, error_note: "Error in request from click" });
  }
  return NextResponse.json(await handleClickComplete(body as ClickRequest));
}
