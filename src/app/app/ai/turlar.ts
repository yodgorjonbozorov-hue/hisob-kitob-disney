import type { Havola } from "@/lib/ai/analitika";

/** Ekrandagi bitta xabar. */
export interface Xabar {
  rol: "user" | "assistant";
  matn: string;
  havolalar?: Havola[];
  takliflar?: string[];
}

export interface SuhbatQator {
  id: string;
  sarlavha: string;
  yangilangan: string;
}

/** Davr tanlagichdagi variantlar — `lib/ai/davr.ts` kodlari bilan bir xil. */
export const DAVR_VARIANTLARI: Array<{ kod: string; yorliq: string }> = [
  { kod: "bugun", yorliq: "Bugun" },
  { kod: "hafta", yorliq: "Bu hafta" },
  { kod: "oy", yorliq: "Bu oy" },
  { kod: "3oy", yorliq: "3 oy" },
  { kod: "yil", yorliq: "Yil" },
];

export type { Havola };
