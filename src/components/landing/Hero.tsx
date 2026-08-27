import Link from "next/link";
import { Pul, QorongIzoh, Shovqin } from "./qismlar";

/** Kun yakuni maketidagi summalar — bitta manba, ikkala (desktop/mobil) maket ham shundan. */
const YAKUN = { naqd: 4_250_000, click: 1_800_000, qarz: 600_000, jami: 6_650_000, farq: -340_000 };
const SANA_MATNI = "Disney Flowers · 13.08.2026";

/**
 * Hero — qorong'i gradient ustida asosiy va'da, ikkita amal tugmasi va
 * mahsulot maketi. Panel (68px) hero ustidan suzadi, shu bois `-mt-[68px]`.
 */
export function Hero() {
  return (
    <section
      className="relative -mt-[68px] overflow-hidden pt-[148px]"
      style={{ background: "linear-gradient(168deg,#061413 0%,#0B2523 55%,#134E4A 100%)" }}
    >
      <Shovqin />

      <div className="relative mx-auto max-w-[1200px] px-10 max-[900px]:px-5">
        <div className="max-w-[820px]">
          <div
            data-reveal
            className="inline-flex items-center gap-2 rounded-full border border-[#5EEAD4]/[0.28] bg-[#5EEAD4]/[0.08] px-3.5 py-[7px] text-[13px] font-medium text-[#A7F3E5]"
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#5EEAD4]" />
            14 kun bepul · Karta talab qilinmaydi
          </div>

          <h1
            data-reveal
            className="m-0 mt-6 font-heading text-[70px] font-bold leading-[1.05] tracking-[-0.03em] text-[#F8FBFA] [text-wrap:pretty] max-[900px]:text-[36px]"
          >
            Kassangizdan pul yo&apos;qolsa — <span className="text-[#5EEAD4]">o&apos;sha kuni</span>{" "}
            bilasiz
          </h1>

          <p data-reveal className="m-0 mt-6 max-w-[56ch] text-[18px] leading-[1.6] text-[#E2F0EE]/[0.72]">
            Kirim-chiqim, kunlik hisobot, ombor va qarzdorlik — bitta tizimda. Xodim kassani sanab
            topshiradi, siz Telegramdan tasdiqlaysiz.
          </p>

          <div data-reveal className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-[12px] bg-[#5EEAD4] px-[26px] py-[15px] text-[16px] font-semibold text-[#061413] hover:bg-[#99F6E4]"
            >
              14 kun bepul boshlash
            </Link>
            <a
              href="#kunlik"
              className="inline-flex items-center gap-2 rounded-[12px] border border-[#F8FBFA]/[0.24] px-6 py-[15px] text-[16px] font-semibold text-[#F8FBFA] hover:border-[#F8FBFA]/[0.44]"
            >
              Qanday ishlaydi <span aria-hidden="true">↓</span>
            </a>
          </div>

          <div
            data-reveal
            className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-[#E2F0EE]/[0.52]"
          >
            <span>Telegram bot bilan ishlaydi</span>
            <span aria-hidden="true">·</span>
            <span>O&apos;zbek tilida</span>
            <span aria-hidden="true">·</span>
            <span>Payme va Click</span>
          </div>
        </div>
      </div>

      <HeroMaket />
      <HeroMaketMobil />

      <div className="mx-auto max-w-[1200px] px-10 pb-10 pt-14 max-[900px]:px-5">
        <QorongIzoh savol="«Bu nima va menga nima foyda?»" />
      </div>
    </section>
  );
}

/** Kompyuterda — brauzer oynasi ichidagi kunlik hisobot ekrani, pasti yo'qoladi. */
function HeroMaket() {
  return (
    <div
      data-reveal
      className="relative mx-auto -mt-2 max-w-[1120px] px-10 pt-16 max-[900px]:hidden"
    >
      <div
        className="rounded-[20px] shadow-[0_0_120px_rgba(94,234,212,0.15)]"
        style={{ maskImage: PASTGA_SOLINGAN(72), WebkitMaskImage: PASTGA_SOLINGAN(72) }}
      >
        <div
          role="img"
          aria-label="Balansa kunlik hisobot ekrani: kassa summalari va tizim bilan solishtirish"
          className="overflow-hidden rounded-t-[20px] border border-[#223E3B] bg-[#0D211F]"
        >
          <div className="flex h-10 items-center gap-2 border-b border-[#223E3B] bg-[#0A1B1A] px-4">
            <span
              aria-hidden="true"
              className="h-[9px] w-[9px] rounded-full bg-[#223E3B] shadow-[16px_0_0_#223E3B,32px_0_0_#223E3B]"
            />
            <span className="ml-11 text-[12px] text-[#7E9A96]">balansa.uz/kunlik-hisobot</span>
          </div>

          <div className="px-8 pb-11 pt-7">
            <div className="flex items-end justify-between">
              <div>
                <p className="m-0 text-[13px] text-[#7E9A96]">{SANA_MATNI}</p>
                <h2 className="m-0 mt-1.5 font-heading text-[22px] font-semibold text-[#F8FBFA]">
                  Kun yakuni
                </h2>
              </div>
              <span className="rounded-full border border-[#4ADE80]/[0.24] bg-[#0F2E1F] px-3 py-1.5 text-[12px] font-semibold text-[#4ADE80]">
                Tasdiqlangan
              </span>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <MaketKatak belgi="💵" nomi="Naqd" qiymat={YAKUN.naqd} />
              <MaketKatak belgi="💳" nomi="Click" qiymat={YAKUN.click} />
              <MaketKatak belgi="📋" nomi="Qarz" qiymat={YAKUN.qarz} />
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-[#223E3B] pt-4">
              <span className="text-[14px] text-[#9FBAB6]">Jami</span>
              <span className="font-display text-[26px] font-bold tabular-nums text-[#F8FBFA]">
                <Pul qiymat={YAKUN.jami} />{" "}
                <span className="text-[14px] font-semibold text-[#7E9A96]">so&apos;m</span>
              </span>
            </div>

            <div className="mt-5 flex items-center justify-between rounded-[12px] border border-[#F87171]/[0.28] bg-[#3B1517] px-[18px] py-3.5">
              <span className="text-[14px] text-[#FCA5A5]">
                ⚠️ Naqd farqi — xodim sanadi 3 910 000
              </span>
              <Pul qiymat={YAKUN.farq} className="text-[20px] text-[#F87171]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Telefonda — qisqartirilgan statik variant (kenglikka sig'adigan qatorlar). */
function HeroMaketMobil() {
  const qatorlar = [
    { belgi: "💵", nomi: "Naqd", qiymat: YAKUN.naqd },
    { belgi: "💳", nomi: "Click", qiymat: YAKUN.click },
    { belgi: "📋", nomi: "Qarz", qiymat: YAKUN.qarz },
  ];
  return (
    <div data-reveal className="hidden px-5 pt-12 max-[900px]:block">
      <div
        role="img"
        aria-label="Kunlik hisobot ekrani (telefon ko'rinishi)"
        className="rounded-[16px] border border-[#223E3B] bg-[#0D211F] p-5"
        style={{ maskImage: PASTGA_SOLINGAN(78), WebkitMaskImage: PASTGA_SOLINGAN(78) }}
      >
        <p className="m-0 text-[12px] text-[#7E9A96]">{SANA_MATNI}</p>
        <h2 className="m-0 mb-4 mt-1.5 font-heading text-[19px] font-semibold text-[#F8FBFA]">
          Kun yakuni
        </h2>
        <div className="flex flex-col gap-2">
          {qatorlar.map((q) => (
            <div
              key={q.nomi}
              className="flex justify-between rounded-[12px] border border-[#223E3B] bg-[#0A1B1A] px-3.5 py-3"
            >
              <span className="text-[13px] text-[#9FBAB6]">
                {q.belgi} {q.nomi}
              </span>
              <Pul qiymat={q.qiymat} className="text-[#F8FBFA]" />
            </div>
          ))}
          <div className="flex justify-between rounded-[12px] border border-[#F87171]/[0.28] bg-[#3B1517] px-3.5 py-3">
            <span className="text-[13px] text-[#FCA5A5]">⚠️ Farq</span>
            <Pul qiymat={YAKUN.farq} className="text-[#F87171]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MaketKatak({ belgi, nomi, qiymat }: { belgi: string; nomi: string; qiymat: number }) {
  return (
    <div className="rounded-[12px] border border-[#223E3B] bg-[#0A1B1A] px-4 py-3.5">
      <p className="m-0 text-[12px] text-[#7E9A96]">
        {belgi} {nomi}
      </p>
      <Pul qiymat={qiymat} className="mt-2 block text-[20px] text-[#F8FBFA]" />
    </div>
  );
}

/** Maket pastini fonga singdiruvchi niqob — `foiz` dan keyin shaffoflashadi. */
function PASTGA_SOLINGAN(foiz: number) {
  return `linear-gradient(to bottom,#000 0%,#000 ${foiz}%,transparent 100%)`;
}
