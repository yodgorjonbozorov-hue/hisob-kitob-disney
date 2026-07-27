import { NextResponse } from "next/server";
// Self-service: faqat sessiyadagi o'z userId bilan ishlaydi — rawPrisma xavfsiz.
import { rawPrisma as prisma } from "@/lib/db/rawPrisma";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, UnauthorizedError } from "@/lib/auth/guard";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 daqiqa

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

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
