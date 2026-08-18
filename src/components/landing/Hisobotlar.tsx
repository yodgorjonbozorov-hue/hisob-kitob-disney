import { Bolim, BolimIzoh, BolimSarlavha } from "./qismlar";

/**
 * Oylik dinamika ustunlari. Qiymatlar — SVG koordinatalari (viewBox 640×240,
 * asos chizig'i y=200): `kirim`/`chiqim` — ustun balandligi, `foyda` — sof
 * foyda chizig'ining y nuqtasi.
 */
const OYLAR = [
  { oy: "Mar", kirim: 104, chiqim: 60, foyda: 158 },
  { oy: "Apr", kirim: 128, chiqim: 68, foyda: 148 },
  { oy: "May", kirim: 90, chiqim: 54, foyda: 168 },
  { oy: "Iyn", kirim: 144, chiqim: 74, foyda: 132 },
  { oy: "Iyl", kirim: 160, chiqim: 80, foyda: 122 },
  { oy: "Avg", kirim: 136, chiqim: 62, foyda: 146 },
];

/** Birinchi ustun markazi va oylar orasidagi qadam (SVG birligida). */
const X0 = 24;
const QADAM = 104;

/**
 * Chiqim kategoriyalari — donut. `ulush` foizda, `boshi` — segment burchagi
 * (aylana bo'ylab siljish). Ranglar `chart-1…5` — mavzudan qat'i nazar bir xil.
 */
const KATEGORIYALAR = [
  { nomi: "Tovar xaridi", foiz: 35, uzunlik: 101, boshi: -90, klass: "stroke-chart-1" },
  { nomi: "Ish haqi", foiz: 25, uzunlik: 72, boshi: 35, klass: "stroke-chart-2" },
  { nomi: "Ijara", foiz: 19, uzunlik: 55, boshi: 124, klass: "stroke-chart-3" },
  { nomi: "Transport", foiz: 12, uzunlik: 35, boshi: 192, klass: "stroke-chart-4" },
  { nomi: "Boshqa", foiz: 9, uzunlik: 26, boshi: 236, klass: "stroke-chart-5" },
];

/** Donut aylanasining uzunligi (2πr, r=46) — dasharray'ning ikkinchi qiymati. */
const AYLANA = 289;

/** Kategoriya rangi bilan legendadagi kvadratcha — donut segmenti bilan bir xil. */
const KVADRAT = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

/**
 * "Oy oxirida hisobot yig'ish shart emas" — oylik dinamika grafigi va chiqim
 * kategoriyalari. Raqamlar namuna: mahsulot nimani ko'rsatishini tushuntiradi.
 */
export function Hisobotlar() {
  return (
    <Bolim fon="surface">
      <BolimSarlavha>Oy oxirida hisobot yig&apos;ish shart emas</BolimSarlavha>

      <div className="mt-12 grid grid-cols-[1.6fr_1fr] gap-6 max-[900px]:grid-cols-1">
        <Dinamika />
        <Kategoriyalar />
      </div>

      <BolimIzoh savol="«Oylik natijani qanday ko'raman?»" />
    </Bolim>
  );
}

function Dinamika() {
  return (
    <div data-reveal className="rounded-[24px] border border-line bg-surface-2 p-7">
      <div className="flex items-baseline justify-between">
        <p className="m-0 text-[14px] font-semibold text-fg">Oylik dinamika</p>
        <div className="flex gap-4 text-[12px] text-faint">
          <Belgi klass="h-2 w-2 rounded-sm bg-income">Kirim</Belgi>
          <Belgi klass="h-2 w-2 rounded-sm bg-expense">Chiqim</Belgi>
          <Belgi klass="h-0.5 w-3 bg-brand-300">Sof foyda</Belgi>
        </div>
      </div>

      <svg
        viewBox="0 0 640 240"
        role="img"
        aria-label="Oylik kirim, chiqim va sof foyda grafigi — mart oyidan avgustgacha"
        className="mt-5 h-auto w-full overflow-visible"
      >
        <g className="stroke-line-strong opacity-60" strokeWidth="1">
          <line x1="0" y1="200" x2="640" y2="200" />
          <line x1="0" y1="140" x2="640" y2="140" strokeDasharray="3 5" />
          <line x1="0" y1="80" x2="640" y2="80" strokeDasharray="3 5" />
          <line x1="0" y1="20" x2="640" y2="20" strokeDasharray="3 5" />
        </g>

        <g>
          {OYLAR.map((o, i) => (
            <g key={o.oy}>
              <rect
                x={X0 + i * QADAM}
                y={200 - o.kirim}
                width="18"
                height={o.kirim}
                rx="4"
                className="fill-income"
              />
              <rect
                x={X0 + 22 + i * QADAM}
                y={200 - o.chiqim}
                width="18"
                height={o.chiqim}
                rx="4"
                className="fill-expense"
              />
            </g>
          ))}
        </g>

        <path
          d={OYLAR.map((o, i) => `${i === 0 ? "M" : "L"}${X0 + 19 + i * QADAM} ${o.foyda}`).join(" ")}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="stroke-brand-300"
        />

        <g fontSize="11" textAnchor="middle" className="fill-faint font-sans">
          {OYLAR.map((o, i) => (
            <text key={o.oy} x={X0 + 19 + i * QADAM} y="220">
              {o.oy}
            </text>
          ))}
        </g>
      </svg>

      <div className="mt-6 flex gap-3">
        {["PDF yuklab olish", "Excel yuklab olish"].map((t) => (
          <span
            key={t}
            className="rounded-[12px] border border-line-strong bg-surface px-[18px] py-[11px] text-[14px] font-semibold text-fg"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function Kategoriyalar() {
  return (
    <div data-reveal className="rounded-[24px] border border-line bg-surface-2 p-7">
      <p className="m-0 text-[14px] font-semibold text-fg">Chiqim kategoriyalari</p>

      <svg
        viewBox="0 0 120 120"
        role="img"
        aria-label="Chiqim kategoriyalari: tovar xaridi 35%, ish haqi 25%, ijara 19%, transport 12%, boshqa 9%"
        className="mx-auto mt-6 block h-[170px] w-[170px]"
      >
        <circle cx="60" cy="60" r="46" fill="none" strokeWidth="16" className="stroke-line" />
        {KATEGORIYALAR.map((k) => (
          <circle
            key={k.nomi}
            cx="60"
            cy="60"
            r="46"
            fill="none"
            strokeWidth="16"
            strokeLinecap="butt"
            strokeDasharray={`${k.uzunlik} ${AYLANA}`}
            transform={`rotate(${k.boshi} 60 60)`}
            className={k.klass}
          />
        ))}
      </svg>

      <div className="mt-6 flex flex-col gap-2.5 text-[14px]">
        {KATEGORIYALAR.map((k, i) => (
          <div key={k.nomi} className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-muted">
              <span aria-hidden="true" className={`h-[9px] w-[9px] rounded-sm ${KVADRAT[i]}`} />
              {k.nomi}
            </span>
            <span className="font-display font-bold tabular-nums text-fg">{k.foiz}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Belgi({ klass, children }: { klass: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={klass} />
      {children}
    </span>
  );
}
