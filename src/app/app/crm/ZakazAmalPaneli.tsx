"use client";

import { formatDateUZ } from "@/lib/format";
import type { Ustun } from "@/lib/crm/pipeline";
import type { BuyurtmaDTO } from "./turlar";

/**
 * TEZ AMALLAR (10-talab) — ustunga qarab. Har ustunda faqat MA'NOLI
 * o'tishlar ko'rinadi, shunda sotuvchi noto'g'ri tugmani bosolmaydi.
 *
 * ARXIV USTUNLARIDA (Yutildi/Yo'qotildi) qaytarish tugmalari FAQAT
 * direktorga: "Yutildi"dan qaytarish kirimni o'chiradi va qarzni bekor
 * qiladi (`lib/crm/qaytarish.ts`), "Yo'qotildi"dan qaytarish esa arxivni
 * boshqaradigan odamning ishi. Server ikkalasini ham mustaqil tekshiradi —
 * bu yerdagi shart shunchaki ishlamaydigan tugmani ko'rsatmaydi.
 */
export function tezAmallar(ustun: Ustun, boshqaruvchi: boolean): { ustun: Ustun; matn: string }[] {
  if (ustun === "KUTILAYOTGAN") return [{ ustun: "BUGUNGI", matn: "Bugungi zakazga o'tkazish" }];
  if (ustun === "BUGUNGI") return [{ ustun: "JARAYONDA", matn: "Jarayonga o'tkazish" }];
  if (ustun === "JARAYONDA") return [{ ustun: "YUTILDI", matn: "Yutildi" }];
  if (!boshqaruvchi) return [];
  if (ustun === "YOQOTILDI") {
    return [
      { ustun: "KUTILAYOTGAN", matn: "Kutilayotganga qaytarish" },
      { ustun: "JARAYONDA", matn: "Jarayonga qaytarish" },
      { ustun: "YUTILDI", matn: "Yutildi" },
    ];
  }
  // YUTILDI — qaytarish MOLIYANI ham orqaga oladi, shuning uchun bitta
  // yo'nalish yetarli: zakaz "Jarayonda" ga tushadi va qaytadan yakunlanadi.
  return [{ ustun: "JARAYONDA", matn: "Yutildidan qaytarish" }];
}

/**
 * ZAKAZ AMALLARI PANELI — tafsilot oynasining harakat qismi.
 *
 * Yo'qotilgan zakazda birinchi navbatda SABAB ko'rinadi: direktor arxivni
 * ochganda birinchi savol "nega qo'ldan ketdi" bo'ladi, keyin esa zakazni
 * qaytarish yoki o'chirish.
 */
export function ZakazAmalPaneli({
  b,
  ustun,
  boshqaruvchi,
  onUstunga,
  onYoqotildi,
  onOchirish,
}: {
  b: BuyurtmaDTO;
  ustun: Ustun;
  boshqaruvchi: boolean;
  onUstunga: (u: Ustun) => void;
  onYoqotildi: () => void;
  onOchirish: () => void;
}) {
  return (
    <div className="space-y-3">
      {/* YO'QOTISH SABABI — arxiv ustunining butun ma'nosi shu qatorda. */}
      {ustun === "YOQOTILDI" && (
        <div className="rounded-xl bg-surface-2 px-3 py-2.5 space-y-0.5">
          <p className="text-2xs text-faint">
            Yo&apos;qotilgan sana:{" "}
            {b.yopilganAt ? formatDateUZ(new Date(b.yopilganAt)) : "noma'lum"}
          </p>
          <p className="text-sm text-fg">{b.yoqotishSababi ?? "Sabab yozilmagan (eski yozuv)"}</p>
        </div>
      )}

      {/* TEZ AMALLAR — mobilda sudrab tashlashning muqobili. */}
      <div className="flex gap-2 flex-wrap">
        {tezAmallar(ustun, boshqaruvchi).map((a) => (
          <button
            key={a.ustun}
            onClick={() => onUstunga(a.ustun)}
            className="flex-1 min-w-[8rem] rounded-lg bg-brand text-white text-sm font-medium py-2"
          >
            {a.matn}
          </button>
        ))}
        {ustun !== "YUTILDI" && ustun !== "YOQOTILDI" && (
          <button
            onClick={onYoqotildi}
            className="flex-1 min-w-[8rem] rounded-lg border border-line text-sm font-medium py-2 text-expense"
          >
            Yo&apos;qotildi
          </button>
        )}
        {/* O'CHIRISH — faqat direktor. Tugmani yashirish himoya emas:
            `DELETE /api/crm/deals/[id]` ham `requireManager` bilan yopilgan. */}
        {boshqaruvchi && (
          <button
            onClick={onOchirish}
            className="flex-1 min-w-[8rem] rounded-lg border border-expense/50 text-sm font-medium py-2 text-expense"
          >
            O&apos;chirish
          </button>
        )}
      </div>
    </div>
  );
}
