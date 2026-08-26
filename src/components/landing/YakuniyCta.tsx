import Link from "next/link";
import { Shovqin } from "./qismlar";

/** Sahifa oxiridagi yakuniy chaqiriq — hero bilan bir xil qorong'i gradient. */
export function YakuniyCta() {
  return (
    <section
      className="relative overflow-hidden px-10 py-[140px] max-[900px]:px-5 max-[900px]:py-20"
      style={{ background: "linear-gradient(184deg,#061413 0%,#0B2523 60%,#134E4A 100%)" }}
    >
      <Shovqin />

      <div className="relative mx-auto max-w-[800px] text-center">
        <h2
          data-reveal
          className="m-0 font-heading text-[60px] font-bold leading-[1.05] tracking-[-0.03em] text-[#F8FBFA] max-[900px]:text-[36px]"
        >
          Bugungi kunni bugun yoping
        </h2>
        <p data-reveal className="m-0 mt-5 text-[18px] leading-[1.6] text-[#E2F0EE]/70">
          14 kun bepul. Karta talab qilinmaydi.
        </p>
        <Link
          data-reveal
          href="/signup"
          className="mt-9 inline-block rounded-[14px] bg-[#5EEAD4] px-10 py-[19px] text-[18px] font-semibold text-[#061413] hover:bg-[#99F6E4]"
        >
          14 kun bepul boshlash
        </Link>
      </div>
    </section>
  );
}
