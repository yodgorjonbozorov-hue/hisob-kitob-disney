import {
  Gift, Baby, Music, Sparkles, Wrench, Truck, ShoppingBag, Wallet, Home,
  Briefcase, Users, Zap, PartyPopper, Package, Coins, Receipt, Car, Utensils,
  type LucideIcon,
} from "lucide-react";

// Kalit so'z → ikonka (nom kichik harfda tekshiriladi).
const KEYWORD_ICON: [string, LucideIcon][] = [
  ["tabrik", PartyPopper],
  ["animator", Baby],
  ["o'yinchoq", Gift],
  ["oyinchoq", Gift],
  ["dekor", Sparkles],
  ["bezak", Sparkles],
  ["sveta", Music],
  ["musiqa", Music],
  ["salyut", Zap],
  ["ish haqi", Users],
  ["oylik", Users],
  ["ijara", Home],
  ["transport", Car],
  ["mashina", Car],
  ["yetkaz", Truck],
  ["ovqat", Utensils],
  ["oziq", Utensils],
  ["mahsulot", Package],
  ["tovar", ShoppingBag],
  ["xarid", ShoppingBag],
  ["soliq", Receipt],
  ["ombor", Package],
  ["ta'mir", Wrench],
  ["remont", Wrench],
];

const FALLBACK: LucideIcon[] = [Wallet, Coins, Briefcase, Package, Gift];
const CHART = ["#0B6B5F", "#2F6F91", "#B06A4A", "#6E7F52", "#7A5C82"];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Kategoriya nomidan ikonka + doimiy rang (chart palitrasi). */
export function categoryVisual(nomi: string): { Icon: LucideIcon; color: string } {
  const low = nomi.toLowerCase();
  const match = KEYWORD_ICON.find(([k]) => low.includes(k));
  const h = hash(nomi);
  const Icon = match ? match[1] : FALLBACK[h % FALLBACK.length];
  const color = CHART[h % CHART.length];
  return { Icon, color };
}
