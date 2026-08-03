"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatSom, formatSomLabel, parseSomInput } from "@/lib/format";
import { omborMatn, isAvto } from "@/lib/biznesTuri";
import type { ProductAdminDTO, OmborStats } from "@/lib/queries/inventory";

export function OmborClient({
  initialProducts,
  stats,
  biznesTuri = "umumiy",
}: {
  initialProducts: ProductAdminDTO[];
  stats: OmborStats;
  biznesTuri?: string;
}) {
  const router = useRouter();
  const avto = isAvto(biznesTuri);
  const M = omborMatn(biznesTuri);
  const [products, setProducts] = useState(initialProducts);
  // router.refresh() dan keyin server yangi ro'yxatni beradi — lokal state bilan moslaymiz.
  useEffect(() => setProducts(initialProducts), [initialProducts]);
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
          <p className="text-muted text-sm mb-1">{M.turlarSoni}</p>
          <p className="text-2xl font-bold text-fg">{stats.turlarSoni}</p>
        </Card>
        <Card>
          <p className="text-muted text-sm mb-1">{M.jamiQoldiq}</p>
          <p className="text-2xl font-bold text-fg">
            {formatSom(stats.jamiQoldiq)}
            {avto && <span className="text-base font-medium text-muted"> {M.dona}</span>}
          </p>
        </Card>
        <Card>
          <p className="text-muted text-sm mb-1">{M.omborQiymati}</p>
          <p className="text-2xl font-bold text-fg">{formatSomLabel(stats.omborQiymati)}</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 justify-end">
        {!avto && (
          <Button variant="secondary" onClick={() => setBulkOpen(true)}>
            {M.koproq}
          </Button>
        )}
        <Button onClick={() => setNewOpen(true)}>{M.yangi}</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-faint text-xs uppercase">
                <th className="pb-2">{avto ? "Mashina" : "Nomi"}</th>
                {avto && <th className="pb-2">Yil</th>}
                {avto && <th className="pb-2">Davlat raqami</th>}
                <th className="pb-2 text-right">{avto ? "Olingan narx" : "Tannarx"}</th>
                <th className="pb-2 text-right">Sotuv narxi</th>
                {avto && <th className="pb-2 text-right">Kutilayotgan foyda</th>}
                <th className="pb-2 text-right">{M.qoldiq}</th>
                {!avto && <th className="pb-2">Holati</th>}
                <th className="pb-2 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {products.length === 0 && (
                <tr>
                  <td colSpan={avto ? 8 : 6} className="text-center text-faint py-6">
                    {M.bosh}
                  </td>
                </tr>
              )}
              {products.map((p) => {
                const kutilayotganFoyda = p.sotuvNarx > 0 ? p.sotuvNarx - p.kelganNarx : 0;
                return (
                <tr key={p.id} className={p.isActive ? "" : "opacity-50"}>
                  <td className="py-2.5 font-medium">
                    {p.nomi}
                    {avto && p.avtoRang && <span className="ml-2 text-2xs text-faint">{p.avtoRang}</span>}
                  </td>
                  {avto && <td className="py-2.5 text-muted tnum">{p.avtoYil ?? "—"}</td>}
                  {avto && <td className="py-2.5 text-muted">{p.avtoRaqam ?? "—"}</td>}
                  <td className="py-2.5 text-right">{formatSomLabel(p.kelganNarx)}</td>
                  <td className="py-2.5 text-right">
                    {p.sotuvNarx > 0 ? formatSomLabel(p.sotuvNarx) : <span className="text-faint">qo'yilmagan</span>}
                  </td>
                  {avto && (
                    // Sotilgan mashina uchun haqiqiy foyda quyidagi "sof foyda" jadvalida.
                    <td
                      className={`py-2.5 text-right tnum font-medium ${
                        p.sotuvNarx === 0 || p.miqdor === 0
                          ? "text-faint"
                          : kutilayotganFoyda >= 0
                            ? "text-income"
                            : "text-expense"
                      }`}
                    >
                      {p.miqdor > 0 && p.sotuvNarx > 0 ? formatSomLabel(kutilayotganFoyda) : "—"}
                    </td>
                  )}
                  {avto ? (
                    <td className="py-2.5 text-right">
                      <Badge tone={p.miqdor > 0 ? "kirim" : "neutral"}>
                        {p.miqdor > 0 ? "Sotuvda" : "Sotildi"}
                      </Badge>
                    </td>
                  ) : (
                    <td className={`py-2.5 text-right font-medium ${p.miqdor > 0 ? "text-fg" : "text-expense"}`}>
                      {p.miqdor > 0 ? formatSom(p.miqdor) : "Qolmadi"}
                    </td>
                  )}
                  {!avto && (
                    <td className="py-2.5">
                      <Badge tone={p.isActive ? "kirim" : "neutral"}>{p.isActive ? "Faol" : "Nofaol"}</Badge>
                    </td>
                  )}
                  <td className="py-2.5 text-right whitespace-nowrap">
                    {(!avto || p.miqdor === 0) && (
                      <button
                        onClick={() => setStockFor(p)}
                        className="text-xs font-medium text-income hover:text-income-fg mr-3"
                      >
                        {M.kirim}
                      </button>
                    )}
                    <button
                      onClick={() => setEditing(p)}
                      className="text-xs font-medium text-muted hover:text-fg mr-3"
                    >
                      {avto ? "Tahrirlash" : "Narx"}
                    </button>
                    <button
                      onClick={() => toggleActive(p)}
                      className="text-xs font-medium text-muted hover:text-expense"
                    >
                      {p.isActive ? "Nofaol" : "Faol"}
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {newOpen &&
        (avto ? (
          <NewAvtoModal onClose={() => setNewOpen(false)} onDone={refresh} />
        ) : (
          <NewProductModal onClose={() => setNewOpen(false)} onDone={refresh} />
        ))}
      {bulkOpen && <BulkProductsModal onClose={() => setBulkOpen(false)} onDone={refresh} />}
      {editing && (
        <EditPriceModal product={editing} avto={avto} onClose={() => setEditing(null)} onDone={refresh} />
      )}
      {stockFor && (
        <StockEntryModal product={stockFor} avto={avto} onClose={() => setStockFor(null)} onDone={refresh} />
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

/**
 * AVTO REJIMI — avtoparkka mashina qabul qilish.
 * Naqd olinsa chiqim yoziladi; qarzga olinsa "men qarzdorman" qarzdorligi ochiladi.
 */
function NewAvtoModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [nomi, setNomi] = useState("");
  const [yil, setYil] = useState("");
  const [raqam, setRaqam] = useState("");
  const [rang, setRang] = useState("");
  const [olingan, setOlingan] = useState("");
  const [sotuv, setSotuv] = useState("");
  const [tolovTuri, setTolovTuri] = useState<"naqd" | "qarz">("naqd");
  const [egasiNomi, setEgasiNomi] = useState("");
  const [egasiTel, setEgasiTel] = useState("");
  const [izoh, setIzoh] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const olinganNarx = parseSomInput(olingan);
  const sotuvNarx = parseSomInput(sotuv);
  const kutilayotganFoyda = sotuvNarx > 0 ? sotuvNarx - olinganNarx : 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (olinganNarx <= 0) {
      setError("Olingan narxni kiriting");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/avto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nomi,
        olinganNarx,
        sotuvNarx,
        avtoYil: yil ? Number(yil) : null,
        avtoRaqam: raqam || null,
        avtoRang: rang || null,
        izoh: izoh || null,
        tolovTuri,
        egasiNomi: egasiNomi || null,
        egasiTel: egasiTel || null,
      }),
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
    <Modal open onClose={onClose} title="Avtoparkka mashina qabul qilish">
      <form onSubmit={submit} className="space-y-3">
        <input
          type="text"
          value={nomi}
          onChange={(e) => setNomi(e.target.value)}
          placeholder="Model (masalan: Malibu 2)"
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          autoFocus
          required
        />
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-muted mb-1">Yil</label>
            <input
              type="text"
              inputMode="numeric"
              value={yil}
              onChange={(e) => setYil(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="2018"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Davlat raqami</label>
            <input
              type="text"
              value={raqam}
              onChange={(e) => setRaqam(e.target.value.toUpperCase())}
              placeholder="01A123BC"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Rang</label>
            <input
              type="text"
              value={rang}
              onChange={(e) => setRang(e.target.value)}
              placeholder="Oq"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-muted mb-1">Olingan narx</label>
            <NarxInput value={olingan} onChange={setOlingan} placeholder="0" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Sotuv narxi (rejalashtirilgan)</label>
            <NarxInput value={sotuv} onChange={setSotuv} placeholder="0" />
          </div>
        </div>
        {sotuvNarx > 0 && olinganNarx > 0 && (
          <p className="text-xs text-muted">
            Kutilayotgan foyda:{" "}
            <span className={`font-medium ${kutilayotganFoyda >= 0 ? "text-income" : "text-expense"}`}>
              {formatSomLabel(kutilayotganFoyda)}
            </span>
          </p>
        )}

        <div>
          <label className="block text-xs text-muted mb-1">Qanday olindi?</label>
          <div className="grid grid-cols-2 gap-2">
            {(["naqd", "qarz"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTolovTuri(t)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  tolovTuri === t ? "border-brand text-brand bg-brand/5" : "border-line text-muted"
                }`}
              >
                {t === "naqd" ? "Naqd to'landi" : "Qarzga olindi"}
              </button>
            ))}
          </div>
          <p className="text-xs text-faint mt-1">
            {tolovTuri === "naqd"
              ? "Chiqim yozuvi avtomatik yaratiladi (\"Mashina xaridi\")."
              : "Egasiga qarzdorlik ochiladi — to'laganingizda chiqim yoziladi."}
          </p>
        </div>

        {tolovTuri === "qarz" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-muted mb-1">Kimdan olindi</label>
              <input
                type="text"
                value={egasiNomi}
                onChange={(e) => setEgasiNomi(e.target.value)}
                placeholder="Ism familiya"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Telefon</label>
              <input
                type="text"
                value={egasiTel}
                onChange={(e) => setEgasiTel(e.target.value)}
                placeholder="+998 ..."
                className="w-full rounded-lg border border-line px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs text-muted mb-1">Izoh (ixtiyoriy)</label>
          <input
            type="text"
            value={izoh}
            onChange={(e) => setIzoh(e.target.value)}
            placeholder="Holati, probeg, kelishuv sharti..."
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-expense text-sm">{error}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "..." : "Qabul qilish"}
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
  avto = false,
  onClose,
  onDone,
}: {
  product: ProductAdminDTO;
  avto?: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [nomi, setNomi] = useState(product.nomi);
  const [kelgan, setKelgan] = useState(formatSom(product.kelganNarx));
  const [sotuv, setSotuv] = useState(formatSom(product.sotuvNarx));
  const [yil, setYil] = useState(product.avtoYil ? String(product.avtoYil) : "");
  const [raqam, setRaqam] = useState(product.avtoRaqam ?? "");
  const [rang, setRang] = useState(product.avtoRang ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nomi,
        kelganNarx: parseSomInput(kelgan),
        sotuvNarx: parseSomInput(sotuv),
        ...(avto
          ? {
              avtoYil: yil ? Number(yil) : null,
              avtoRaqam: raqam || null,
              avtoRang: rang || null,
            }
          : {}),
      }),
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
    <Modal open onClose={onClose} title={avto ? "Mashina ma'lumotlari" : "Narx tahrirlash"}>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="text"
          value={nomi}
          onChange={(e) => setNomi(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          required
        />
        {avto && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-muted mb-1">Yil</label>
              <input
                type="text"
                inputMode="numeric"
                value={yil}
                onChange={(e) => setYil(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Davlat raqami</label>
              <input
                type="text"
                value={raqam}
                onChange={(e) => setRaqam(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Rang</label>
              <input
                type="text"
                value={rang}
                onChange={(e) => setRang(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}
        <div>
          <label className="block text-xs text-muted mb-1">{avto ? "Olingan narx" : "Kelgan narx (tannarx)"}</label>
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
  avto = false,
  onClose,
  onDone,
}: {
  product: ProductAdminDTO;
  avto?: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  // Avto rejimida bitta yozuv = bitta mashina — miqdor har doim 1.
  const [miqdor, setMiqdor] = useState(avto ? "1" : "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const m = avto ? 1 : parseSomInput(miqdor);
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
    <Modal
      open
      onClose={onClose}
      title={avto ? `Avtoparkka qaytarish: ${product.nomi}` : `Ombor kirimi: ${product.nomi}`}
    >
      <form onSubmit={submit} className="space-y-3">
        {avto ? (
          <p className="text-sm text-muted">
            Mashina avtoparkka qaytariladi (masalan, sotuv bekor qilindi). Sotuv yozuvi va foyda hisobi
            o'zgarmaydi — kerak bo'lsa yozuvni qo'lda to'g'rilang.
          </p>
        ) : (
          <>
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
          </>
        )}
        {error && <p className="text-expense text-sm">{error}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "..." : avto ? "Qaytarish" : "Kiritish"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
