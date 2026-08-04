import { rawPrisma } from "@/lib/db/rawPrisma";

/**
 * BOT SUHBAT HOLATI — bazada saqlanadi.
 *
 * Nega xotirada emas: production'da bot Telegram webhook orqali serverless
 * funksiyada ishlaydi. Har so'rov boshqa instansiyaga tushishi mumkin, shuning
 * uchun `new Map()` bilan ko'p qadamli oqim (/kirim, /lead, /mashina, /sotish)
 * tasodifiy o'rtada uzilardi — foydalanuvchi "Amal topilmadi" ko'rardi.
 *
 * `rawPrisma` ishlatiladi: bot holati tizim darajasidagi ma'lumot, u
 * foydalanuvchi tenanti aniqlanishidan OLDIN ham o'qiladi (CLAUDE.md da
 * ruxsat etilgan joy).
 *
 * Bitta chat bir vaqtda bitta oqimda bo'ladi — kalit `chatId`, `flow` esa
 * qaysi oqim ekanini bildiradi. Boshqa oqim so'ralsa eski holat almashtiriladi.
 */

/** Holat shu muddatdan keyin "tashlab ketilgan" hisoblanadi va tozalanadi. */
export const HOLAT_YASHASH_SOAT = 24;

async function read(chatId: string, flow: string): Promise<unknown | undefined> {
  const row = await rawPrisma.botConversation.findUnique({ where: { chatId } });
  if (!row || row.flow !== flow) return undefined;
  try {
    return JSON.parse(row.state);
  } catch {
    // Buzilgan JSON — oqimni qaytadan boshlatgan ma'qul.
    return undefined;
  }
}

async function write(chatId: string, flow: string, state: unknown): Promise<void> {
  const value = JSON.stringify(state);
  await rawPrisma.botConversation.upsert({
    where: { chatId },
    update: { flow, state: value },
    create: { chatId, flow, state: value },
  });
}

async function remove(chatId: string, flow: string): Promise<void> {
  await rawPrisma.botConversation.deleteMany({ where: { chatId, flow } });
}

export interface FlowStore<T> {
  get(chatId: string): Promise<T | undefined>;
  set(chatId: string, state: T): Promise<void>;
  delete(chatId: string): Promise<void>;
}

/**
 * Bitta oqim uchun saqlagich. Interfeysi `Map` bilan bir xil (get/set/delete),
 * farqi — hammasi `await` talab qiladi.
 */
export function flowStore<T>(flow: string): FlowStore<T> {
  return {
    get: (chatId) => read(chatId, flow) as Promise<T | undefined>,
    set: (chatId, state) => write(chatId, flow, state),
    delete: (chatId) => remove(chatId, flow),
  };
}

/** Chatning qaysi oqimda ekanidan qat'i nazar holatni o'chiradi (/bekor, /start). */
export async function clearAllFlows(chatId: string): Promise<void> {
  await rawPrisma.botConversation.deleteMany({ where: { chatId } });
}

/** Tashlab ketilgan suhbatlarni tozalash (cron'da kuniga bir marta). */
export async function cleanupOldConversations(soat = HOLAT_YASHASH_SOAT): Promise<number> {
  const chegara = new Date(Date.now() - soat * 60 * 60 * 1000);
  const res = await rawPrisma.botConversation.deleteMany({
    where: { updatedAt: { lt: chegara } },
  });
  return res.count;
}
