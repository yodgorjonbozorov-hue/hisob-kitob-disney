import Link from "next/link";
import { ASOSIY_IMKONIYATLAR, pricingConfig, somFormat } from "@/lib/pricing/config";
import { Bolim, BolimIzoh, BolimSarlavha } from "./qismlar";

/**
 * Landing narx bo'limi — YAGONA narx tizimining qisqa taqdimoti.
 *
 * To'liq kalkulyator ATAYLAB bu yerda emas: landing xaridorni /tariflar
 * sahifasiga yuboradi (asosiy tizim + filiallar + modullar o'sha yerda
 * hisoblanadi). Raqamlar lib/pricing/config.ts dan — sayt hech qachon
 * kalkulyatordagidan boshqa summa ko'rsatmasin.
 *
 * MUHIM: biznes turi narxni O'ZGARTIRMAYDI — sanoatlar uchun alohida
 * tarif YO'Q, shu xabar shu yerda ham takrorlanadi.
 */
export function Narx() {
  return (
    <Bolim id="narx" fon="surface" eni={1100}>
      <BolimSarlavha>Oddiy narx. Yashirin to&apos;lov yo&apos;q.</BolimSarlavha>
      <p data-reveal className="m-0 mt-5 max-w-[60ch] text-[17px] leading-[1.7] text-muted">
        Bitta asosiy obuna — biznes turidan qat&apos;i nazar bir xil. Narx faqat filiallar soni va
        o&apos;zingiz tanlagan qo&apos;shimcha modullardan o&apos;zgaradi.
      </p>

      <div
        data-reveal
        className="mt-10 grid grid-cols-[1.1fr_1fr] items-center gap-8 rounded-[24px] border border-line bg-app p-8 max-[900px]:grid-cols-1"
      >
        <div>
          <h3 className="m-0 font-heading text-[24px] font-semibold text-fg">
            Balansa asosiy tizimi
          </h3>
          <p className="m-0 mt-6 font-display text-[44px] font-bold leading-none tabular-nums text-fg">
            {somFormat(pricingConfig.baseMonthlyPrice)}{" "}
            <span className="font-sans text-[15px] font-medium text-faint">so&apos;m/oy dan</span>
          </p>
          <p className="m-0 mt-3 text-[15px] text-muted">
            1 filial kiritilgan · qo&apos;shimcha filial {somFormat(pricingConfig.additionalBranchPrice)}{" "}
            so&apos;m/oy · yillik to&apos;lovda {pricingConfig.yearlyFreeMonths} oy bepul
          </p>
          <Link
            href="/tariflar"
            className="mt-7 inline-block rounded-[12px] bg-brand-300 px-6 py-[15px] text-[16px] font-semibold text-[#061413] hover:bg-brand-200"
          >
            Narxni hisoblash →
          </Link>
        </div>
        <div className="flex flex-col gap-3">
          {ASOSIY_IMKONIYATLAR.map((i) => (
            <p key={i} className="m-0 text-[15px] text-muted">
              <span aria-hidden="true">✓</span> {i}
            </p>
          ))}
        </div>
      </div>

      <p data-reveal className="m-0 mt-8 text-[14px] leading-[1.7] text-faint">
        14 kun bepul · Karta talab qilinmaydi · Narx butun kompaniya uchun, foydalanuvchi soni
        cheklanmagan · CRM, POS, AI kabi modullar — faqat kerak bo&apos;lsa qo&apos;shasiz
      </p>

      <BolimIzoh savol="«Qancha turadi va nima kiradi?»" />
    </Bolim>
  );
}
