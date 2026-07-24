"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatSom, formatSomLabel, parseSomInput } from "@/lib/format";
import type { ProductAdminDTO, OmborStats } from "@/lib/queries/inventory";

export function OmborClient({
  initialProducts,
  stats,
}: {
  initialProducts: ProductAdminDTO[];
  stats: OmborStats;
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [editing, setEditing] = useState<ProductAdminDTO | null>(null);
  const [stockFor, setStockFor] = useState<ProductAdminDTO | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  function refresh() {
    router.refresh();
  }

  async function toggleActive(p: ProductAdminDTO) {
    const res = await fetch(`/api/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    if (res.ok) {
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, isActive: !x.isActive } : x)));
      refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <p className="text-muted text-sm mb-1">Mahsulot turlari</p>
          <p className="text-2xl font-bold text-fg">{stats.turlarSoni}</p>
        </Card>
        <Card>
          <p className="text-muted text-sm mb-1">Jami qoldiq (dona)</p>
          <p className="text-2xl font-bold text-fg">{formatSom(stats.jamiQoldiq)}</p>
        </Card>
        <Card>
          <p className="text-muted text-sm mb-1">Ombor qiymati (tannarx)</p>
          <p className="text-2xl font-bold text-fg">{formatSomLabel(stats.omborQiymati)}</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="secondary" onClick={() => setBulkOpen(true)}>
          Ko'p tur qo'shish
        </Button>
        <Button onClick={() => setNewOpen(true)}>+ Yangi mahsulot</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-faint text-xs uppercase">
                <th className="pb-2">Nomi</th>
                <th className="pb-2 text-right">Tannarx</th>
                <th className="pb-2 text-right">Sotuv narxi</th>
                <th className="pb-2 text-right">Qoldiq</th>
                <th className="pb-2">Holati</th>
                <th className="pb-2 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-faint py-6">
                    Hali mahsulot yo'q
                  </td>
                </tr>
              )}
              {products.map((p) => (
                <tr key={p.id} className={p.isActive ? "" : "opacity-50"}>
                  <td className="py-2.5 font-medium">{p.nomi}</td>
                  <td className="py-2.5 text-right">{formatSomLabel(p.kelganNarx)}</td>
                  <td className="py-2.5 text-right">{formatSomLabel(p.sotuvNarx)}</td>
                  <td className={`py-2.5 text-right font-medium ${p.miqdor > 0 ? "text-fg" : "text-expense"}`}>
                    {p.miqdor > 0 ? formatSom(p.miqdor) : "Qolmadi"}
                  </td>
                  <td className="py-2.5">
                    <Badge tone={p.isActive ? "kirim" : "neutral"}>{p.isActive ? "Faol" : "Nofaol"}</Badge>
                  </td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => setStockFor(p)}
                      className="text-xs font-medium text-income hover:text-income-fg mr-3"
                    >
                      Ombor kirimi
                    </button>
                    <button
                      onClick={() => setEditing(p)}
                      className="text-xs font-medium text-muted hover:text-fg mr-3"
                    >
                      Narx
                    </button>
                    <button
                      onClick={() => toggleActive(p)}
                      className="text-xs font-medium text-muted hover:text-expense"
                    >
                      {p.isActive ? "Nofaol" : "Faol"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {newOpen && <NewProductModal onClose={() => setNewOpen(false)} onDone={refresh} />}
      {bulkOpen && <BulkProductsModal onClose={() => setBulkOpen(false)} onDone={refresh} />}
      {editing && (
        <EditPriceModal product={editing} onClose={() => setEditing(null)} onDone={refresh} />
      )}
      {stockFor && (
        <StockEntryModal product={stockFor} onClose={() => setStockFor(null)} onDone={refresh} />
      )}
    </div>
  );
}

function NarxInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value ? formatSom(parseSomInput(e.target.value)) : "")}
      placeholder={placeholder}
      className="w-full rounded-lg border border-line px-3 py-2 text-sm"
    />
  );
}

function NewProductModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [nomi, setNomi] = useState("");
  const [kelgan, setKelgan] = useState("");
  const [sotuv, setSotuv] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomi, kelganNarx: parseSomInput(kelgan), sotuvNarx: parseSomInput(sotuv) }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Xatolik");
      setLoading(false);
      return;
    }
    onClose();
    onDone();
  }

  return (
    <Modal open onClose={onClose} title="Yangi mahsulot">
      <form onSubmit={submit} className="space-y-3">
        <input
          type="text"
          value={nomi}
          onChange={(e) => setNomi(e.target.value)}
          placeholder="Nomi (masalan: Mikki)"
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          autoFocus
          required
        />
        <div>
          <label className="block text-xs text-muted mb-1">Kelgan narx (tannarx)</label>
          <NarxInput value={kelgan} onChange={setKelgan} placeholder="0" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Sotuv narxi</label>
          <NarxInput value={sotuv} onChange={setSotuv} placeholder="0" />
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

function BulkProductsModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState([
    { nomi: "", kelgan: "", sotuv: "" },
    { nomi: "", kelgan: "", sotuv: "" },
    { nomi: "", kelgan: "", sotuv: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function setRow(i: number, patch: Partial<{ nomi: string; kelgan: string; sotuv: string }>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const mahsulotlar = rows
      .filter((r) => r.nomi.trim())
      .map((r) => ({ nomi: r.nomi.trim(), kelganNarx: parseSomInput(r.kelgan), sotuvNarx: parseSomInput(r.sotuv) }));
    if (mahsulotlar.length === 0) {
      setError("Kamida bitta mahsulot nomi kiriting");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/products/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mahsulotlar }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Xatolik");
      setLoading(false);
      return;
    }
    onClose();
    onDone();
  }

  return (
    <Modal open onClose={onClose} title="Ko'p tur qo'shish">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-[1fr,90px,90px] gap-2 text-xs text-muted">
          <span>Nomi</span>
          <span>Tannarx</span>
          <span>Sotuv narxi</span>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr,90px,90px] gap-2">
            <input
              type="text"
              value={r.nomi}
              onChange={(e) => setRow(i, { nomi: e.target.value })}
              placeholder="Nomi"
              className="rounded-lg border border-line px-2 py-1.5 text-sm"
            />
            <input
              type="text"
              inputMode="numeric"
              value={r.kelgan}
              onChange={(e) => setRow(i, { kelgan: e.target.value ? formatSom(parseSomInput(e.target.value)) : "" })}
              placeholder="0"
              className="rounded-lg border border-line px-2 py-1.5 text-sm"
            />
            <input
              type="text"
              inputMode="numeric"
              value={r.sotuv}
              onChange={(e) => setRow(i, { sotuv: e.target.value ? formatSom(parseSomInput(e.target.value)) : "" })}
              placeholder="0"
              className="rounded-lg border border-line px-2 py-1.5 text-sm"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, { nomi: "", kelgan: "", sotuv: "" }])}
          className="text-sm text-income hover:text-income-fg"
        >
          + Yana qator
        </button>
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

function EditPriceModal({
  product,
  onClose,
  onDone,
}: {
  product: ProductAdminDTO;
  onClose: () => void;
  onDone: () => void;
}) {
  const [nomi, setNomi] = useState(product.nomi);
  const [kelgan, setKelgan] = useState(formatSom(product.kelganNarx));
  const [sotuv, setSotuv] = useState(formatSom(product.sotuvNarx));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomi, kelganNarx: parseSomInput(kelgan), sotuvNarx: parseSomInput(sotuv) }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Xatolik");
      setLoading(false);
      return;
    }
    onClose();
    onDone();
  }

  return (
    <Modal open onClose={onClose} title="Narx tahrirlash">
      <form onSubmit={submit} className="space-y-3">
        <input
          type="text"
          value={nomi}
          onChange={(e) => setNomi(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          required
        />
        <div>
          <label className="block text-xs text-muted mb-1">Kelgan narx (tannarx)</label>
          <NarxInput value={kelgan} onChange={setKelgan} placeholder="0" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Sotuv narxi</label>
          <NarxInput value={sotuv} onChange={setSotuv} placeholder="0" />
        </div>
        {error && <p className="text-expense text-sm">{error}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "..." : "Saqlash"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function StockEntryModal({
  product,
  onClose,
  onDone,
}: {
  product: ProductAdminDTO;
  onClose: () => void;
  onDone: () => void;
}) {
  const [miqdor, setMiqdor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const m = parseSomInput(miqdor);
    if (m <= 0) {
      setError("Miqdorni kiriting");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id, miqdor: m }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Xatolik");
      setLoading(false);
      return;
    }
    onClose();
    onDone();
  }

  return (
    <Modal open onClose={onClose} title={`Ombor kirimi: ${product.nomi}`}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-muted">
          Joriy qoldiq: <span className="font-medium text-fg">{formatSom(product.miqdor)} dona</span>
        </p>
        <div>
          <label className="block text-xs text-muted mb-1">Kelgan miqdor (dona)</label>
          <input
            type="text"
            inputMode="numeric"
            value={miqdor}
            onChange={(e) => setMiqdor(e.target.value ? formatSom(parseSomInput(e.target.value)) : "")}
            placeholder="0"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            autoFocus
          />
        </div>
        {error && <p className="text-expense text-sm">{error}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "..." : "Kiritish"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
