import { flowStore } from "./conversationStore";

export type FlowStep = "business" | "category" | "summa" | "sana" | "sana_custom" | "kassa" | "izoh";

export interface TransactionFlowState {
  step: FlowStep;
  turi: "kirim" | "chiqim";
  businessId?: string;
  categoryId?: string;
  categoryNomi?: string;
  summa?: number;
  sana?: string; // YYYY-MM-DD
  /** Qaysi kassaga tushdi. Bitta kassali biznesda bu qadam so'ralmaydi. */
  accountId?: string;
}

/**
 * Kirim/chiqim oqimi holati. Bazada saqlanadi — production'da bot serverless
 * webhook bo'lgani uchun xotiradagi Map oqimni o'rtada uzardi
 * (batafsil: ./conversationStore.ts).
 */
const conversations = flowStore<TransactionFlowState>("transaction");

export function getFlow(chatId: string): Promise<TransactionFlowState | undefined> {
  return conversations.get(chatId);
}

export function setFlow(chatId: string, state: TransactionFlowState): Promise<void> {
  return conversations.set(chatId, state);
}

export function clearFlow(chatId: string): Promise<void> {
  return conversations.delete(chatId);
}
