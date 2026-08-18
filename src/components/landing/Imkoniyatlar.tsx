import { Bolim, BolimIzoh, BolimSarlavha } from "./qismlar";

/** Ombor jadvalidagi namuna qatorlar. `past` — minimal qoldiqdan tushgani. */
const OMBOR = [
  { nomi: "Atirgul, 50 sm", tannarx: "12 000", sotuv: "20 000", marja: "40%", past: false },
  { nomi: "Chinnigul", tannarx: "6 500", sotuv: "12 000", marja: "46%", past: false },
  { nomi: "O'ram qog'oz · 8 dona", tannarx: "3 000", sotuv: "6 000", marja: "50%", past: true },
];

const KASSALAR = [
  { nomi: "Naqd", qiymat: "4 250 000" },
  { nomi: "Plastik", qiymat: "1 800 000" },
  { nomi: "Bank", qiymat: "9 300 000" },
];

/** Jadval ustunlari — sarlavha va qatorlarda AYNI nisbat. */
const USTUNLAR = "grid grid-cols-[1.4fr_1fr_1fr_0.8fr]";

/**
 * "Biznesingiz uchun kerak bo'lgani" — bento to'r. Katta kataklar (ombor,
 * qarzdorlik, kassalar) namuna ma'lumot bilan, kichiklari bir jumla bilan.
 * Telefonda to'r bitta ustunga yig'iladi (`Bolim` ichidagi max-[900px]).
 */
export function Imkoniyatlar() {
  return (
    <Bolim id="imkoniyatlar" fon="surface">
      <BolimSarlavha>Biznesingiz uchun kerak bo&apos;lgani</BolimSarlavha>

      <div className="mt-12 grid auto-rows-[minmax(180px,auto)] grid-cols-4 gap-5 max-[900px]:grid-cols-1">
        <Katak className="col-span-2 row-span-2 flex flex-col max-[900px]:col-span-1 max-[900px]:row-span-1">
          <h3 className="m-0 font-heading text-[24px] font-semibold text-fg">Ombor va sotuv</h3>
          <p className="m-0 mt-2.5 max-w-[40ch] text-[16px] leading-[1.6] text-muted">
            Tannarx, sotuv narxi va marja har mahsulot bo&apos;yicha. Minimal qoldiqdan pastga
            tushsa — ogohlantiradi.
          </p>
          <div className="mt-6 flex flex-1 items-end">
            <OmborJadvali />
          </div>
        </Katak>

        <Katak className="col-span-2 max-[900px]:col-span-1">
          <h3 className="m-0 font-heading text-[22px] font-semibold text-fg">Qarzdorlik</h3>
          <div className="mt-[18px] grid grid-cols-2 gap-3">
            <QarzKatak nomi="Bizga qarzdor" qiymat="8 400 000" ton="income" />
            <QarzKatak nomi="Biz qarzdormiz" qiymat="2 150 000" ton="expense" />
          </div>
          <p className="m-0 mt-3.5 text-[14px] text-muted">
            Mijoz limiti oshsa yangi qarzga sotib bo&apos;lmaydi.
          </p>
        </Katak>

        <Katak className="col-span-2 max-[900px]:col-span-1">
          <h3 className="m-0 font-heading text-[22px] font-semibold text-fg">Kassalar</h3>
          <div className="mt-[18px] flex flex-wrap gap-2.5">
            {KASSALAR.map((k) => (
              <span
                key={k.nomi}
                className="rounded-full border border-line bg-surface px-4 py-[9px] text-[14px] text-fg"
              >
                {k.nomi} <b className="font-display tabular-nums">{k.qiymat}</b>
              </span>
            ))}
          </div>
          <p className="m-0 mt-3.5 text-[14px] text-muted">
            Kassalar orasida o&apos;tkazma — ikki tomonda ham yozuv qoladi.
          </p>
        </Katak>

        <Katak kichik>
          <h3 className="m-0 font-heading text-[19px] font-semibold text-fg">Hisobotlar</h3>
          <div className="mt-4 flex gap-2">
            {["PDF", "Excel"].map((f) => (
              <span
                key={f}
                className="rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-[12px] font-semibold text-muted"
              >
                {f}
              </span>
            ))}
          </div>
        </Katak>

        <Katak kichik>
          <h3 className="m-0 font-heading text-[19px] font-semibold text-fg">Budjet</h3>
          <div className="mt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full w-[68%] bg-brand" />
            </div>
            <p className="m-0 mt-2 text-[12px] text-faint">Oylik chiqim rejasi 68%</p>
          </div>
        </Katak>

        <Katak kichik>
          <h3 className="m-0 font-heading text-[19px] font-semibold text-fg">Ko&apos;p biznes</h3>
          <p className="m-0 mt-4 text-[14px] text-muted">
            1–3 nuqta bitta hisobda, raqamlar aralashmaydi.
          </p>
        </Katak>

        <Katak kichik>
          <h3 className="m-0 font-heading text-[19px] font-semibold text-fg">Audit jurnali</h3>
          <p className="m-0 mt-4 text-[14px] text-muted">Kim o&apos;zgartirdi, qachon — yozuv qoladi.</p>
        </Katak>
      </div>

      <BolimIzoh savol="«Kunlik hisobotdan boshqa nima bor?»" />
    </Bolim>
  );
}

/** Bento kataki. `kichik` — bir ustunli katak (ichki bo'shliq 24px, 28px emas). */
function Katak({
  kichik = false,
  className = "",
  children,
}: {
  kichik?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-reveal
      className={`rounded-[24px] border border-line bg-surface-2 ${
        kichik ? "flex flex-col justify-between p-6" : "p-7"
      } ${className}`}
    >
      {children}
    </div>
  );
}

function QarzKatak({
  nomi,
  qiymat,
  ton,
}: {
  nomi: string;
  qiymat: string;
  ton: "income" | "expense";
}) {
  return (
    <div className="rounded-[12px] border border-line bg-surface p-4">
      <p className="m-0 text-[13px] text-faint">{nomi}</p>
      <p
        className={`m-0 mt-2 font-display text-[22px] font-bold tabular-nums ${
          ton === "income" ? "text-income" : "text-expense"
        }`}
      >
        {qiymat}
      </p>
    </div>
  );
}

/** Ombor jadvali maketi — oxirgi qator minimal qoldiqdan tushgani uchun sariq. */
function OmborJadvali() {
  return (
    <div
      role="img"
      aria-label="Ombor jadvali: mahsulot, tannarx, sotuv narxi va marja; oxirgi mahsulot qoldig'i minimaldan past"
      className="w-full overflow-hidden rounded-[16px] border border-line bg-surface"
    >
      <div
        className={`${USTUNLAR} bg-surface-2 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-faint`}
      >
        <span>Mahsulot</span>
        <span className="text-right">Tannarx</span>
        <span className="text-right">Sotuv</span>
        <span className="text-right">Marja</span>
      </div>

      {OMBOR.map((q) => (
        <div
          key={q.nomi}
          className={`${USTUNLAR} border-t border-line px-4 py-[13px] font-display text-[14px] tabular-nums text-fg ${
            q.past ? "bg-debt-soft" : ""
          }`}
        >
          <span className={`font-sans ${q.past ? "font-semibold text-debt" : ""}`}>{q.nomi}</span>
          <span className="text-right">{q.tannarx}</span>
          <span className="text-right">{q.sotuv}</span>
          <span className={`text-right font-bold ${q.past ? "text-debt" : "text-income"}`}>
            {q.marja}
          </span>
        </div>
      ))}

      <p className="m-0 border-t border-line bg-debt-soft px-4 py-2.5 text-[12px] text-debt">
        Minimal qoldiq 10 dona — buyurtma bering
      </p>
    </div>
  );
}
