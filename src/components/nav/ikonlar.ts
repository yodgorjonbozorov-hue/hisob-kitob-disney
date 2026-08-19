import {
  LayoutDashboard, Receipt, FileText, PiggyBank, CalendarCheck, Repeat, Wallet, Banknote,
  Package, ShoppingCart, HandCoins, Truck, Factory, Building2, Tags, Users, Trash2, ScrollText,
  BadgeCheck, Gavel, Contact2, IdCard, CalendarDays, FileSignature, ClipboardList,
  CreditCard, Blocks, Handshake, BookUser, ListChecks, Sparkles, ShieldCheck, Menu, BarChart3,
  Home, Send, Scale, ScanBarcode, QrCode, ReceiptText, type LucideIcon,
} from "lucide-react";

/**
 * Registry'dagi ikon kaliti -> lucide komponenti. YAGONA manba: yon menyu
 * (Sidebar), mobil pastki panel (BottomNav) va public sayt bir xil to'plamdan
 * oladi. Ilgari BottomNav o'zining qo'lda chizilgan SVG yo'llarini ishlatardi —
 * shu sababli "crm" tabi umuman ikonkasiz chiqardi.
 */
export const IKONLAR: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  home: Home,
  list: Receipt,
  chart: BarChart3,
  menu: Menu,
  receipt: Receipt,
  report: FileText,
  budget: PiggyBank,
  wallet: Wallet,
  cash: Banknote,
  purchase: Truck,
  supplier: Factory,
  approval: BadgeCheck,
  rule: Gavel,
  customers: Contact2,
  hr: IdCard,
  attendance: CalendarDays,
  contract: FileSignature,
  repeat: Repeat,
  shift: CalendarCheck,
  daily: ClipboardList,
  package: Package,
  cart: ShoppingCart,
  debt: HandCoins,
  business: Building2,
  tags: Tags,
  users: Users,
  shield: ShieldCheck,
  trash: Trash2,
  audit: ScrollText,
  modules: Blocks,
  billing: CreditCard,
  crm: Handshake,
  contacts: BookUser,
  tasks: ListChecks,
  ai: Sparkles,
  telegram: Send,
  // Kg savdosi (mijozga xos) — tarozi.
  weight: Scale,
  // MAGAZIN moduli.
  pos: ScanBarcode,
  qr: QrCode,
  chek: ReceiptText,
};

/** Noma'lum kalit kelsa ham ikonkasiz bo'sh joy qolmasin. */
export function ikon(kalit: string): LucideIcon {
  return IKONLAR[kalit] ?? Receipt;
}
