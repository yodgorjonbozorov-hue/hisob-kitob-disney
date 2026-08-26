import { ustunKaliti } from "@/lib/csv";

/**
 * Rasm ustunining tanilgan nomlari — BITTA manba.
 *
 * Ikki joyda kerak: server importi ("Rasm" ustunini maydonga bog'lash) va
 * brauzerdagi rasmli import (exceldan chiqqan rasm havolalarini faylda
 * allaqachon bor ustunga yozish yoki yangisini qo'shish). Ro'yxat ikkiga
 * bo'linsa, klient qo'shgan ustunni server tanimay qolishi mumkin edi.
 */
export const RASM_USTUN_KALITLARI = [
  "rasm",
  "rasmi",
  "surat",
  "surati",
  "rasmurl",
  "rasmhavolasi",
  "image",
  "imageurl",
  "photo",
  "foto",
] as const;

/** Sarlavhada rasm ustuni qaysi indeksda — topilmasa -1. */
export function rasmUstunIndeksi(sarlavha: string[]): number {
  const kalitlar = new Set<string>(RASM_USTUN_KALITLARI);
  return sarlavha.findIndex((nom) => kalitlar.has(ustunKaliti(nom)));
}
