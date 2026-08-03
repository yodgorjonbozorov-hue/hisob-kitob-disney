"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatSom, formatSomLabel, parseSomInput, formatDateUZ, formatMoneyCompact } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { QARZ_MATN, isAvto, type QarzTuri } from "@/lib/biznesTuri";
import type { DebtDTO } from "@/lib/queries/inventory";

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}
/** Aging guruhi: 0-30 / 31-60 / 61-90 / 90+ */
function bucketOf(days: number): 0 | 1 | 2 | 3 {
  if (days <= 30) return 0;
  if (days <= 60) return 1;
  if (days <= 90) return 2;
  return 3;
}
const BUCKET_META = [
  { label: "0–30 kun", cls: "text-income" },
  { label: "31–60 kun", cls: "text-debt dark:text-debt-fg" },
  { label: "61–90 kun", cls: "text-orange-600 dark:text-orange-400" },
  { label: "90+ kun", cls: "text-expense" },
];

/** Ro'yxatdagi tanlanadigan mahsulot/mashina (qarzni unga bog'lash uchun). */
export interface QarzProductOption {
  id: string;
  nomi: string;
}

export function QarzlarClient({
  initialDebts,
  products = [],
  biznesTuri = "umumiy",
}: {
  initialDebts: DebtDTO[];
  products?: QarzProductOption[];
  biznesTuri?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const avto = isAvto(biznesTuri);
  const [debts, setDebts] = useState(initialDebts);
  // router.refresh() dan keyin server yangi ro'yxatni beradi — lokal state bilan moslaymiz.
  useEffect(() => setDebts(initialDebts), [initialDebts]);
  const [tab, setTab] = useState<QarzTuri>("olinadigan");
  const [payFor, setPayFor] = useState<DebtDTO | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const jami = (turi: QarzTuri) =>
    debts.filter((d) => d.turi === turi && !d.isYopilgan).reduce((a, d) => a + d.qolgan, 0);
  const olinadiganJami = jami("olinadigan");
  const beriladiganJami = jami("beriladigan");
  const sof = olinadiganJami - beriladiganJami;

  const joriy = debts.filter((d) => d.turi === tab);
  const ochiq = joriy.filter((d) => !d.isYopilgan);

  // Aging guruhlari bo'yicha qolgan summa (joriy yo'nalish).
  const buckets = [0, 0, 0, 0];
  ochiq.forEach((d) => (buckets[bucketOf(daysSince(d.sana))] += d.qolgan));

  // Ochiq qarzlar eng eski (ko'p kun) birinchi; yopilganlar oxirida.
  const sorted = [...joriy].sort((a, b) => {
    if (a.isYopilgan !== b.isYopilgan) return a.isYopilgan ? 1 : -1;
    return new Date(a.sana).getTime() - new Date(b.sana).getTime();
  });

  function reminder(d: DebtDTO) {
    const text = `Assalomu alaykum, ${d.mijozNomi}. Sizning ${formatSomLabel(d.qolgan)} miqdoridagi qarzingiz eslatib o'tamiz. Iltimos, imkoniyat bo'lganda to'lab qo'ysangiz. Rahmat.`;
    navigator.clipboard?.writeText(text).then(
      () => toast({ message: "Eslatma matni nusxalandi", tone: "success" }),
      () => toast({ message: text, tone: "neutral", duration: 8000 })
    );
  }

  function onPaid(debtId: string, tolangan: number, qolgan: number, isYopilgan: boolean) {
    setDebts((prev) =>
      prev.map((d) => (d.id === debtId ? { ...d, tolangan, qolgan, isYopilgan } : d))
    );
    setPayFor(null);
    router.refresh();
  }

  const M = QARZ_MATN[tab];

  return (
    <div className="space-y-4">
      {/* Ikki yo'nalish yakuni — "hamma qarzdorlik bir ko'rinishda". */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setTab("olinadigan")}
          className={`text-left bg-surface rounded-2xl shadow-card border p-4 transition ${
            tab === "olinadigan" ? "border-brand" : "border-line"
          }`}
        >
          <p className="text-muted text-sm mb-1">{QARZ_MATN.olinadigan.nomi}</p>
          <p className="text-xl font-semibold text-debt tnum">{formatSomLabel(olinadiganJami)}</p>
          <p className="text-2xs text-faint mt-1">Kelishi kerak bo'lgan pul</p>
        </button>
        <button
          type="button"
          onClick={() => setTab("beriladigan")}
          className={`text-left bg-surface rounded-2xl shadow-card border p-4 transition ${
            tab === "beriladigan" ? "border-brand" : "border-line"
          }`}
        >
          <p className="text-muted text-sm mb-1">{QARZ_MATN.beriladigan.nomi}</p>
          <p className="text-xl font-semibold text-expense tnum">{formatSomLabel(beriladiganJami)}</p>
          <p className="text-2xs text-faint mt-1">To'lanishi kerak bo'lgan pul</p>
        </button>
        <div className="bg-surface rounded-2xl shadow-card border border-line p-4">
          <p className="text-muted text-sm mb-1">Sof holat</p>
          <p className={`text-xl font-semibold tnum ${sof >= 0 ? "text-income" : "text-expense"}`}>
            {formatSomLabel(sof)}
          </p>
          <p className="text-2xs text-faint mt-1">
            {sof >= 0 ? "Sizga ko'proq qarzdor" : "Siz ko'proq qarzdorsiz"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {(["olinadigan", "beriladigan"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                tab === t ? "bg-brand text-white" : "bg-surface-2 text-muted"
              }`}
            >
              {QARZ_MATN[t].nomi}
              <span className="ml-1.5 text-2xs opacity-80">
                {debts.filter((d) => d.turi === t && !d.isYopilgan).length}
              </span>
            </button>
          ))}
        </div>
        <Button onClick={() => setNewOpen(true)}>+ Qarz qo'shish</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {BUCKET_META.map((b, i) => (
          <div key={i} className="bg-surface rounded-2xl shadow-card border border-line p-4">
            <p className="text-muted text-sm mb-1">{b.label}</p>
            <p className={`text-lg font-semibold tnum ${b.cls}`}>{formatMoneyCompact(buckets[i])}</p>
          </div>
        ))}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-faint text-xs uppercase">
                <th className="pb-2">{M.tomon}</th>
                <th className="pb-2">Telefon</th>
                <th className="pb-2">{avto ? "Mashina" : "Mahsulot"}</th>
                <th className="pb-2 text-right">Jami</th>
                <th className="pb-2 text-right">To'langan</th>
                <th className="pb-2 text-right">Qolgan</th>
                <th className="pb-2">Sana</th>
                <th className="pb-2 text-right">Amal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-faint py-6">
                    {tab === "olinadigan" ? "Sizga qarzdorlar yo'q" : "Sizning qarzingiz yo'q"}
                  </td>
                </tr>
              )}
              {sorted.map((d) => {
                const days = daysSince(d.sana);
                const bm = BUCKET_META[bucketOf(days)];
                const muddatOtdi =
                  !d.isYopilgan && d.muddat !== null && new Date(d.muddat).getTime() < Date.now();
                return (
                  <tr key={d.id} className={d.isYopilgan ? "opacity-50" : ""}>
                    <td className="py-2.5 font-medium">
                      {d.mijozNomi}
                      {!d.isYopilgan && (
                        <span className={`ml-2 text-2xs ${bm.cls}`}>{days} kun</span>
                      )}
                      {muddatOtdi && (
                        <span className="ml-2 text-2xs text-expense">
                          muddat: {formatDateUZ(new Date(d.muddat!))}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-muted">{d.mijozTel ?? "—"}</td>
                    <td className="py-2.5 text-muted">{d.productNomi ?? "—"}</td>
                    <td className="py-2.5 text-right tnum">{formatSomLabel(d.jamiSumma)}</td>
                    <td className="py-2.5 text-right text-income tnum">{formatSom(d.tolangan)}</td>
                    <td className="py-2.5 text-right font-medium text-debt tnum">{formatSom(d.qolgan)}</td>
                    <td className="py-2.5 text-muted whitespace-nowrap">{formatDateUZ(new Date(d.sana))}</td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      {d.isYopilgan ? (
                        <Badge tone="kirim">Yopilgan</Badge>
                      ) : (
                        <>
                          {d.turi === "olinadigan" && (
                            <button onClick={() => reminder(d)} className="text-xs font-medium text-muted hover:text-fg mr-3">
                              Eslatma
                            </button>
                          )}
                          <button onClick={() => setPayFor(d)} className="text-xs font-medium text-income hover:text-income-fg">
                            {d.turi === "olinadigan" ? "To'lov" : "To'lash"}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {payFor && <PaymentModal debt={payFor} onClose={() => setPayFor(null)} onPaid={onPaid} />}
      {newOpen && (
        <NewDebtModal
          turi={tab}
          products={products}
          avto={avto}
          onClose={() => setNewOpen(false)}
          onDone={() => {
            setNewOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function PaymentModal({
  debt,
  onClose,
  onPaid,
}: {
  debt: DebtDTO;
  onClose: () => void;
  onPaid: (debtId: string, tolangan: number, qolgan: number, isYopilgan: boolean) => void;
}) {
  const [summa, setSumma] = useState(formatSom(debt.qolgan));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const beriladigan = debt.turi === "beriladigan";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const s = parseSomInput(summa);
    if (s <= 0) {
      setError("Summani kiriting");
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/debts/${debt.id}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summa: s }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Xatolik");
      setLoading(false);
      return;
    }
    onPaid(debt.id, data.tolangan, data.qolgan, data.isYopilgan);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${beriladigan ? "To'lash" : "To'lov"}: ${debt.mijozNomi}`}
    >
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-muted">
          Qolgan qarz: <span className="font-medium text-debt">{formatSomLabel(debt.qolgan)}</span>
        </p>
        <div>
          <label className="block text-xs text-muted mb-1">
            {beriladigan ? "To'lanadigan summa (so'm)" : "To'lov summasi (so'm)"}
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={summa}
            onChange={(e) => setSumma(e.target.value ? formatSom(parseSomInput(e.target.value)) : "")}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            autoFocus
          />
        </div>
        <p className="text-xs text-faint">
          {beriladigan
            ? "Chiqim yozuvi avtomatik yaratiladi (\"Qarz to'lash\")."
            : "Kirim yozuvi avtomatik yaratiladi (\"Qarz to'lovi\")."}
        </p>
        {error && <p className="text-expense text-sm">{error}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "..." : beriladigan ? "To'ladim" : "Qabul qilish"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Qo'lda qarzdorlik qo'shish — ikki yo'nalishda ham (sotuvsiz). */
function NewDebtModal({
  turi: boshlangichTuri,
  products,
  avto,
  onClose,
  onDone,
}: {
  turi: QarzTuri;
  products: QarzProductOption[];
  avto: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [turi, setTuri] = useState<QarzTuri>(boshlangichTuri);
  const [nomi, setNomi] = useState("");
  const [tel, setTel] = useState("");
  const [summa, setSumma] = useState("");
  const [tolangan, setTolangan] = useState("");
  const [productId, setProductId] = useState("");
  const [muddat, setMuddat] = useState("");
  const [izoh, setIzoh] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const jamiSumma = parseSomInput(summa);
    if (jamiSumma <= 0) {
      setError("Summani kiriting");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/debts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        turi,
        mijozNomi: nomi,
        mijozTel: tel || null,
        jamiSumma,
        tolangan: tolangan ? parseSomInput(tolangan) : 0,
        productId: productId || null,
        muddat: muddat || null,
        izoh: izoh || null,
      }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Xatolik");
      setLoading(false);
      return;
    }
    onDone();
  }

  return (
    <Modal open onClose={onClose} title="Yangi qarzdorlik">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(["olinadigan", "beriladigan"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTuri(t)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                turi === t ? "border-brand text-brand bg-brand/5" : "border-line text-muted"
              }`}
            >
              {QARZ_MATN[t].nomi}
            </button>
          ))}
        </div>
        <p className="text-xs text-faint">{QARZ_MATN[turi].tavsif}</p>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-muted mb-1">{QARZ_MATN[turi].tomon}</label>
            <input
              type="text"
              value={nomi}
              onChange={(e) => setNomi(e.target.value)}
              placeholder="Ism familiya"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Telefon</label>
            <input
              type="text"
              value={tel}
              onChange={(e) => setTel(e.target.value)}
              placeholder="+998 ..."
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-muted mb-1">Qarz summasi</label>
            <input
              type="text"
              inputMode="numeric"
              value={summa}
              onChange={(e) => setSumma(e.target.value ? formatSom(parseSomInput(e.target.value)) : "")}
              placeholder="0"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Shundan to'langan (ixtiyoriy)</label>
            <input
              type="text"
              inputMode="numeric"
              value={tolangan}
              onChange={(e) => setTolangan(e.target.value ? formatSom(parseSomInput(e.target.value)) : "")}
              placeholder="0"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
          </div>
        </div>
        <p className="text-xs text-faint">
          Bu yerda kiritilgan qarz pul harakatini yozmaydi — kirim/chiqim to'lov qabul qilinganda yoziladi.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-muted mb-1">{avto ? "Mashina" : "Mahsulot"} (ixtiyoriy)</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-surface"
            >
              <option value="">Bog'lanmagan</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nomi}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">To'lov muddati (ixtiyoriy)</label>
            <input
              type="date"
              value={muddat}
              onChange={(e) => setMuddat(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Izoh (ixtiyoriy)</label>
          <input
            type="text"
            value={izoh}
            onChange={(e) => setIzoh(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-expense text-sm">{error}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "..." : "Qo'shish"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
