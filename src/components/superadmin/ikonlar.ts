import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  Receipt,
  Blocks,
  LifeBuoy,
  ShieldCheck,
  Server,
  Settings,
  type LucideIcon,
} from "lucide-react";

/**
 * Control Center ikonkalari — `lib/superadmin/navigatsiya.ts` dagi `icon`
 * kalitlari shu xaritaga tushadi. Nav ro'yxati (server/client umumiy) React
 * komponent saqlay olmaydi, shuning uchun xarita ALOHIDA.
 */
export const SA_IKONLAR: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  business: Building2,
  users: Users,
  subscription: CreditCard,
  billing: Receipt,
  modules: Blocks,
  support: LifeBuoy,
  audit: ShieldCheck,
  system: Server,
  settings: Settings,
};

export function saIkon(kalit: string): LucideIcon {
  return SA_IKONLAR[kalit] ?? LayoutDashboard;
}
