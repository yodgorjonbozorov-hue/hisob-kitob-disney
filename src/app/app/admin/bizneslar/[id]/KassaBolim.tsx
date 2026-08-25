"use client";

import Link from "next/link";
import type { BiznesTafsilot } from "@/lib/services/biznesTafsilot";
import { Almashtirgich, SozlamaQator } from "./SozlamaQator";
import { useBiznesSaqlash } from "./foydalanish";

const KASSA_TURI: Record<string, string> = {
  naqd: "Naqd",
  plastik: "Plastik",
  bank: "Bank",
};

/**
 * KASSA — shu biznesning kassalari va shaxsiy kassa rejimi.
 *
 * Rejim yoqilganda naqd yozuv uni KIRITGAN xodimning kassasiga tushadi va
 * har faol xodimga kassa ochiladi (server tomonda, api/businesses/[id]).
 * O'chirilganda mavjud kassalar va tarix TEGILMAYDI.
 */
export function KassaBolim({ biznes }: { biznes: BiznesTafsilot }) {
  const { saqla, band } = useBiznesSaqlash(biznes.id);

  return (
    <div className="space-y-5">
      <SozlamaQator
        nomi="Shaxsiy kassa rejimi"
        tavsif="Yoqilganda naqd pul yozuvni kiritgan xodimning o'z kassasiga tushadi. Har faol xodimga kassa ochiladi."
        ogohlantirish={
          biznes.shaxsiyKassa
            ? undefined
            : "O'chiq: barcha naqd pul umumiy kassaga tushadi."
        }
        ong={
          <Almashtirgich
            yoqilgan={biznes.shaxsiyKassa}
            disabled={band}
            label="Shaxsiy kassa rejimi"
            onClick={() =>
              void saqla(
                { shaxsiyKassa: !biznes.shaxsiyKassa },
                biznes.shaxsiyKassa ? "Rejim o'chirildi" : "Rejim yoqildi"
              )
            }
          />
        }
      />

      <section>
        <h3 className="text-sm font-semibold text-fg">
          Kassalar <span className="text-faint font-normal">({biznes.kassalar.length})</span>
        </h3>
        <ul className="list-none divide-y divide-line mt-1">
          {biznes.kassalar.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm text-fg truncate">{k.nomi}</p>
                {k.egasi && <p className="text-xs text-muted mt-0.5">Shaxsiy · {k.egasi}</p>}
              </div>
              <span className="shrink-0 text-2xs px-2 py-0.5 rounded-full bg-surface-2 text-muted">
                {KASSA_TURI[k.turi] ?? k.turi}
              </span>
            </li>
          ))}
        </ul>
        <Link
          href="/app/kassa"
          className="inline-flex items-center min-h-[44px] text-sm text-brand hover:underline"
        >
          Kassalar bo&apos;limi →
        </Link>
      </section>
    </div>
  );
}
