"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import type { KutilayotganKunDTO } from "@/lib/queries/kunlik";
import { farqKorinishi } from "./holat";
import { sanaUz, vaqtUzToshkent } from "./vaqt";

/**
 * DIREKTOR PANELI — tasdiq kutayotgan kunlar.
 *
 * Faqat tasdiqlash huquqi borga ko'rsatiladi. Har qator kunning sanasiga
 * olib boradi: qaror o'sha kunning yakun kartasida qabul qilinadi, chunki
 * u yerda to'liq kontekst (kirim, chiqim, operatsiyalar) turadi.
 */
export function KutilayotganKunlar({ kunlar }: { kunlar: KutilayotganKunDTO[] }) {
  if (kunlar.length === 0) return null;

  return (
    <Card className="border-debt/40">
      <h2 className="font-semibold text-fg">
        ⏳ Tasdiq kutayotgan kunlar ({kunlar.length})
      </h2>
      <p className="text-2xs text-faint mt-0.5 mb-2">
        Qabul qilinganda pul kassirdan markaziy kassaga ko&apos;chadi.
      </p>

      <ul className="divide-y divide-line">
        {kunlar.map((k) => {
          const farq = farqKorinishi(k.naqdFarq);
          return (
            <li key={k.sana} className="py-3">
              <Link
                href={`/app/kunlik?sana=${k.sana}`}
                className="block rounded-xl -m-1 p-1 hover:bg-surface-2 transition"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-fg">
                    {sanaUz(k.sana)}
                    <span className="text-muted font-normal">
                      {" "}
                      · {k.submittedByIsm ?? "—"}
                    </span>
                  </p>
                  {farq && <span className={`text-2xs ${farq.klass}`}>{farq.matn}</span>}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 mt-1.5 text-2xs">
                  <div>
                    <span className="text-faint">Kirim</span>
                    <div className="text-fg tnum">{k.jamiSumma.toLocaleString("uz-UZ")}</div>
                  </div>
                  <div>
                    <span className="text-faint">Chiqim</span>
                    <div className="text-fg tnum">{k.chiqimSumma.toLocaleString("uz-UZ")}</div>
                  </div>
                  <div>
                    <span className="text-faint">Tizim kassa</span>
                    <div className="text-fg tnum">
                      {k.kutilganNaqd === null ? "—" : k.kutilganNaqd.toLocaleString("uz-UZ")}
                    </div>
                  </div>
                  <div>
                    <span className="text-faint">Topshirilgan</span>
                    <div className="text-fg tnum">
                      {k.sanalganNaqd === null ? "—" : k.sanalganNaqd.toLocaleString("uz-UZ")}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 mt-1.5">
                  <span className="text-2xs text-faint">
                    Sof: <Money value={k.sofSumma} size="sm" tone="neutral" />
                    {k.submittedAt && <span> · {vaqtUzToshkent(k.submittedAt)}</span>}
                  </span>
                  <span className="text-2xs text-brand">Ko&apos;rish va qaror qilish ›</span>
                </div>

                {k.izoh && <p className="text-2xs text-muted mt-1">Izoh: {k.izoh}</p>}
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
