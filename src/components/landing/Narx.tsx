import Link from "next/link";
import { planByCode } from "@/lib/billing/plans";
import { formatSom } from "@/lib/format";
import { Bolim, BolimIzoh, BolimSarlavha } from "./qismlar";

/**
 * Landing tarif kartalari. Narx va tarif nomi `lib/billing/plans.ts` dan
 * olinadi — sayt hech qachon to'lov sahifasidagi summadan boshqa raqam
 * ko'rsatmasin. Imkoniyat ro'yxati esa marketing matni (dizayndan).
 */
const IMKONLAR = [
  "Kirim-chiqim va kassalar",
  "Kunlik hisobot va kassa solishtiruvi",
  "Ombor va sotuv",
  "Qarzdorlik va mijoz limiti",
  "Budjet",
  "Hisobotlar — PDF va Excel",
  "Telegram bot",
];

const PRO_QOSHIMCHA = [
  "CRM va Mijozlar",
  "AI yordamchi",
  "HR va Vazifalar",
  "Xarid va Shartnomalar",
];

/** "Oddiy narx. Yashirin to'lov yo'q." — ikkita tarif, o'ngdagisi ajratilgan. */
export function Narx() {
  const asosiy = planByCode("STANDARD");
  const pro = planByCode("PRO");

  return (
    <Bolim id="narx" fon="surface" eni={1100}>
      <BolimSarlavha>Oddiy narx. Yashirin to&apos;lov yo&apos;q.</BolimSarlavha>

      <div className="mt-12 grid grid-cols-[1fr_1.08fr] items-center gap-6 max-[900px]:grid-cols-1">
        <div data-reveal className="rounded-[24px] border border-line bg-app p-8">
          <h3 className="m-0 font-heading text-[24px] font-semibold text-fg">
            {asosiy?.nomi ?? "Standart"}
          </h3>
          <p className="m-0 mt-2 text-[15px] text-muted">Kundalik hisob-kitob to&apos;liq.</p>
          <Narxi qiymat={asosiy?.oylikNarx} olcham={44} />

          <div className="mt-7 flex flex-col gap-3">
            {IMKONLAR.map((i) => (
              <p key={i} className="m-0 text-[15px] text-muted">
                <span aria-hidden="true">✓</span> {i}
              </p>
            ))}
          </div>

          <Link
            href="/signup"
            className="mt-7 block rounded-[12px] border border-line-strong p-3.5 text-center text-[16px] font-semibold text-fg hover:bg-surface-2"
          >
            Bepul boshlash
          </Link>
        </div>

        <div
          data-reveal
          className="relative rounded-[24px] border-[1.5px] border-brand-300 bg-app px-8 py-10 shadow-lift"
        >
          <span className="absolute -top-[13px] left-8 rounded-full bg-brand-300 px-3.5 py-1.5 text-[12px] font-bold tracking-[0.03em] text-[#061413]">
            Ommabop
          </span>

          <h3 className="m-0 font-heading text-[26px] font-semibold text-fg">
            {pro?.nomi ?? "Pro"}
          </h3>
          <p className="m-0 mt-2 text-[15px] text-muted">
            Boshqaruv modullari bilan to&apos;liq platforma.
          </p>
          <Narxi qiymat={pro?.oylikNarx} olcham={52} />

          <p className="m-0 mt-7 text-[15px] font-semibold text-fg">
            {asosiy?.nomi ?? "Standart"} tarifidagi hammasi, ustiga:
          </p>
          <div className="mt-3.5 flex flex-col gap-3">
            {PRO_QOSHIMCHA.map((i) => (
              <p key={i} className="m-0 text-[15px] text-muted">
                <span aria-hidden="true" className="font-semibold text-brand">
                  +
                </span>{" "}
                {i}
              </p>
            ))}
          </div>

          <Link
            href="/signup"
            className="mt-8 block rounded-[12px] bg-brand-300 p-[15px] text-center text-[16px] font-semibold text-[#061413] hover:bg-brand-200"
          >
            Bepul boshlash
          </Link>
        </div>
      </div>

      <p data-reveal className="m-0 mt-8 text-[14px] leading-[1.7] text-faint">
        14 kun bepul · Karta talab qilinmaydi · Payme, Click yoki bank o&apos;tkazmasi · Narx butun
        kompaniya uchun, foydalanuvchi soni cheklanmagan
      </p>

      <BolimIzoh savol="«Qancha turadi va nima kiradi?»" />
    </Bolim>
  );
}

/** Oylik narx — Manrope 700, tabular. Tarif topilmasa summa umuman chizilmaydi. */
function Narxi({ qiymat, olcham }: { qiymat: number | undefined; olcham: 44 | 52 }) {
  if (qiymat === undefined) return null;
  return (
    <p
      className={`m-0 mt-6 font-display font-bold leading-none tabular-nums text-fg ${
        olcham === 52 ? "text-[52px]" : "text-[44px]"
      }`}
    >
      {formatSom(qiymat)}{" "}
      <span className="font-sans text-[15px] font-medium text-faint">so&apos;m/oy</span>
    </p>
  );
}
