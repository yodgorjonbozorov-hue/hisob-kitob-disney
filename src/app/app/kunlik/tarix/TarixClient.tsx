"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import type { KunlikTarixDTO } from "@/lib/queries/kunlik";
import { HOLAT_KORINISHI, farqKorinishi } from "../holat";
import { sanaUz } from "../vaqt";

/**
 * KUNLIK TARIX — ixcham ro'yxat.
 *
 * Har qator bitta kunning to'liq hikoyasini beradi: kirim, chiqim, sof
 * natija, topshirilgan pul va farq. Ilgari faqat sof natija va to'lov turlari
 * ko'rinardi — "o'sha kuni pul topshirildimi, kam chiqdimi" degan asosiy
 * savolga javob yo'q edi.
 */
function Qiymat({ nomi, qiymat }: { nomi: string; qiymat: number | null }) {
  return (
    <div className="min-w-0">
      <span className="text-faint">{nomi}</span>
      <div className="text-fg tnum truncate">
        {qiymat === null ? "—" : qiymat.toLocaleString("uz-UZ")}
      </div>
    </div>
  );
}

export function TarixClient({ tarix }: { tarix: KunlikTarixDTO[] }) {
  if (tarix.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="📋"
          title="Hali kunlik hisobot yo'q"
          description="Birinchi tushum kiritilgach shu yerda kunlar ro'yxati paydo bo'ladi."
        />
      </Card>
    );
  }

  return (
    <Card className="p-0 sm:p-0">
      <ul className="divide-y divide-line">
        {tarix.map((r) => {
          const kor = HOLAT_KORINISHI[r.holat];
          const farq = farqKorinishi(r.naqdFarq);
          const kim =
            r.holat === "CONFIRMED" ? r.confirmedByIsm : r.holat === "SUBMITTED" ? r.submittedByIsm : null;

          return (
            <li key={r.id}>
              <Link
                href={`/app/kunlik?sana=${r.sana}`}
                className="block p-4 hover:bg-surface-2 transition"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-fg">{sanaUz(r.sana)}</p>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium ${kor.klass}`}
                  >
                    {kor.belgi} {kor.nomi}
                    {kim ? ` · ${kim}` : ""}
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-x-3 gap-y-1 mt-2 text-2xs">
                  <Qiymat nomi="Kirim" qiymat={r.jamiSumma} />
                  <Qiymat nomi="Chiqim" qiymat={r.chiqimSumma} />
                  <Qiymat nomi="Sof" qiymat={r.sofSumma} />
                  <Qiymat nomi="Tizim kassa" qiymat={r.kutilganNaqd} />
                  <Qiymat nomi="Topshirildi" qiymat={r.sanalganNaqd} />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                  <span className="text-2xs text-faint tnum">
                    💵 {r.naqdSumma.toLocaleString("uz-UZ")} · 💳{" "}
                    {r.clickSumma.toLocaleString("uz-UZ")} · 📋{" "}
                    {r.qarzSumma.toLocaleString("uz-UZ")}
                  </span>
                  <span className="flex items-center gap-2">
                    {farq && <span className={`text-2xs ${farq.klass}`}>{farq.matn}</span>}
                    <Money value={r.sofSumma} size="md" tone="neutral" signed={r.sofSumma < 0} />
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
