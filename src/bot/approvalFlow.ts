import type { Context } from "grammy";
import type { User } from "@prisma/client";
import { flowStore } from "./conversationStore";
import { tasdiqla, radEt } from "@/lib/services/approval";
import { prisma } from "@/lib/prisma";
import { formatSomLabel } from "@/lib/format";

/**
 * TASDIQ QARORI TELEGRAMDA.
 *
 * Tasdiqlash bir bosishda tugaydi. Rad etish esa sabab talab qiladi (veb bilan
 * bir xil qoida) — shuning uchun tugma bosilgach bot sababni so'raydi va
 * keyingi matn xabari qaror bilan birga yoziladi.
 */
interface RadFlowState {
  requestId: string;
  businessId: string;
}

const radFlow = flowStore<RadFlowState>("tasdiq_rad");

/** So'rovni topadi va uning biznesini qaytaradi (tenant kontekstida). */
async function sorovniTop(requestId: string) {
  return prisma.approvalRequest.findFirst({
    where: { id: requestId },
    select: { id: true, businessId: true, holat: true, summa: true },
  });
}

export async function handleTasdiqCallback(ctx: Context, user: User) {
  const requestId = (ctx.callbackQuery?.data ?? "").slice(8);
  const sorov = await sorovniTop(requestId);
  if (!sorov) {
    await ctx.answerCallbackQuery({ text: "So'rov topilmadi" });
    return;
  }

  try {
    await tasdiqla({
      businessId: sorov.businessId,
      requestId: sorov.id,
      tasdiqlovchi: { id: user.id, rol: user.rol },
    });
  } catch (error) {
    const xabar = error instanceof Error ? error.message : "Tasdiqlab bo'lmadi";
    await ctx.answerCallbackQuery({ text: xabar });
    return;
  }

  await ctx.answerCallbackQuery({ text: "Tasdiqlandi" });
  await ctx.editMessageText(
    `✅ Tasdiqlandi — ${formatSomLabel(sorov.summa)} chiqim yozildi.\nTasdiqladi: ${user.ism}`
  );
}

export async function handleRadCallback(ctx: Context, user: User) {
  const requestId = (ctx.callbackQuery?.data ?? "").slice(8);
  const sorov = await sorovniTop(requestId);
  if (!sorov) {
    await ctx.answerCallbackQuery({ text: "So'rov topilmadi" });
    return;
  }
  if (sorov.holat !== "kutilmoqda") {
    await ctx.answerCallbackQuery({ text: "Bu so'rov bo'yicha qaror chiqarilgan" });
    return;
  }

  await radFlow.set(String(ctx.chat!.id), { requestId: sorov.id, businessId: sorov.businessId });
  await ctx.answerCallbackQuery();
  await ctx.reply("Rad etish sababini yozing (bekor qilish uchun /bekor):");
}

/** Matn xabari rad sababimi — shunday bo'lsa qaror yoziladi va `true` qaytadi. */
export async function handleRadText(ctx: Context, user: User): Promise<boolean> {
  const chatId = String(ctx.chat!.id);
  const flow = await radFlow.get(chatId);
  if (!flow) return false;

  const sabab = (ctx.message?.text ?? "").trim();
  if (sabab.length < 3) {
    await ctx.reply("Sabab juda qisqa — kamida 3 ta belgi yozing.");
    return true;
  }

  try {
    await radEt({
      businessId: flow.businessId,
      requestId: flow.requestId,
      tasdiqlovchi: { id: user.id, rol: user.rol },
      sabab: sabab.slice(0, 300),
    });
  } catch (error) {
    await radFlow.delete(chatId);
    await ctx.reply(error instanceof Error ? error.message : "Rad etib bo'lmadi");
    return true;
  }

  await radFlow.delete(chatId);
  await ctx.reply(`❌ So'rov rad etildi.\nSabab: ${sabab}`);
  return true;
}

export function clearRadFlow(chatId: string): Promise<void> {
  return radFlow.delete(chatId);
}
