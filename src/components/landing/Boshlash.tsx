import { Bolim, BolimIzoh, BolimSarlavha } from "./qismlar";

const QADAMLAR = ["Ro'yxatdan o'ting", "Biznes va xodimlarni qo'shing", "Bugungi kunni yoping"];

/** "15 daqiqada ishga tushirasiz" — boshlashning uchta qadami. */
export function Boshlash() {
  return (
    <Bolim>
      <BolimSarlavha>15 daqiqada ishga tushirasiz</BolimSarlavha>

      <div className="mt-12 grid grid-cols-3 gap-6 max-[900px]:grid-cols-1">
        {QADAMLAR.map((q, i) => (
          <div
            key={q}
            data-reveal
            className="rounded-[24px] border border-line bg-surface p-7 shadow-lift"
          >
            <p
              aria-hidden="true"
              className="m-0 font-display text-[52px] font-bold leading-none tabular-nums text-brand-300"
            >
              {i + 1}
            </p>
            <p className="m-0 mt-4 text-[19px] leading-[1.5] text-fg">{q}</p>
          </div>
        ))}
      </div>

      <BolimIzoh savol="«Boshlash qancha vaqt oladi?»" />
    </Bolim>
  );
}
