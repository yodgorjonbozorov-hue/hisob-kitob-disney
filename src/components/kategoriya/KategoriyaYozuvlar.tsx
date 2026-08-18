"use client";

import { Money } from "@/components/ui/Money";
import { formatSom, formatDate, formatToshkentSoat } from "@/lib/format";
import type { TransactionDTO } from "@/lib/queries/transactions";

export interface KunlikJami {
  sana: string;
  summa: number;
  soni: number;
}

/** Sana kaliti — `sana` DateOnly (UTC-yarim tun) bo'lgani uchun ISO ning bosh 10 harfi. */
function sanaKalit(sana: string | Date): string {
  return (sana instanceof Date ? sana.toISOString() : String(sana)).slice(0, 10);
}

/**
 * KATEGORIYA YOZUVLARI — SANA bo'yicha guruhlangan ro'yxat.
 *
 * Kunlik jami serverdan keladi (`kunlik`), sahifadagi yozuvlardan
 * hisoblanmaydi: kun ikki sahifa chegarasiga tushsa, brauzerda jamlash
 * yolg'on raqam berardi.
 */
export function KategoriyaYozuvlar({
  items,
  kunlik,
  kirim,
}: {
  items: TransactionDTO[];
  kunlik: KunlikJami[] | null;
  kirim: boolean;
}) {
  const kunlikMap = new Map((kunlik ?? []).map((k) => [k.sana, k]));

  // Yozuvlar serverdan yangidan eskiga tartiblangan — tartib saqlanadi.
  const guruhlar: { sana: string; qatorlar: TransactionDTO[] }[] = [];
  for (const t of items) {
    const kalit = sanaKalit(t.sana);
    const oxirgi = guruhlar[guruhlar.length - 1];
    if (oxirgi && oxirgi.sana === kalit) oxirgi.qatorlar.push(t);
    else guruhlar.push({ sana: kalit, qatorlar: [t] });
  }

  return (
    <div className="space-y-4">
      {guruhlar.map((g) => {
        const kun = kunlikMap.get(g.sana);
        return (
          <div key={g.sana}>
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <h4 className="text-xs font-semibold text-fg">
                {formatDate(new Date(`${g.sana}T00:00:00.000Z`))}
              </h4>
              {kun && (
                <span className="text-2xs text-muted tnum">
                  Kunlik jami:{" "}
                  <span className={kirim ? "text-income" : "text-expense"}>
                    {formatSom(kun.summa)}
                  </span>
                  {kun.soni > g.qatorlar.length && ` · ${kun.soni} ta`}
                </span>
              )}
            </div>
            <ul className="divide-y divide-line border border-line rounded-lg">
              {g.qatorlar.map((t) => (
                <li key={t.id} className="px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-2xs text-muted tnum">
                        {formatToshkentSoat(new Date(t.createdAt))}
                        {t.account?.nomi ? ` · ${t.account.nomi}` : ""}
                      </p>
                      {t.izoh && <p className="text-sm text-fg mt-0.5 break-words">{t.izoh}</p>}
                      <p className="text-2xs text-faint mt-0.5">
                        {t.category.nomi} · kiritdi: {t.user.ism}
                      </p>
                    </div>
                    <Money
                      value={kirim ? t.summa : -t.summa}
                      size="sm"
                      signed
                      suffix={false}
                      className="shrink-0"
                    />
                  </div>
                  {/* Yozuv IDsi — qo'llab-quvvatlash uchun; ekranda past kontrastda. */}
                  <p className="text-[0.6rem] text-faint mt-1 font-mono truncate">{t.id}</p>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** Yuklanish paytidagi skelet — ro'yxat "sakramasin". */
export function KategoriyaSkelet() {
  return (
    <div className="space-y-2" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-14 rounded-lg bg-surface-2 animate-pulse" />
      ))}
    </div>
  );
}
