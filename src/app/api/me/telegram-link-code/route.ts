import { NextResponse } from "next/server";
// Self-service: faqat sessiyadagi o'z userId bilan ishlaydi — rawPrisma xavfsiz.
import { rawPrisma as prisma } from "@/lib/db/rawPrisma";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, UnauthorizedError } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/rateLimit";
import { randomInt } from "node:crypto";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 daqiqa
/** Bir foydalanuvchi soatiga necha marta yangi kod so'ray oladi. */
const KOD_OYNA_MS = 60 * 60 * 1000;
const KOD_LIMIT = 10;

/**
 * 6 raqamli bog'lash kodi.
 * `Math.random` KRIPTOGRAFIK EMAS — uning natijasi bashorat qilinishi mumkin,
 * ya'ni hujumchi boshqa odamning kodini taxmin qilib hisobiga ulanib olardi.
 * `crypto.randomInt` esa kriptografik generator.
 */
function generateCode(): string {
  return String(randomInt(100000, 1000000));
}

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    // Kod so'rashni cheklaymiz — cheksiz yangi kod olish urinishlar oynasini
    // qayta-qayta tiklab, taxmin qilish imkoniyatini oshirardi.
    const rl = await rateLimit(`tglink:${user.userId}`, KOD_LIMIT, KOD_OYNA_MS);
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Juda ko'p urinish. ${rl.retryAfter} soniyadan keyin qayta urining.` },
        { status: 429 }
      );
    }

    const linkCode = generateCode();
    const linkCodeExpiresAt = new Date(Date.now() + CODE_TTL_MS);

    await prisma.user.update({
      where: { id: user.userId },
      data: { linkCode, linkCodeExpiresAt },
    });

    return NextResponse.json({
      code: linkCode,
      expiresAt: linkCodeExpiresAt.toISOString(),
      botUsername: process.env.TELEGRAM_BOT_USERNAME ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const me = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { telegramChatId: true },
    });

    return NextResponse.json({ linked: !!me?.telegramChatId });
  } catch (error) {
    return handleApiError(error);
  }
}
