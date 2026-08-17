import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { getAccessibleBusinesses, resolveActiveBusinessId } from "@/lib/business";
import { getEnabledModules } from "@/lib/modules/guard";
import { computeNav, computeMobileTabs } from "@/lib/modules/registry";
import { userHuquqlari } from "@/lib/permissions/tekshir";
import { isAvto } from "@/lib/biznesTuri";
import { isPro } from "@/lib/billing/pro";
import { ACCESS_DAQIQA } from "@/lib/auth/mobil";

/**
 * BOOTSTRAP — ilova ochilganda kerak bo'ladigan hamma narsa BITTA so'rovda.
 *
 * NEGA: bugun mobil ilova ochilishi uchun 9 ta alohida so'rov kerak bo'lardi
 * (sessiya, tenant, obuna holati, modullar, nav, huquqlar, bizneslar, aktiv
 * biznes, bildirishnoma soni). Telefonda har so'rov radioni uyg'otadi —
 * bu batareya va kechikish. Bitta so'rov ancha arzon.
 *
 * `billing: true` — obuna tugagan bo'lsa ham javob beriladi. Aks holda
 * ilova "obuna tugagan" ekranini ko'rsata olmasdi: u ham shu ma'lumotga
 * muhtoj (aylanma bog'liqlik).
 */
export const GET = withTenant(
  async (_request, _routeCtx, ctx) => {
    const { session, tenant, access } = ctx;

    const [bizneslar, aktivBiznesId, yoqilganModullar, huquqlar] = await Promise.all([
      getAccessibleBusinesses(session),
      resolveActiveBusinessId(session),
      getEnabledModules(ctx),
      userHuquqlari(session.userId),
    ]);

    const aktivBiznes = bizneslar.find((b) => b.id === aktivBiznesId) ?? null;

    const navHolati = {
      rol: session.rol,
      yoqilgan: yoqilganModullar,
      omborli: aktivBiznes?.omborli ?? false,
      avto: isAvto(aktivBiznes?.turi),
      pro: isPro(tenant.plan),
      // Native ilova ham App Store qoidalariga bo'ysunadi: obuna havolasi
      // menyuda ko'rsatilmaydi (3.1.1) — veb bilan bir xil mantiq.
      iosIlova: true,
    };

    return NextResponse.json({
      user: {
        id: session.userId,
        ism: session.ism,
        login: session.login,
        rol: session.rol,
        mustChangePassword: session.mustChangePassword,
      },
      tenant: {
        id: tenant.id,
        nomi: tenant.name,
        plan: tenant.plan,
        status: tenant.status,
        bepul: tenant.bepul,
      },
      access: {
        rejim: access.mode,
        sabab: access.sabab,
        kunQoldi: access.kunQoldi,
        ogohlantirish: access.ogohlantirish,
      },
      modullar: [...yoqilganModullar],
      huquqlar: [...huquqlar],
      bizneslar: bizneslar.map((b) => ({
        id: b.id,
        nomi: b.nomi,
        omborli: b.omborli,
        turi: b.turi,
      })),
      aktivBiznesId,
      nav: computeNav(navHolati),
      tablar: computeMobileTabs(navHolati),
      /** Klient soatini serverga moslashi uchun (token muddati hisobi). */
      serverVaqti: new Date().toISOString(),
      accessDaqiqa: ACCESS_DAQIQA,
      /**
       * Shu versiyadan past ilova ishlashdan to'xtaydi (BAL-308).
       * Hozircha 1.0.0 — majburiy yangilash yo'q.
       */
      minIlovaVersiyasi: "1.0.0",
    });
  },
  { billing: true, readonlyOk: true },
);
