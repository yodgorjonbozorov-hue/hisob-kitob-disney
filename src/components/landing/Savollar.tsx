import { Bolim, BolimIzoh, BolimSarlavha } from "./qismlar";

const SAVOLLAR: { savol: string; javob: string }[] = [
  {
    savol: "Ma'lumotlarim qayerda saqlanadi?",
    javob:
      "Serverda, har kuni zaxira nusxa olinadi. Ma'lumot faqat sizniki. Obuna tugasa ham o'chirilmaydi — o'qish uchun ochiq qoladi.",
  },
  {
    savol: "Xodimlarim ishlata oladimi?",
    javob: "Ha, telefondan. Kassir uchun alohida sodda ekran — faqat kerakli tugmalar.",
  },
  {
    savol: "Buxgalteriya bilimi kerakmi?",
    javob: "Yo'q. Kirim, chiqim, qarz — kundalik tilda yozilgan.",
  },
  {
    savol: "Bir nechta do'konim bor?",
    javob: "Har biri alohida yuritiladi, raqamlar aralashmaydi — hammasi bitta hisobda.",
  },
  {
    savol: "Internet uzilsa?",
    javob:
      "Sahifa oflayn holatni ko'rsatadi. Ulanish tiklanganda to'xtagan joyingizdan davom etasiz.",
  },
  {
    savol: "Sinovdan keyin nima bo'ladi?",
    javob: "Avtomatik to'lov olinmaydi. Tarif tanlaysiz yoki ma'lumotingiz saqlanib turadi.",
  },
];

/**
 * Savol-javob. Ochish/yopish uchun `<details>` — JS talab qilmaydi, shu bois
 * skript yuklanmagan holatda ham (va qidiruv botlari uchun) ishlaydi.
 */
export function Savollar() {
  return (
    <Bolim id="savollar" eni={840}>
      <BolimSarlavha>Savollar</BolimSarlavha>

      <div
        data-reveal
        className="mt-10 overflow-hidden rounded-[24px] border border-line bg-surface shadow-lift"
      >
        {SAVOLLAR.map((s, i) => (
          <details key={s.savol} className={i > 0 ? "border-t border-line" : ""}>
            <summary className="flex items-center justify-between gap-4 px-7 py-6 text-[18px] font-medium text-fg">
              {s.savol}
              <span
                data-chev
                aria-hidden="true"
                className="flex-none text-[18px] text-faint transition-transform duration-200"
              >
                +
              </span>
            </summary>
            <p className="m-0 max-w-[65ch] px-7 pb-6 text-[16px] leading-[1.7] text-muted">
              {s.javob}
            </p>
          </details>
        ))}
      </div>

      <BolimIzoh savol="«Qolgan shubhalarim nima bo'ladi?»" />
    </Bolim>
  );
}
