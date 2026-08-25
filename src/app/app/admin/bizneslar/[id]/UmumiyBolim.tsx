"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { BIZNES_TURLARI } from "@/lib/biznesTuri";
import { formatToshkentVaqt } from "@/lib/format";
import type { BiznesTafsilot } from "@/lib/services/biznesTafsilot";
import { SozlamaQator } from "./SozlamaQator";
import { useBiznesSaqlash } from "./foydalanish";

/**
 * UMUMIY — biznesning o'zi haqidagi sozlamalar: nomi, holati va ishlash rejimi.
 *
 * "Ishlash rejimi" (`Business.turi`) — REAL biznes mantiqi: "avto" rejimida
 * ombor avtoparkka aylanadi va sotuvda har mashina bo'yicha sof foyda
 * hisoblanadi (lib/biznesTuri.ts). Shuning uchun u o'chirilmadi, faqat
 * ro'yxatdan shu yerga ko'chirildi va nomi tushunarli qilindi.
 */
export function UmumiyBolim({
  biznes,
  onHolat,
}: {
  biznes: BiznesTafsilot;
  onHolat: () => void;
}) {
  const { saqla, band } = useBiznesSaqlash(biznes.id);
  const [nomi, setNomi] = useState(biznes.nomi);
  const ozgardi = nomi.trim() !== biznes.nomi && nomi.trim().length > 0;

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-fg mb-1.5" htmlFor="biz-nomi">
          Biznes nomi
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="biz-nomi"
            value={nomi}
            onChange={(e) => setNomi(e.target.value)}
            className="flex-1 h-11 px-3 rounded-xl bg-surface border border-line text-sm text-fg focus:outline-none focus:border-brand"
          />
          <Button
            onClick={() => void saqla({ nomi: nomi.trim() }, "Nomi saqlandi")}
            disabled={!ozgardi}
            loading={band}
            className="min-h-[44px]"
          >
            Saqlash
          </Button>
        </div>
      </div>

      <div>
        <SozlamaQator
          nomi="Holati"
          tavsif={
            biznes.isActive
              ? "Biznes faol — menyudagi biznes tanlash ro'yxatida ko'rinadi."
              : "Biznes nofaol. Ma'lumotlari joyida, faqat ro'yxatda ko'rinmaydi."
          }
          belgi={{ matn: biznes.isActive ? "Faol" : "Nofaol" }}
          ong={
            <Button variant="secondary" onClick={onHolat} className="min-h-[44px]">
              {biznes.isActive ? "Nofaollashtirish" : "Faollashtirish"}
            </Button>
          }
        />

        <SozlamaQator
          nomi="Ishlash rejimi"
          tavsif={
            BIZNES_TURLARI.find((t) => t.code === biznes.turi)?.tavsif ??
            "Ombor moduli qaysi ko'rinishda ishlashini belgilaydi."
          }
          ong={
            <select
              aria-label="Ishlash rejimi"
              value={biznes.turi}
              disabled={band}
              onChange={(e) => void saqla({ turi: e.target.value }, "Rejim o'zgartirildi")}
              className="h-11 rounded-xl bg-surface border border-line px-3 text-sm text-fg focus:outline-none focus:border-brand"
            >
              {BIZNES_TURLARI.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.nomi}
                </option>
              ))}
            </select>
          }
        />

        <SozlamaQator
          nomi="Yaratilgan"
          tavsif="Biznes tizimga qo'shilgan sana."
          ong={
            <span className="text-sm text-muted tnum">
              {formatToshkentVaqt(new Date(biznes.createdAt))}
            </span>
          }
        />
      </div>
    </div>
  );
}
