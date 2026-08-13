"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import type { KunlikTarixDTO } from "@/lib/queries/kunlik";
import { sanaUz } from "../vaqt";

function holatQatori(r: KunlikTarixDTO): string {
  switch (r.holat) {
    case "LOCKED":
      return `🔒 Yopilgan${r.confirmedByIsm ? ` · ${r.confirmedByIsm}` : ""}`;
    case "CONFIRMED":
      return `🟢 Tasdiqlangan${r.confirmedByIsm ? ` · ${r.confirmedByIsm}` : ""}`;
    case "SUBMITTED":
      return `📤 Topshirilgan${r.submittedByIsm ? ` · ${r.submittedByIsm}` : ""} — tasdiq kutilmoqda`;
    default:
      return "🟡 Tasdiqlanmagan";
  }
}

/**
 * OYNI YOPISH (M-10): oy ichidagi barcha tasdiqlangan kunlar qulflanadi va
 * QAYTARIB BO'LMAYDI — shuning uchun native confirm emas, aniq modal.
 */
function OyniYopishModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  // Standart tanlov — o'tgan oy: joriy oy odatda hali yakunlanmagan bo'ladi.
  const hozir = new Date();
  const otganOy = new Date(hozir.getFullYear(), hozir.getMonth() - 1, 1);
  const standart = `${otganOy.getFullYear()}-${String(otganOy.getMonth() + 1).padStart(2, "0")}`;

  const [oy, setOy] = useState(standart);
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function yop() {
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch("/api/kunlik/oyni-yopish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oy }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Oyni yopib bo'lmadi");
        return;
      }
      onDone();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Oyni yopish">
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Tanlangan oydagi barcha <span className="font-medium text-fg">tasdiqlangan</span> kunlar
          qulflanadi (🔒). Qulflangan kunni qayta ochib ham, o&apos;zgartirib ham bo&apos;lmaydi —
          bu QAYTARILMAYDIGAN amal. Tasdiqlanmagan kunlarga tegilmaydi.
        </p>
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="oyni-yopish-oy">
            Oy
          </label>
          <input
            id="oyni-yopish-oy"
            type="month"
            value={oy}
            onChange={(e) => setOy(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg"
          />
        </div>
        {xato && <p className="text-sm text-expense">{xato}</p>}
        <div className="flex gap-2 pt-1">
          <Button onClick={yop} loading={loading}>
            🔒 Oyni yopish
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function TarixClient({ tarix }: { tarix: KunlikTarixDTO[] }) {
  const router = useRouter();
  const [oyniYopish, setOyniYopish] = useState(false);

  return (
    <Card>
      <div className="flex justify-end mb-2">
        <Button size="sm" variant="secondary" onClick={() => setOyniYopish(true)}>
          🔒 Oyni yopish
        </Button>
      </div>
      {tarix.length === 0 ? (
        <EmptyState
          icon="📋"
          title="Hali kunlik hisobot yo'q"
          description="Birinchi tushum kiritilgach shu yerda kunlar ro'yxati paydo bo'ladi."
        />
      ) : (
        <ul className="divide-y divide-line">
          {tarix.map((r) => (
            <li key={r.id}>
              <Link
                href={`/app/kunlik?sana=${r.sana}`}
                className="py-3 flex items-center justify-between gap-3 hover:bg-surface-2 rounded-lg px-2 -mx-2 transition"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg">{sanaUz(r.sana)}</p>
                  <p className="text-2xs text-faint">
                    {holatQatori(r)}
                    {r.naqdFarq !== null && r.naqdFarq !== 0 && (
                      <span className="text-expense font-medium">
                        {" "}
                        · farq {r.naqdFarq < 0 ? "−" : "+"}
                        {Math.abs(r.naqdFarq).toLocaleString("uz-UZ")}
                      </span>
                    )}
                  </p>
                  {r.qaytaOchishSabab && r.holat === "OPEN" && (
                    <p className="text-2xs text-faint">
                      Qayta ochilgan: <span className="text-muted">{r.qaytaOchishSabab}</span>
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <Money value={r.jamiSumma} size="md" tone="neutral" />
                  <p className="text-2xs text-faint tnum">
                    💵 {r.naqdSumma.toLocaleString("uz-UZ")} · 💳{" "}
                    {r.clickSumma.toLocaleString("uz-UZ")} · 📋{" "}
                    {r.qarzSumma.toLocaleString("uz-UZ")}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {oyniYopish && (
        <OyniYopishModal
          onClose={() => setOyniYopish(false)}
          onDone={() => {
            setOyniYopish(false);
            router.refresh();
          }}
        />
      )}
    </Card>
  );
}
