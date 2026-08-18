import { Bolim, BolimIzoh, BolimSarlavha } from "./qismlar";

/** Botning uchta kundalik ishi — o'ngdagi ro'yxat. */
const IMKONLAR: React.ReactNode[] = [
  <>
    <BotBuyruq>/kirim</BotBuyruq> va <BotBuyruq>/chiqim</BotBuyruq> — botdan yozing
  </>,
  <>Chek rasmini yuboring — AI summani o&apos;zi o&apos;qiydi</>,
  <>Har kuni ertalab kunlik xulosa</>,
];

/**
 * "Ofisda bo'lishingiz shart emas" — Telegram bot orqali ishlash.
 * Chapda telefon maketi: kassa topshirilgani haqidagi bot xabari,
 * ichida farq ogohlantirishi va tasdiqlash tugmasi.
 */
export function Telegram() {
  return (
    <Bolim>
      <BolimSarlavha>Ofisda bo&apos;lishingiz shart emas</BolimSarlavha>

      <div className="mt-12 grid grid-cols-[420px_1fr] items-center gap-16 max-[900px]:grid-cols-1 max-[900px]:gap-6">
        <div data-reveal className="justify-self-start">
          <TelefonMaket />
        </div>

        <div data-reveal className="flex flex-col">
          {IMKONLAR.map((matn, i) => (
            <div
              key={i}
              className={`border-t border-line-strong py-[22px] ${
                i === IMKONLAR.length - 1 ? "border-b" : ""
              }`}
            >
              <p className="m-0 text-[19px] leading-[1.5] text-fg">{matn}</p>
            </div>
          ))}
        </div>
      </div>

      <BolimIzoh savol="«Har kuni kompyuter oldida o'tirishim kerakmi?»" />
    </Bolim>
  );
}

/** Bot buyrug'i — Manrope 700, brend rangida. */
function BotBuyruq({ children }: { children: React.ReactNode }) {
  return <span className="font-display font-bold text-brand">{children}</span>;
}

/**
 * Telefon maketi. Ichidagi ranglar Telegram suhbat oynasiniki — mavzudan
 * qat'i nazar o'zgarmaydi. Faqat korpus rangi (`border-fg`) mavzuga ergashadi.
 */
function TelefonMaket() {
  return (
    <div
      role="img"
      aria-label="Telegramdagi bot xabari: kassa topshirildi, naqd farqi 340 000 so'm, tasdiqlash tugmasi"
      className="w-[340px] max-w-full overflow-hidden rounded-[36px] border-[10px] border-fg bg-[#0D211F] shadow-lift"
    >
      <div className="flex h-[26px] items-center justify-center bg-[#0A1B1A]">
        <span aria-hidden="true" className="h-[5px] w-14 rounded-full bg-[#223E3B]" />
      </div>

      <div className="bg-[#0E1B21] p-3.5">
        <div className="rounded-[14px] border border-[#22404A] bg-[#182B33] p-3.5">
          <p className="m-0 text-[13px] font-semibold text-[#E8F3F1]">
            📤 Kassa topshirildi — tasdiqlash kerak
          </p>
          <p className="m-0 mt-1.5 text-[11px] text-[#8FA6AE]">
            Disney Flowers — 13.08.2026
            <br />
            Topshirdi: Nodira
          </p>

          <div className="mt-3 flex flex-col gap-[5px] border-t border-[#22404A] pt-2.5 text-[12px] text-[#CFE0DE]">
            <BotQator nomi="💵 Naqd (tizim)" qiymat="4 250 000" />
            <BotQator nomi="💵 Naqd (sanaldi)" qiymat="3 910 000" />
          </div>

          <p className="m-0 mt-2.5 rounded-lg bg-[#3B1517] px-2.5 py-2 text-[12px] font-semibold text-[#F87171]">
            ⚠️ KAM: 340 000 so&apos;m yetishmayapti!
          </p>

          <div className="mt-2.5 flex flex-col gap-[5px] text-[12px] text-[#CFE0DE]">
            <BotQator nomi="💳 Click" qiymat="1 800 000" />
            <BotQator nomi="📋 Qarz" qiymat="600 000" />
            <div className="border-t border-[#22404A] pt-1.5">
              <BotQator nomi="💰 Jami" qiymat="6 650 000" yorqin />
            </div>
          </div>

          <div className="mt-3 rounded-[10px] bg-[#2AABEE] p-[11px] text-center text-[13px] font-semibold text-white">
            ✅ Kun yakunini tasdiqlash
          </div>
        </div>
      </div>
    </div>
  );
}

function BotQator({ nomi, qiymat, yorqin }: { nomi: string; qiymat: string; yorqin?: boolean }) {
  return (
    <div className="flex justify-between">
      <span>{nomi}</span>
      <span className={`font-display font-bold tabular-nums ${yorqin ? "text-[#E8F3F1]" : ""}`}>
        {qiymat}
      </span>
    </div>
  );
}
