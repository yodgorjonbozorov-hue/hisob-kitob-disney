"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatSomLabel } from "@/lib/format";
import type { KodliMahsulotDTO } from "@/lib/queries/pos";
import { KodOynasi } from "./KodOynasi";

/**
 * QR / SHTRIX-KOD ro'yxati.
 *
 * Har mahsulot uchun ikki xil kod alohida ko'rsatiladi:
 *   — zavod shtrix-kodi (quti ustidagi raqam, do'kon uni faqat saqlaydi);
 *   — Balansa QR (kodi yo'q tovar uchun tizim yaratadigan barqaror kalit).
 */
export function QrClient({ mahsulotlar }: { mahsulotlar: KodliMahsulotDTO[] }) {
  const router = useRouter();
  const [qidiruv, setQidiruv] = useState("");
  const [tahrir, setTahrir] = useState<string | null>(null);
  const [barcode, setBarcode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  const [xabar, setXabar] = useState<string | null>(null);
  const [koroq, setKoroq] = useState<{ kod: string; turi: "qr" | "barcode"; nomi: string } | null>(
    null
  );

  const q = qidiruv.trim().toLowerCase();
  const korinadigan = mahsulotlar.filter(
    (p) => !q || p.nomi.toLowerCase().includes(q) || (p.barcode?.toLowerCase().includes(q) ?? false)
  );

  async function barcodeSaqla(productId: string) {
    setBusy(productId);
    setXato(null);
    try {
      const res = await fetch(`/api/pos/mahsulot/${productId}/barcode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      setTahrir(null);
      setBarcode("");
      router.refresh();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setBusy(null);
    }
  }

  /**
   * KODSIZ TOVARLARNING HAMMASIGA QR — 100+ tovarli do'kon uchun.
   *
   * Bittalab bosish amalda bajarib bo'lmaydigan ish edi. Amal idempotent:
   * kodi borlar tegilmaydi, shuning uchun ikki marta bosish zararsiz.
   */
  async function hammasigaQr() {
    setBusy("hammasi");
    setXato(null);
    try {
      const res = await fetch("/api/pos/mahsulot/qr-hammasi", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      setXabar(
        data.yaratildi > 0
          ? `${data.yaratildi} ta tovarga QR yaratildi.` +
              (data.qolgan > 0 ? ` Yana ${data.qolgan} tasi qoldi — tugmani qayta bosing.` : "")
          : "Kodsiz tovar topilmadi — hammasida kod bor."
      );
      router.refresh();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setBusy(null);
    }
  }

  async function qrYarat(productId: string) {
    setBusy(productId);
    setXato(null);
    try {
      const res = await fetch(`/api/pos/mahsulot/${productId}/qr`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      router.refresh();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="bg-surface rounded-2xl border border-line p-4 flex flex-wrap items-center gap-2 justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg">Ko&apos;p tovar bilan ishlash</p>
          <p className="text-xs text-muted mt-0.5">
            Kodsiz tovarlarga bir yo&apos;la QR yarating, so&apos;ng yorliqlarni stiker
            printerida chop eting.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="secondary" loading={busy === "hammasi"} onClick={hammasigaQr}>
            Kodsiz tovarlarga QR yaratish
          </Button>
          <Link href="/app/pos/qr/chop">
            <Button>Yorliqlarni chop etish</Button>
          </Link>
        </div>
      </div>

      {xabar && (
        <p className="text-sm text-income-fg bg-income-soft border border-income/40 rounded-lg px-3 py-2">
          {xabar}
        </p>
      )}

      <input
        value={qidiruv}
        onChange={(e) => setQidiruv(e.target.value)}
        placeholder="Mahsulot nomi yoki kodi bo'yicha qidirish"
        aria-label="Mahsulot qidirish"
        className="w-full rounded-xl border border-line px-4 py-3 text-sm bg-surface"
      />

      {xato && (
        <p className="text-sm text-expense-fg bg-expense-soft border border-expense/40 rounded-lg px-3 py-2">
          {xato}
        </p>
      )}

      {korinadigan.length === 0 && (
        <Card>
          <p className="text-sm text-muted text-center py-8">Mahsulot topilmadi.</p>
        </Card>
      )}

      {korinadigan.map((p) => (
        <Card key={p.id}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="font-medium text-fg">{p.nomi}</p>
              <p className="text-xs text-muted mt-0.5">
                {formatSomLabel(p.sotuvNarx)} / {p.birlik}
                {p.sku ? ` · artikul ${p.sku}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {p.barcode ? (
                <>
                  <Badge tone="info">{p.barcode}</Badge>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setKoroq({ kod: p.barcode!, turi: "barcode", nomi: p.nomi })}
                  >
                    Ko&apos;rish
                  </Button>
                </>
              ) : null}
              {p.qrKod ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setKoroq({ kod: p.qrKod!, turi: "qr", nomi: p.nomi })}
                >
                  QR ko&apos;rish
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={busy === p.id}
                  onClick={() => qrYarat(p.id)}
                >
                  QR yaratish
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setTahrir(tahrir === p.id ? null : p.id);
                  setBarcode(p.barcode ?? "");
                  setXato(null);
                }}
              >
                {p.barcode ? "Kodni o'zgartirish" : "Shtrix-kod biriktirish"}
              </Button>
            </div>
          </div>

          {tahrir === p.id && (
            <div className="mt-3 pt-3 border-t border-line flex flex-wrap gap-2 items-center">
              <input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Quti ustidagi raqam (masalan 4601234567890)"
                autoFocus
                className="flex-1 min-w-[220px] rounded-lg border border-line px-3 py-2 text-sm bg-surface"
              />
              <Button loading={busy === p.id} onClick={() => barcodeSaqla(p.id)}>
                Saqlash
              </Button>
              <Button variant="secondary" onClick={() => setTahrir(null)}>
                Bekor qilish
              </Button>
              <p className="text-xs text-faint w-full">
                Kodni skanerlab ham kiritish mumkin: maydonni bosing va tovarni skanerlang.
                Bo&apos;sh qoldirsangiz kod olib tashlanadi.
              </p>
            </div>
          )}
        </Card>
      ))}

      {koroq && (
        <KodOynasi
          kod={koroq.kod}
          turi={koroq.turi}
          nomi={koroq.nomi}
          onClose={() => setKoroq(null)}
        />
      )}
    </div>
  );
}
