"use client";

import Link from "next/link";
import { omborMatn } from "@/lib/biznesTuri";
import { son } from "../turlar";
import type { BiznesTafsilot } from "@/lib/services/biznesTafsilot";
import { Almashtirgich, SozlamaQator } from "./SozlamaQator";
import { useBiznesSaqlash } from "./foydalanish";

/**
 * OMBOR — shu bizneste tovar qoldig'i yuritiladimi.
 *
 * O'chirilganda mahsulot va sotuv ma'lumotlari O'CHMAYDI, faqat bo'limlar
 * yopiladi. Kassa (POS) ombor ustida ishlagani uchun u ham birga yopiladi —
 * buni server majburlaydi (api/businesses/[id]).
 */
export function OmborBolim({ biznes }: { biznes: BiznesTafsilot }) {
  const { saqla, band } = useBiznesSaqlash(biznes.id);
  const matn = omborMatn(biznes.turi);

  return (
    <div className="space-y-5">
      <SozlamaQator
        nomi={`${matn.modul} yuritiladi`}
        tavsif={`Shu bizneste ${matn.birlik} qoldig'i va sotuv yuritiladi.`}
        ogohlantirish={
          biznes.omborli && biznes.magazin
            ? "Omborni o'chirsangiz kassa (POS) ham yopiladi — mahsulot va qoldiq ombordan keladi."
            : undefined
        }
        ong={
          <Almashtirgich
            yoqilgan={biznes.omborli}
            disabled={band}
            label={`${matn.modul} yuritiladi`}
            onClick={() =>
              void saqla(
                { omborli: !biznes.omborli },
                biznes.omborli ? "Ombor yopildi" : "Ombor yoqildi"
              )
            }
          />
        }
      />

      <SozlamaQator
        nomi={matn.turlarSoni}
        tavsif="Ombor o'chirilsa ham bu yozuvlar joyida qoladi."
        ong={<span className="text-sm text-muted tnum">{son(biznes.mahsulotlar)}</span>}
      />

      {biznes.omborli && (
        <Link
          href="/app/ombor"
          className="inline-flex items-center min-h-[44px] text-sm text-brand hover:underline"
        >
          {matn.modul} bo&apos;limi →
        </Link>
      )}
    </div>
  );
}
