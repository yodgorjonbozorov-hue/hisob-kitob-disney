import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";

/**
 * KASSA TOPSHIRIG'I BO'YICHA QAROR — DEPRECATED.
 *
 * Eski oqim yopildi (batafsil: ../route.ts). Ochiq qolgan topshiriqlar
 * migratsiyada `AccountTransfer` ga `holat = "arxiv"` bilan ko'chirilgan va
 * ular hech qanday qoldiqqa ta'sir qilmaydi, shuning uchun ular bo'yicha
 * qaror qabul qilishning ma'nosi yo'q.
 *
 * Yozuvlar bazadan O'CHIRILMAYDI — `CashHandover` jadvali tarix zaxirasi
 * sifatida turaveradi.
 */
export const PATCH = withTenant(async () =>
  NextResponse.json(
    {
      error:
        "Kassa topshirishning eski usuli o'chirildi. Yangi o'tkazmalar " +
        "Kassalar sahifasida tasdiqlanadi.",
    },
    { status: 410 }
  )
);
