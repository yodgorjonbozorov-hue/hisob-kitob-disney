import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { normalizeRol } from "@/lib/auth/roles";
import { demoTenantniOl } from "@/lib/auth/demo";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/services/audit";
import { kunlikKalit, sanoqOshir } from "@/lib/db/hisoblagich";

/**
 * DEMO'GA PAROLSIZ KIRISH.
 *
 * Ro'yxatdan o'tmagan mehmonga demo tenantning direktor hisobi nomidan
 * sessiya ochadi. Mexanika superadmin impersonatsiyasi bilan BIR XIL
 * (`api/superadmin/tenants/[id]/impersonate`): sessiya REAL `User` qatoriga
 * ishora qiladi, shuning uchun `loadTenant`, `sessionEpoch` va tenant
 * izolyatsiyasi hech qanday istisnosiz avvalgidek ishlaydi.
 *
 * NIMA UCHUN BU XAVFSIZ:
 *  · demo tenantda YOZISH umuman mumkin emas (lib/auth/demo.ts);
 *  · demo hisobining paroli tasodifiy — u bilan `/login` orqali kirib
 *    bo'lmaydi va parolni almashtirish ham bloklangan;
 *  · rol OWNER, lekin yozish qulflangani uchun bu imtiyoz bermaydi —
 *    faqat to'liq menyu ochiladi;
 *  · SUPERADMIN paneli baribir yopiq (`rol !== "SUPERADMIN"`).
 *
 * MAVJUD SESSIYA TEGILMAYDI: tizimga kirgan haqiqiy mijoz bu route'ga
 * tushib qolsa, uning cookie'si demo bilan ALMASHTIRILMAYDI — 409 qaytadi
 * va u o'z ilovasida qoladi.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request) ?? "unknown";
  // Bir IP dan soatiga 20 marta demo sessiya ochish yetarli (sessiya
  // "mintlash" abuzini cheklaydi, oddiy mehmonga xalaqit bermaydi).
  const rl = await rateLimit(`demo:${ip}`, 20, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Juda ko'p urinish. ${rl.retryAfter} soniyadan keyin qayta urining.` },
      { status: 429 }
    );
  }

  const session = await getSession();
  if (session.userId) {
    // Haqiqiy foydalanuvchi sessiyasi ustiga yozilmaydi.
    return NextResponse.json(
      { error: "Siz allaqachon tizimdasiz", kirgan: true },
      { status: 409 }
    );
  }

  const demo = await demoTenantniOl();
  if (!demo) {
    // Demo dataset hali ekilmagan (npm run demo:seed) — mehmon oddiy
    // ro'yxatdan o'tish yo'liga yo'naltiriladi.
    return NextResponse.json({ error: "Demo hozircha mavjud emas" }, { status: 503 });
  }

  session.userId = demo.userId;
  session.login = demo.login;
  session.ism = demo.ism;
  session.rol = normalizeRol(demo.rol);
  session.tenantId = demo.tenantId;
  session.businessId = demo.businessId;
  session.mustChangePassword = false;
  session.sessionEpoch = demo.sessionEpoch;
  session.impersonatedBy = null;
  await session.save();

  await sanoqOshir(kunlikKalit("demo:kirish"));

  return NextResponse.json({ ok: true });
}
