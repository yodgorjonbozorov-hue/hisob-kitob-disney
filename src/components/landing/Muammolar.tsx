import { Bolim, BolimIzoh, BolimSarlavha } from "./qismlar";

/**
 * "Tanish holat" — mahsulot yechadigan to'rtta kundalik muammo.
 * Ikonkalar chiziqli (stroke) SVG: emoji ishlatilmaydi, chunki u qurilmadan
 * qurilmaga turlicha chiziladi. Pul summalari yonidagi 💵/💳/📋 esa
 * ilovadagi kassa belgilarining AYNI o'zi — u yerda ataylab qoldirilgan.
 */
const MUAMMOLAR: { ikon: React.ReactNode; matn: string }[] = [
  {
    // Kassa apparati
    ikon: (
      <>
        <rect x="2" y="7" width="20" height="11" rx="2" />
        <circle cx="12" cy="12.5" r="2.5" />
      </>
    ),
    matn: "Kassada kamomad chiqdi — kim, qaysi kuni bilinmaydi",
  },
  {
    // Daftar
    ikon: (
      <>
        <path d="M5 3h11l3 3v15H5z" />
        <path d="M8 9h8M8 13h8M8 17h5" />
      </>
    ),
    matn: "Qarzlar daftarda. Kim qancha qarzdor — aniq javob yo'q",
  },
  {
    // Quti (ombor)
    ikon: (
      <>
        <path d="M3 8l9-5 9 5v8l-9 5-9-5z" />
        <path d="M3 8l9 5 9-5M12 13v8" />
      </>
    ),
    matn: "Ombor qoldig'i faqat sanaganda ma'lum bo'ladi",
  },
  {
    // Soat
    ikon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l4 2" />
      </>
    ),
    matn: "Oylik hisobot yig'ishga bir hafta ketadi",
  },
];

export function Muammolar() {
  return (
    <Bolim>
      <BolimSarlavha>Tanish holat</BolimSarlavha>

      <div className="mt-12 grid grid-cols-4 gap-5 max-[900px]:grid-cols-2">
        {MUAMMOLAR.map((m) => (
          <div
            key={m.matn}
            data-reveal
            className="rounded-[16px] border border-line bg-surface p-6 shadow-lift"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
              className="text-faint"
            >
              {m.ikon}
            </svg>
            <p className="m-0 mt-4 text-[16px] leading-[1.55] text-fg">{m.matn}</p>
          </div>
        ))}
      </div>

      <BolimIzoh savol="«Bu mening muammomni tushunadimi?»" />
    </Bolim>
  );
}
