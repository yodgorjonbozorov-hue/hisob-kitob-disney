import Link from "next/link";
import { DAVR_YORLIQ, type KassaDavr } from "@/lib/kassaDavr";

const TUGMALAR: KassaDavr[] = ["bugun", "hafta", "oy", "barchasi"];

/**
 * KASSA DETALI DAVR FILTRI — havolalar + sana oralig'i formasi.
 *
 * ATAYLAB client komponenti EMAS: havola va oddiy GET forma serverda
 * ishlaydi, ya'ni filtr JS yuklanmasdan ham ishlaydi va ro'yxat BAZADAN
 * kesib olinadi (hammasini yuklab, brauzerda filtrlash emas).
 */
export function DavrFiltr({
  accountId,
  davr,
  dan,
  gacha,
}: {
  accountId: string;
  davr: KassaDavr;
  dan: string;
  gacha: string;
}) {
  const asos = `/app/kassa/${accountId}`;
  const maydon =
    "px-3 py-2 min-h-[44px] rounded-lg bg-surface-2 border border-line text-fg text-sm w-full sm:w-auto";

  return (
    <div className="space-y-2">
      <nav className="flex gap-1 p-1 rounded-lg bg-surface-2 overflow-x-auto">
        {TUGMALAR.map((t) => (
          <Link
            key={t}
            href={`${asos}?davr=${t}`}
            className={`px-3 min-h-[36px] flex items-center rounded-md text-xs font-medium whitespace-nowrap transition ${
              t === davr ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg"
            }`}
          >
            {DAVR_YORLIQ[t]}
          </Link>
        ))}
      </nav>

      <form
        method="get"
        action={asos}
        className="flex flex-wrap items-end gap-2 text-2xs text-muted"
      >
        <input type="hidden" name="davr" value="oraliq" />
        <label className="flex-1 min-w-[8.5rem]">
          <span className="block mb-1">Sanadan</span>
          <input type="date" name="dan" defaultValue={dan} className={maydon} />
        </label>
        <label className="flex-1 min-w-[8.5rem]">
          <span className="block mb-1">Sanagacha</span>
          <input type="date" name="gacha" defaultValue={gacha} className={maydon} />
        </label>
        <button
          type="submit"
          className="min-h-[44px] px-4 rounded-lg bg-surface-2 border border-line text-sm font-medium text-fg hover:border-brand"
        >
          Ko&apos;rish
        </button>
      </form>
    </div>
  );
}
