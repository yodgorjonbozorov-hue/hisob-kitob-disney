import { NextResponse } from "next/server";

/**
 * O'z-o'zidan ro'yxatdan o'tish YOPILGAN (BOS-6, sotuv modeli o'zgardi).
 *
 * Kompaniyani faqat platforma egasi superadmin panelidan qo'lda yaratadi
 * (POST /api/superadmin/tenants). Bu endpoint saqlanib turibdi, chunki uni
 * tashqaridan chaqirish urinishlari bo'lishi mumkin — har qanday holatda
 * 403 qaytaradi va hech narsa yaratmaydi (faqat UI'ni yashirish yetarli emas).
 *
 * Mijozlar uchun yo'l: /demo → DemoRequest → superadmin qo'lda ochadi.
 */
const JAVOB = {
  error: "Ro'yxatdan o'tish yopiq. Demo so'rash uchun /demo sahifasidan foydalaning.",
} as const;

export async function POST() {
  return NextResponse.json(JAVOB, { status: 403 });
}

export async function GET() {
  return NextResponse.json(JAVOB, { status: 403 });
}
