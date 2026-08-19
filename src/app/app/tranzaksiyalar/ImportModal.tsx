"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatSom } from "@/lib/format";

interface XatoQator {
  qator: number;
  xato: string;
  matn: string;
}
interface ParsedQator {
  qator: number;
  sana: string;
  turi: "kirim" | "chiqim";
  kategoriya: string;
  summa: number;
  izoh: string | null;
}
interface Tekshiruv {
  jami: number;
  xatolar: XatoQator[];
  namuna: ParsedQator[];
  maxQator: number;
}

const NAMUNA_CSV = `sana,turi,kategoriya,summa,izoh
2026-07-01,kirim,Sotuv,1250000,Do'kondan tushum
2026-07-02,chiqim,Ijara,3000000,Iyul oyi
2026-07-03,chiqim,Transport,150000,`;

/**
 * CSV IMPORT — ikki bosqichli.
 *
 * Avval fayl tekshiriladi va natija ko'rsatiladi (nechta to'g'ri, nechta xato,
 * birinchi 10 qator). Foydalanuvchi ko'rgandan keyingina yozadi — 200 qatorni
 * ko'r-ko'rona yozib yuborish xavfi yo'q.
 */
export function ImportModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [faylNomi, setFaylNomi] = useState("");
  const [tekshiruv, setTekshiruv] = useState<Tekshiruv | null>(null);
  const [natija, setNatija] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function faylTanlandi(e: ChangeEvent<HTMLInputElement>) {
    const fayl = e.target.files?.[0];
    if (!fayl) return;
    setFaylNomi(fayl.name);
    setNatija(null);
    setXato(null);
    const matn = await fayl.text();
    setCsv(matn);
    await tekshir(matn);
  }

  async function tekshir(matn: string) {
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch("/api/transactions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: matn, tekshirish: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Faylni o'qib bo'lmadi");
        return;
      }
      setTekshiruv(data);
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  async function tasdiqla() {
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch("/api/transactions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Import qilib bo'lmadi");
        return;
      }
      setNatija(data.yozildi);
      router.refresh();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  function namunaYuklab() {
    const blob = new Blob([NAMUNA_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "balansa-namuna.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal open onClose={onClose} title="CSV import">
      <div className="space-y-3">
        {natija === null ? (
          <>
            <p className="text-sm text-muted">
              Ustunlar: <code className="text-fg">sana, turi, kategoriya, summa, izoh</code>. Sana{" "}
              <code className="text-fg">YYYY-MM-DD</code>, turi <code className="text-fg">kirim</code>{" "}
              yoki <code className="text-fg">chiqim</code>. Kategoriya topilmasa yaratiladi.
            </p>
            <button type="button" onClick={namunaYuklab} className="text-sm text-brand hover:underline">
              Namuna faylni yuklab olish
            </button>

            <input
              type="file"
              accept=".csv,text/csv"
              onChange={faylTanlandi}
              className="w-full text-sm text-fg file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-surface-2 file:text-fg"
            />
            {faylNomi && <p className="text-2xs text-faint">Fayl: {faylNomi}</p>}

            {tekshiruv && (
              <div className="space-y-2 border-t border-line pt-3">
                <p className="text-sm text-fg">
                  To&apos;g&apos;ri qatorlar: <span className="font-semibold">{tekshiruv.jami}</span>
                  {tekshiruv.xatolar.length > 0 && (
                    <span className="text-expense"> · xato: {tekshiruv.xatolar.length}</span>
                  )}
                </p>

                {tekshiruv.namuna.length > 0 && (
                  <div className="jadval-siljish max-h-48 overflow-y-auto">
                    <table className="w-full text-2xs">
                      <thead className="text-faint uppercase text-left">
                        <tr>
                          <th className="pb-1">Sana</th>
                          <th className="pb-1">Turi</th>
                          <th className="pb-1">Kategoriya</th>
                          <th className="pb-1 text-right">Summa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {tekshiruv.namuna.map((q) => (
                          <tr key={q.qator}>
                            <td className="py-1">{q.sana}</td>
                            <td className={q.turi === "kirim" ? "text-income" : "text-expense"}>
                              {q.turi}
                            </td>
                            <td>{q.kategoriya}</td>
                            <td className="text-right tnum">{formatSom(q.summa)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {tekshiruv.jami > tekshiruv.namuna.length && (
                      <p className="text-2xs text-faint mt-1">
                        …va yana {tekshiruv.jami - tekshiruv.namuna.length} qator
                      </p>
                    )}
                  </div>
                )}

                {tekshiruv.xatolar.length > 0 && (
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {tekshiruv.xatolar.slice(0, 20).map((x) => (
                      <p key={x.qator} className="text-2xs text-expense">
                        {x.qator}-qator: {x.xato}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {xato && <p className="text-sm text-expense">{xato}</p>}

            <div className="flex gap-2 pt-1">
              <Button onClick={tasdiqla} loading={loading} disabled={!tekshiruv || tekshiruv.jami === 0}>
                {tekshiruv ? `${tekshiruv.jami} ta yozuvni import qilish` : "Import qilish"}
              </Button>
              <Button variant="secondary" onClick={onClose}>
                Bekor qilish
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-fg">
              ✅ <span className="font-semibold">{natija}</span> ta yozuv import qilindi.
            </p>
            <Button onClick={onClose}>Yopish</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
