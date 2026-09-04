"use client";

import { useState } from "react";
import { Money } from "@/components/ui/Money";
import type { XodimOylikHisobi } from "@/lib/kpi/oylik";
import type { TuzatishDTO } from "@/lib/kpi/payroll";
import { OylikBelgi, qisqaSumma } from "../kpiUi";

/**
 * OYLIK XULOSASI — sahifaning javob beruvchi qismi.
 *
 * "Bu xodimga hozir qancha oylik chiqdi" savolining javobi eng katta va eng
 * ko'zga tashlanadigan element bo'lishi kerak; uning ustidagi qatorlar esa
 * shu raqam QAYERDAN kelganini bir qarashda ko'rsatadi.
 *
 * Sotuv bonusi qatori BOSILADI — ochilganda progressiv intervallar bo'yicha
 * to'liq hisob ko'rinadi (rahbar ham, sotuvchi ham raqamni tekshira olsin).
 */
export function OylikXulosa({
  hisob,
  tuzatishlar,
}: {
  hisob: XodimOylikHisobi;
  tuzatishlar: TuzatishDTO[];
}) {
  const [bonusOchiq, setBonusOchiq] = useState(false);

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-fg">Oylik hisobi</h2>
        <OylikBelgi holat={hisob.holat} />
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted">Vazifa haqi</dt>
          <dd>
            <Money value={hisob.vazifaHaqi} size="sm" />
          </dd>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setBonusOchiq((v) => !v)}
            className="w-full flex items-baseline justify-between gap-3 text-left"
            aria-expanded={bonusOchiq}
          >
            <dt className="text-muted flex items-center gap-1">
              Sotuv bonusi <span className="text-faint text-2xs">{bonusOchiq ? "▾" : "▸"}</span>
            </dt>
            <dd>
              <Money value={hisob.sotuvBonusi} size="sm" />
            </dd>
          </button>

          {bonusOchiq && (
            <div className="mt-2 rounded-xl bg-surface-2 p-3 space-y-1.5">
              {hisob.bonusQatorlari.length === 0 ? (
                <p className="text-2xs text-muted">
                  {hisob.sotuvBonusi > 0
                    ? "Bu oy yopilgan — bonus o'sha paytdagi sozlama bo'yicha hisoblangan."
                    : "Bu oy sotuv mavjud emas."}
                </p>
              ) : (
                <>
                  {hisob.bonusQatorlari.map((q, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-2 text-2xs">
                      <span className="text-muted tnum">
                        {qisqaSumma(q.dan)}–{q.gacha === null ? "yuqori" : qisqaSumma(q.gacha)}:{" "}
                        <span className="text-fg">
                          {qisqaSumma(q.summa)} × {q.foiz / 100}%
                        </span>
                      </span>
                      <span className="text-fg tnum font-medium">
                        {q.bonus.toLocaleString("uz-UZ")}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-baseline justify-between gap-2 border-t border-line pt-1.5 text-2xs">
                    <span className="text-muted">Jami sotuv bonusi</span>
                    <span className="text-fg tnum font-bold">
                      {hisob.sotuvBonusi.toLocaleString("uz-UZ")}
                    </span>
                  </div>
                  <p className="text-2xs text-faint pt-1">
                    Har interval o&apos;z foizi bilan hisoblanadi — umumiy summaga bitta foiz
                    qo&apos;llanmaydi.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted">
            Plan bonusi
            {!hisob.planBajarildi && <span className="text-faint text-2xs"> · plan bajarilmagan</span>}
          </dt>
          <dd>
            <Money value={hisob.planBonusi} size="sm" />
          </dd>
        </div>

        {hisob.qatnashuv && hisob.qatnashuv.jami > 0 && (
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted">
                Zakaz qatnashuvi
                <span className="text-faint text-2xs"> · {hisob.qatnashuv.jami} ta zakaz</span>
              </dt>
              <dd>
                <Money value={hisob.qatnashuvHaqi} size="sm" />
              </dd>
            </div>
            <ul className="mt-1 space-y-1">
              {hisob.qatnashuv.lavozimlar.map((l) => (
                <li key={l.categoryId} className="flex items-baseline justify-between gap-2 text-2xs text-faint">
                  <span className="truncate">
                    {l.nomi} · {l.jami} ta ({l.bajarildi} bajarildi, {l.bekor} bekor)
                    {l.ortachaBaho !== null && ` · baho ${l.ortachaBaho}`}
                  </span>
                  <span className="tnum shrink-0">{l.summa.toLocaleString("uz-UZ")}</span>
                </li>
              ))}
            </ul>
            {hisob.yakuniy && (
              <p className="mt-1 text-2xs text-faint">
                Oy yopilgan — qatnashuv faqat ko&apos;rsatiladi, yakuniy summaga qo&apos;shilmaydi.
              </p>
            )}
          </div>
        )}

        {tuzatishlar.length > 0 && (
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted">Tuzatish</dt>
              <dd>
                <Money value={hisob.tuzatish} size="sm" signed />
              </dd>
            </div>
            <ul className="mt-1 space-y-1">
              {tuzatishlar.map((t) => (
                <li key={t.id} className="flex items-baseline justify-between gap-2 text-2xs text-faint">
                  <span className="truncate">
                    {t.sana} · {t.sabab}
                    {t.userIsm && ` · ${t.userIsm}`}
                  </span>
                  <span className="tnum shrink-0">{t.summa.toLocaleString("uz-UZ")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </dl>

      <div className="mt-4 border-t border-line pt-4">
        <p className="text-2xs text-muted uppercase tracking-wide">
          {hisob.yakuniy ? "Yakuniy oylik" : "Jami oylik (hozirgi hisob)"}
        </p>
        <Money value={hisob.jami} size="display" tone="brand" />
        {!hisob.yakuniy && (
          <p className="text-2xs text-faint mt-1">
            Oy davom etmoqda — sotuv va ball o&apos;zgarsa bu summa avtomatik yangilanadi.
          </p>
        )}
      </div>
    </div>
  );
}
