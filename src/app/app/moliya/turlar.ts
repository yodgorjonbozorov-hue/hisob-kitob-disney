import type { PulHarakatiDTO } from "@/lib/queries/moliya";
import type { ShaxsTuri } from "@/lib/moliya/shaxs";
import type { PulUsuli } from "@/lib/moliya/usul";

/** Moliya sahifasi komponentlari uchun umumiy turlar. */

export type { PulHarakatiDTO };

export interface KassaOption {
  id: string;
  nomi: string;
  turi: string;
}

export interface KategoriyaOption {
  id: string;
  nomi: string;
  turi: string;
}

export interface XodimOption {
  id: string;
  ism: string;
}

/** Tanlangan tomon — kartochkali bo'lsa `id` to'ladi, aks holda faqat ism. */
export interface TanlanganShaxs {
  turi: ShaxsTuri;
  id: string | null;
  ism: string;
  /** Serverdan o'qilgan joriy qarz; noma'lum bo'lsa `undefined`. */
  qarz?: number;
}

/** Forma holati — yaratish va tuzatish uchun bitta shakl. */
export interface PulFormasi {
  yonalish: "kirim" | "chiqim";
  shaxs: TanlanganShaxs;
  sababKod: string;
  /** Tayyor sabab o'rniga tanlangan kategoriya (direktor qo'shgani). */
  categoryId: string;
  summa: string;
  usul: PulUsuli;
  accountId: string;
  sana: string;
  izoh: string;
}

/** Tuzatish rejimi: qaysi amal tahrirlanmoqda. */
export interface TahrirHolati {
  amalId: string;
  boshlangich: PulFormasi;
}

export const BOSH_SHAXS: TanlanganShaxs = { turi: "mijoz", id: null, ism: "" };
