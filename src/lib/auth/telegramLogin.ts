/**
 * TELEGRAM ORQALI KIRISH — bot tasdig'i bilan (deep link).
 *
 * Oqim:
 *   1. Brauzer `boshlash()` — tasodifiy TOKEN (havolada) va NONCE (httpOnly
 *      cookie'da) oladi. Bazada faqat ikkalasining SHA-256 xeshi turadi.
 *   2. Foydalanuvchi `t.me/<bot>?start=login_<TOKEN>` ni ochadi. Bot chatni
 *      bog'langan akkauntga moslaydi va "Tasdiqlash / Rad etish" so'raydi
 *      (`botdaOchildi`). Xabarda IP va brauzer ko'rsatiladi.
 *   3. Tasdiqlansa (`botQarori`) — so'rov akkauntga biriktiriladi.
 *   4. Brauzer `holat()` ni so'rab turadi; tasdiqlangan so'rovni TOKEN +
 *      NONCE bilan BIR MARTA oladi (`olish`) va sessiya ochiladi.
 *
 * Nega NONCE: havola (TOKEN) Telegram'ga, tarixga, skrinshotga tushadi. Uni
 * ko'rgan boshqa brauzer sessiyani ololmasligi uchun kirish so'rovni
 * BOSHLAGAN brauzerning cookie'siga bog'langan.
 *
 * Saqlash: `AppSetting` (kalit-qiymat) — yangi jadval/migratsiya kerak emas.
 * Yozuvlar 5 daqiqa yashaydi va har yangi so'rovda eskilari tozalanadi.
 */
// Tizim darajasi: so'rov hali hech qaysi tenantga tegishli emas — rawPrisma.
import { rawPrisma as prisma } from "@/lib/db/rawPrisma";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { User } from "@prisma/client";

export const TG_LOGIN_TTL_MS = 5 * 60 * 1000;
const KALIT_OLD = "tglogin:";

export type TgHolat = "kutilmoqda" | "tasdiqlandi" | "rad" | "boglanmagan";

interface Yozuv {
  holat: TgHolat;
  /** Tugash vaqti (ms). */
  exp: number;
  /** NONCE ning SHA-256 xeshi (hex). */
  nonce: string;
  ip: string | null;
  brauzer: string | null;
  /** Botda ochgan chat — tasdiqni faqat shu chat bera oladi. */
  chatId: string | null;
  /** Tasdiqlangan akkaunt. */
  userId: string | null;
}

const xesh = (s: string) => createHash("sha256").update(s).digest("hex");
/** Kalit — token xeshining 40 belgisi (160 bit): Telegram callback_data 64 baytga sig'sin. */
const idOl = (token: string) => xesh(token).slice(0, 40);
const kalit = (id: string) => `${KALIT_OLD}${id}`;

function tengmi(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function oqi(id: string): Promise<Yozuv | null> {
  const r = await prisma.appSetting.findUnique({ where: { key: kalit(id) } });
  if (!r) return null;
  try {
    const y = JSON.parse(r.value) as Yozuv;
    return y.exp > Date.now() ? y : null;
  } catch {
    return null;
  }
}

async function yoz(id: string, y: Yozuv): Promise<void> {
  await prisma.appSetting.update({ where: { key: kalit(id) }, data: { value: JSON.stringify(y) } });
}

/** User-Agent dan qisqa, o'qiladigan nom: "Chrome · macOS". */
export function brauzerNomi(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const brauzer = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /YaBrowser/.test(ua)
        ? "Yandex"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Firefox\//.test(ua)
            ? "Firefox"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Brauzer";
  const tizim = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  return tizim ? `${brauzer} · ${tizim}` : brauzer;
}

/** Muddati o'tgan yozuvlarni tozalaydi (har yangi so'rovda; hech qachon xato tashlamaydi). */
async function eskilarniTozala(): Promise<void> {
  try {
    const yozuvlar = await prisma.appSetting.findMany({
      where: { key: { startsWith: KALIT_OLD } },
      take: 200,
    });
    const hozir = Date.now();
    const eski = yozuvlar
      .filter((r) => {
        try {
          return (JSON.parse(r.value) as Yozuv).exp <= hozir;
        } catch {
          return true;
        }
      })
      .map((r) => r.key);
    if (eski.length > 0) await prisma.appSetting.deleteMany({ where: { key: { in: eski } } });
  } catch (error) {
    console.error("Telegram kirish yozuvlarini tozalash xatosi:", error);
  }
}

/** 1-qadam: yangi kirish so'rovi. `token` havolaga, `nonce` cookie'ga yoziladi. */
export async function boshlash(p: { ip: string | null; userAgent: string | null }) {
  await eskilarniTozala();
  const token = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const exp = Date.now() + TG_LOGIN_TTL_MS;
  const y: Yozuv = {
    holat: "kutilmoqda",
    exp,
    nonce: xesh(nonce),
    ip: p.ip,
    brauzer: brauzerNomi(p.userAgent),
    chatId: null,
    userId: null,
  };
  await prisma.appSetting.create({ data: { key: kalit(idOl(token)), value: JSON.stringify(y) } });
  return { token, nonce, expiresAt: exp };
}

export type BotOchishNatija =
  | { tur: "topilmadi" }
  | { tur: "boglanmagan" }
  | { tur: "tasdiq_kerak"; id: string; ism: string; ip: string | null; brauzer: string | null };

/** 2-qadam: bot `/start login_<token>` ni oldi. */
export async function botdaOchildi(token: string, chatId: string): Promise<BotOchishNatija> {
  const id = idOl(token);
  const y = await oqi(id);
  if (!y || y.holat !== "kutilmoqda") return { tur: "topilmadi" };

  const user = await prisma.user.findUnique({ where: { telegramChatId: chatId } });
  if (!user || !user.isActive) {
    // Sahifa foydalanuvchiga "Telegram akkauntga bog'lanmagan" deb aytishi uchun.
    await yoz(id, { ...y, holat: "boglanmagan" });
    return { tur: "boglanmagan" };
  }
  await yoz(id, { ...y, chatId });
  return { tur: "tasdiq_kerak", id, ism: user.ism, ip: y.ip, brauzer: y.brauzer };
}

/** 3-qadam: botdagi tugma. Faqat so'rovni ochgan chat qaror qila oladi. */
export async function botQarori(
  id: string,
  chatId: string,
  tasdiq: boolean
): Promise<"tasdiqlandi" | "rad" | "eskirgan"> {
  const y = await oqi(id);
  if (!y || y.holat !== "kutilmoqda" || y.chatId !== chatId) return "eskirgan";
  if (!tasdiq) {
    await yoz(id, { ...y, holat: "rad" });
    return "rad";
  }
  // Tasdiq paytida akkaunt QAYTA tekshiriladi: oraliqda bog'lanish uzilgan yoki
  // akkaunt o'chirilgan bo'lishi mumkin.
  const user = await prisma.user.findUnique({ where: { telegramChatId: chatId } });
  if (!user || !user.isActive) return "eskirgan";
  await yoz(id, { ...y, holat: "tasdiqlandi", userId: user.id });
  return "tasdiqlandi";
}

export type BrauzerHolat = TgHolat | "eskirgan";

/**
 * 4-qadam: brauzer holatni so'raydi. Tasdiqlangan bo'lsa yozuv ATOMIK
 * o'chiriladi (bir marta ishlatiladi) va `userId` qaytadi.
 * NONCE mos kelmasa — so'rov boshqa brauzerniki, "eskirgan" deb javob beriladi.
 */
export async function holat(
  token: string,
  nonce: string | null | undefined
): Promise<{ holat: BrauzerHolat; user?: User }> {
  if (!token || !nonce) return { holat: "eskirgan" };
  const id = idOl(token);
  const y = await oqi(id);
  if (!y || !tengmi(y.nonce, xesh(nonce))) return { holat: "eskirgan" };
  if (y.holat !== "tasdiqlandi" || !y.userId) return { holat: y.holat };

  // Bir martalik: parallel ikki so'rovdan faqat bittasi o'chira oladi.
  const ochirildi = await prisma.appSetting.deleteMany({
    where: { key: kalit(id), value: JSON.stringify(y) },
  });
  if (ochirildi.count !== 1) return { holat: "eskirgan" };
  // Akkaunt sessiya ochilishidan OLDIN qayta tekshiriladi (tasdiqdan keyin
  // o'chirilgan bo'lishi mumkin).
  const user = await prisma.user.findUnique({ where: { id: y.userId } });
  if (!user || !user.isActive) return { holat: "eskirgan" };
  return { holat: "tasdiqlandi", user };
}

/** Brauzer bekor qildi — yozuv o'chadi, botdagi tugma endi ishlamaydi. */
export async function bekorQilish(token: string, nonce: string | null | undefined): Promise<void> {
  if (!token || !nonce) return;
  const id = idOl(token);
  const y = await oqi(id);
  if (y && tengmi(y.nonce, xesh(nonce))) {
    await prisma.appSetting.deleteMany({ where: { key: kalit(id) } });
  }
}

/** Start payload: `login_<token>` (Telegram: 1–64 belgi, A-Z a-z 0-9 _ -). */
export const START_PREFIKS = "login_";
export function startPayloaddanToken(payload: string | undefined): string | null {
  if (!payload || !payload.startsWith(START_PREFIKS)) return null;
  const t = payload.slice(START_PREFIKS.length);
  return /^[A-Za-z0-9_-]{43}$/.test(t) ? t : null;
}
