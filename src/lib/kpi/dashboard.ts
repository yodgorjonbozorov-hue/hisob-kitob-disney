import type { XodimOylikHisobi } from "./oylik";

/**
 * DIREKTOR DASHBOARD XULOSASI — hisoblangan xodimlar ro'yxatidan chiqadi.
 * Alohida so'rov qilmaydi: `hisoblaBarchasi` natijasini umumlashtiradi,
 * shuning uchun xulosa kartochkalar bilan hech qachon qarama-qarshi bo'lmaydi.
 */

export interface ReytingQatori {
  employeeId: string;
  ism: string;
  rasmUrl: string | null;
  sotuv: number;
  planFoizi: number;
  ball: number;
  jami: number;
}

export interface DashboardXulosa {
  jamiXodim: number;
  jamiSotuv: number;
  /** Barcha xodimlarning joriy hisoblangan oyligi (oylik prognozi). */
  oylikPrognozi: number;
  /** Plani bor va bajarganlar / plani borlar soni. */
  planBajargan: number;
  planliXodim: number;
  /** Ball holati "risk" yoki "kritik" bo'lganlar soni. */
  riskdagilar: number;
  reyting: ReytingQatori[];
}

export function dashboardXulosasi(xodimlar: XodimOylikHisobi[]): DashboardXulosa {
  // Ishdan chiqqan xodim xulosani buzmasligi kerak — faqat faollar.
  const faol = xodimlar.filter((x) => x.isActive);
  const planlilar = faol.filter((x) => x.plan > 0);

  const reyting: ReytingQatori[] = [...faol]
    .sort((a, b) => b.sotuv - a.sotuv || b.jami - a.jami)
    .map((x) => ({
      employeeId: x.employeeId,
      ism: x.ism,
      rasmUrl: x.rasmUrl,
      sotuv: x.sotuv,
      planFoizi: x.planFoizi,
      ball: x.ortachaBall,
      jami: x.jami,
    }));

  return {
    jamiXodim: faol.length,
    jamiSotuv: faol.reduce((s, x) => s + x.sotuv, 0),
    oylikPrognozi: faol.reduce((s, x) => s + x.jami, 0),
    planBajargan: planlilar.filter((x) => x.planBajarildi).length,
    planliXodim: planlilar.length,
    riskdagilar: faol.filter((x) => x.ballHolati === "risk" || x.ballHolati === "kritik").length,
    reyting,
  };
}
