import { Bolim, BolimIzoh, BolimSarlavha, Pul } from "./qismlar";

const KASSA = [
  { belgi: "💵", nomi: "Naqd", qiymat: 4_250_000 },
  { belgi: "💳", nomi: "Click", qiymat: 1_800_000 },
  { belgi: "📋", nomi: "Qarz", qiymat: 600_000 },
];

const QADAMLAR = ["Xodim kiritadi", "Kassani sanab topshiradi", "Direktor Telegramda tasdiqlaydi"];

/**
 * "Kun oxirida — 30 soniya" — mahsulotning o'zagi: xodim sanaydi, tizim
 * solishtiradi, direktor tasdiqlaydi. Ikki karta yonma-yon: chapda kassa
 * yakuni, o'ngda tizim hisobi bilan solishtiruv va topilgan farq.
 */
export function KunYakuni() {
  return (
    <Bolim id="kunlik" fon="surface">
      <BolimSarlavha olcham={48}>Kun oxirida — 30 soniya</BolimSarlavha>
      <p data-reveal className="m-0 mt-4 max-w-[58ch] text-[18px] leading-[1.6] text-muted">
        Xodim sanaydi. Tizim solishtiradi. Siz tasdiqlaysiz.
      </p>

      <div className="mt-14 grid grid-cols-2 items-start gap-8 max-[900px]:grid-cols-1 max-[900px]:gap-6">
        <KassaYakuni />
        <Solishtiruv />
      </div>

      <div
        data-reveal
        className="mt-14 flex items-center rounded-[24px] border border-line bg-surface-2 p-8 max-[900px]:flex-col max-[900px]:items-stretch max-[900px]:gap-6"
      >
        {QADAMLAR.map((q, i) => (
          <div key={q} className="contents">
            {i > 0 && (
              <div
                aria-hidden="true"
                className="h-px w-16 flex-none bg-line-strong max-[900px]:hidden"
              />
            )}
            <div className="flex flex-1 items-center gap-4">
              <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full border border-line-strong bg-surface font-display text-[14px] font-bold text-brand">
                {i + 1}
              </span>
              <span className="text-[16px] text-fg">{q}</span>
            </div>
          </div>
        ))}
      </div>

      <BolimIzoh savol="«Pul yo'qolganini qanday bilaman?»" />
    </Bolim>
  );
}

/** Chap karta — xodim topshirgan kassa yakuni. */
function KassaYakuni() {
  return (
    <div data-reveal className="rounded-[24px] border border-line bg-surface-2 p-7">
      <p className="m-0 mb-5 text-[13px] font-semibold uppercase tracking-[0.04em] text-faint">
        Kassa yakuni
      </p>

      <div className="flex flex-col gap-2.5">
        {KASSA.map((k) => (
          <div
            key={k.nomi}
            className="flex items-center justify-between rounded-[12px] border border-line bg-surface px-[18px] py-4"
          >
            <span className="text-[15px] text-muted">
              {k.belgi} {k.nomi}
            </span>
            <Pul qiymat={k.qiymat} className="text-[19px] text-fg" />
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-end justify-between border-t border-line-strong pt-5">
        <div>
          <p className="m-0 text-[14px] text-faint">Jami</p>
          <p className="m-0 mt-1.5 font-display text-[34px] font-bold leading-none tabular-nums text-fg">
            <Pul qiymat={6_650_000} sanoq />{" "}
            <span className="text-[15px] font-semibold text-faint">so&apos;m</span>
          </p>
        </div>
        <span className="inline-flex items-center gap-[7px] rounded-full bg-income-soft px-3.5 py-2 text-[13px] font-semibold text-income-fg">
          <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-income" />
          Tasdiqlangan
        </span>
      </div>
    </div>
  );
}

/** O'ng karta — tizim hisobi bilan solishtiruv va topilgan farq. */
function Solishtiruv() {
  return (
    <div data-reveal className="rounded-[24px] border border-line-strong bg-surface p-7 shadow-lift">
      <p className="m-0 mb-5 text-[13px] font-semibold uppercase tracking-[0.04em] text-faint">
        Kassa solishtiruvi
      </p>

      <div className="flex items-baseline justify-between py-3.5">
        <span className="text-[16px] text-muted">Naqd (tizim hisobi)</span>
        <Pul qiymat={4_250_000} className="text-[22px] text-fg" />
      </div>
      <div className="flex items-baseline justify-between border-t border-line py-3.5">
        <span className="text-[16px] text-muted">Naqd (xodim sanadi)</span>
        <Pul qiymat={3_910_000} className="text-[22px] text-fg" />
      </div>

      <div className="mt-5 flex items-center justify-between gap-4 rounded-[16px] border border-expense bg-expense-soft p-5">
        <span className="inline-flex items-center gap-2.5 text-[15px] font-semibold text-expense">
          Farq
          <span className="rounded-full border border-expense px-2.5 py-1 text-[12px] font-bold tracking-[0.06em]">
            ⚠️ KAM
          </span>
        </span>
        <Pul
          qiymat={-340_000}
          sanoq
          className="text-[36px] leading-none text-expense max-[900px]:text-[28px]"
        />
      </div>

      <p className="m-0 mt-4 text-[14px] leading-[1.6] text-faint">
        Farq chiqsa kun yopilmaydi — izoh yozilmaguncha ochiq turadi va audit jurnaliga tushadi.
      </p>
    </div>
  );
}
