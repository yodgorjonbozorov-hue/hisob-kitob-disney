import { NextRequest, NextResponse } from "next/server";
import { handleClickPrepare, CLICK_ERROR, type ClickRequest } from "@/lib/billing/click";
import { clickBodyOqish } from "../parse";

/** Click SHOP API — Prepare (action=0). Click serveri chaqiradi, sessiya yo'q. */
export async function POST(request: NextRequest) {
  const body = await clickBodyOqish(request);
  if (!body) {
    return NextResponse.json({ error: CLICK_ERROR.SOROV_XATOSI, error_note: "Error in request from click" });
  }
  return NextResponse.json(await handleClickPrepare(body as ClickRequest));
}
