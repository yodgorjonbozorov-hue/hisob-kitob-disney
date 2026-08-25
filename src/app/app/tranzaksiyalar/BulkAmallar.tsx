"use client";

import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

/**
 * OMMAVIY AMALLAR — belgilangan yozuvlarni o'chirish yoki boshqa biznesga
 * ko'chirish. Faqat desktop jadvalidagi belgilash katakchalari orqali
 * yig'iladi; hech nima belgilanmagan bo'lsa faqat yozuvlar soni ko'rinadi.
 *
 * Har ikkala amal ham serverda huquq va biznes egaligini QAYTA tekshiradi
 * (`/api/transactions/bulk`, `/bulk-move`) — bu yerdagi tugma faqat oyna.
 */
export function BulkAmallar({
  selected,
  total,
  moveTargets,
  onOptimistik,
}: {
  selected: Set<string>;
  total: number;
  moveTargets: { id: string; nomi: string }[];
  /** Amal boshlanganda ro'yxatni darhol yangilash uchun (optimistik). */
  onOptimistik: (ids: string[]) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();

  async function ochirish() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`${ids.length} ta yozuv o'chirilsinmi?`)) return;
    onOptimistik(ids);
    const res = await fetch("/api/transactions/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (res.ok) {
      const data = await res.json();
      toast({ message: `${data.deleted} ta yozuv o'chirildi`, tone: "success" });
    } else {
      toast({ message: "O'chirib bo'lmadi", tone: "error" });
    }
    router.refresh();
  }

  async function kochirish(targetBusinessId: string) {
    const ids = Array.from(selected);
    if (ids.length === 0 || !targetBusinessId) return;
    const target = moveTargets.find((b) => b.id === targetBusinessId);
    if (!confirm(`${ids.length} ta yozuv "${target?.nomi}" biznesiga ko'chirilsinmi?`)) return;
    onOptimistik(ids);
    const res = await fetch("/api/transactions/bulk-move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, targetBusinessId }),
    });
    if (res.ok) {
      const data = await res.json();
      toast({ message: `${data.moved} ta yozuv "${target?.nomi}" ga ko'chirildi`, tone: "success" });
    } else {
      toast({ message: (await res.json()).error ?? "Ko'chirib bo'lmadi", tone: "error" });
    }
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between gap-3 min-h-[36px]">
      <span className="text-sm text-muted tnum">
        {selected.size > 0 ? `${selected.size} ta tanlandi` : `${total} ta yozuv`}
      </span>
      {selected.size > 0 && (
        <div className="flex items-center gap-3">
          {moveTargets.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                const v = e.target.value;
                e.target.value = "";
                if (v) kochirish(v);
              }}
              className="text-sm rounded-lg border border-line bg-surface px-2 py-1 text-brand font-medium"
              aria-label="Boshqa biznesga ko'chirish"
            >
              <option value="">Ko&apos;chirish →</option>
              {moveTargets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nomi}
                </option>
              ))}
            </select>
          )}
          <button onClick={ochirish} className="text-sm font-medium text-expense hover:underline">
            O&apos;chirish ({selected.size})
          </button>
        </div>
      )}
    </div>
  );
}
