export type FlowStep = "category" | "summa" | "sana" | "sana_custom" | "izoh";

export interface TransactionFlowState {
  step: FlowStep;
  turi: "kirim" | "chiqim";
  categoryId?: string;
  categoryNomi?: string;
  summa?: number;
  sana?: string; // YYYY-MM-DD
}

/** Bot bitta process sifatida ishlaydi, shuning uchun suhbat holatini xotirada saqlash yetarli. */
const conversations = new Map<string, TransactionFlowState>();

export function getFlow(chatId: string): TransactionFlowState | undefined {
  return conversations.get(chatId);
}

export function setFlow(chatId: string, state: TransactionFlowState): void {
  conversations.set(chatId, state);
}

export function clearFlow(chatId: string): void {
  conversations.delete(chatId);
}
