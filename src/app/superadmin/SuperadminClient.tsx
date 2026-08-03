"use client";

import { Fragment, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PLANLAR } from "@/lib/billing/plans";
import { BIZNES_TURLARI } from "@/lib/biznesTuri";

interface Metrics {
  jamiTenant: number;
  faolObuna: number;
  sinovda: number;
  bloklangan: number;
  mrr: number;
}
interface TenantRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  createdAt: string;
  deadline: string | null;
  accessMode: string;
  userCount: number;
  businessCount: number;
  lastActivity: string | null;
  pendingPayments: number;
}
interface PaymentRow {
  id: string;
  tenantId: string;
  tenantName: string;
  amount: number;
  createdAt: string;
}
interface UserRow {
  id: string;
  ism: string;
  login: string;
  rol: string;
  isActive: boolean;
  tenantId: string;
}

const STATUS_CLS: Record<string, string> = {
  TRIAL: "bg-brand-wash text-brand",
  ACTIVE: "bg-income-soft text-income-fg",
  PAST_DUE: "bg-expense-soft text-expense-fg",
  BLOCKED: "bg-expense text-white",
};

function sana(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU");
}

export function SuperadminClient({
  superadminIsm,
  metrics,
  tenants,
  pendingPayments,
  users,
}: {
  superadminIsm: string;
  metrics: Metrics;
  tenants: TenantRow[];
  pendingPayments: PaymentRow[];
  users: UserRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [openUsers, setOpenUsers] = useState<string | null>(null);
  const [xabar, setXabar] = useState<string | null>(null);

  async function call(url: string, body?: unknown): Promise<Record<string, unknown> | null> {
    setBusy(url);
    setXabar(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        setXabar(`Xato: ${data.error ?? res.status}`);
        return null;
      }
      router.refresh();
      return data;
    } catch {
      setXabar("Serverga ulanib bo'lmadi");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function uzaytirish(t: TenantRow) {
    const kunlar = parseInt(prompt(`${t.name} muddatini necha kunga uzaytiramiz?`, "30") ?? "", 10);
    if (!kunlar || kunlar < 1) return;
    const r = await call(`/api/superadmin/tenants/${t.id}/extend`, { kunlar });
    if (r) setXabar(`${t.name}: muddat ${kunlar} kunga uzaytirildi.`);
  }

  async function tarif(t: TenantRow) {
    const plan = prompt(`${t.name} tarifi (${PLANLAR.map((p) => p.code).join(" / ")}):`, t.plan)?.trim().toUpperCase();
    if (!plan || plan === t.plan) return;
    const r = await call(`/api/superadmin/tenants/${t.id}/plan`, { plan });
    if (r) setXabar(`${t.name}: tarif ${plan} ga o'zgartirildi.`);
  }

  async function blok(t: TenantRow) {
    const blocked = t.status !== "BLOCKED";
    if (blocked && !confirm(`${t.name} bloklansinmi? Mijoz faqat /billing sahifasini ochadi.`)) return;
    const r = await call(`/api/superadmin/tenants/${t.id}/block`, { blocked });
    if (r) setXabar(`${t.name}: ${blocked ? "bloklandi" : `blokdan chiqarildi (${r.status})`}.`);
  }

  async function kirish(t: TenantRow) {
    if (!confirm(`${t.name} nomidan kirasizmi? Bu amal audit jurnaliga yoziladi.`)) return;
    const r = await call(`/api/superadmin/tenants/${t.id}/impersonate`);
    if (r) {
      router.push("/app");
      router.refresh();
    }
  }

  async function parolTiklash(u: UserRow) {
    if (!confirm(`${u.ism} (${u.login}) paroli tiklansinmi?`)) return;
    const r = await call(`/api/superadmin/users/${u.id}/reset-password`);
    if (r) {
      // Yangi parol faqat bir marta ko'rsatiladi.
      alert(`Yangi parol (bir marta ko'rsatiladi!):\n\nLogin: ${r.login}\nParol: ${r.yangiParol}\n\nMijozga yetkazing — birinchi kirishda almashtirishi so'raladi.`);
      setXabar(`${u.login} paroli tiklandi.`);
    }
  }

  async function tolovTasdiq(p: PaymentRow) {
    if (!confirm(`${p.tenantName}: ${p.amount.toLocaleString("ru-RU")} so'm to'lov TASDIQLANSINMI? Obuna 30 kunga uzayadi.`)) return;
    const r = await call(`/api/superadmin/payments/${p.id}/confirm`);
    if (r) setXabar(`To'lov tasdiqlandi — ${p.tenantName} obunasi uzaytirildi.`);
  }

  async function tolovRad(p: PaymentRow) {
    const izoh = prompt("Rad etish sababi (ixtiyoriy):") ?? undefined;
    const r = await call(`/api/superadmin/payments/${p.id}/reject`, { izoh });
    if (r) setXabar("To'lov rad etildi.");
  }

  async function chiqish() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const btn = "px-2.5 py-1.5 rounded-lg text-xs font-medium border border-line hover:bg-surface-2 transition disabled:opacity-50";

  return (
    <div className="min-h-screen bg-app p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-fg">SUPERADMIN panel</h1>
            <p className="text-sm text-muted">{superadminIsm} · platforma boshqaruvi</p>
          </div>
          <button onClick={chiqish} className={btn}>
            Chiqish
          </button>
        </div>

        {xabar && (
          <div className="rounded-xl border border-line bg-brand-wash text-fg px-4 py-3 text-sm">{xabar}</div>
        )}

        {/* Metrikalar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Jami tenant", value: metrics.jamiTenant },
            { label: "Faol obuna", value: metrics.faolObuna },
            { label: "Sinovda", value: metrics.sinovda },
            { label: "Bloklangan", value: metrics.bloklangan },
            { label: "MRR (so'm/oy)", value: metrics.mrr.toLocaleString("ru-RU") },
          ].map((m) => (
            <div key={m.label} className="bg-surface rounded-xl border border-line p-4">
              <p className="text-xs text-muted">{m.label}</p>
              <p className="text-xl font-bold text-fg tnum mt-1">{m.value}</p>
            </div>
          ))}
        </div>

        {/* Kutilayotgan to'lovlar */}
        <div className="bg-surface rounded-2xl border border-line shadow-card p-5">
          <h2 className="font-semibold text-fg mb-3">Kutilayotgan to'lovlar ({pendingPayments.length})</h2>
          {pendingPayments.length === 0 ? (
            <p className="text-sm text-faint">Tasdiq kutayotgan to'lov yo'q.</p>
          ) : (
            <div className="divide-y divide-line">
              {pendingPayments.map((p) => (
                <div key={p.id} className="py-2.5 flex items-center gap-3 flex-wrap text-sm">
                  <span className="font-medium text-fg">{p.tenantName}</span>
                  <span className="tnum text-fg">{p.amount.toLocaleString("ru-RU")} so'm</span>
                  <span className="text-xs text-faint">{sana(p.createdAt)} · № {p.id}</span>
                  <span className="flex-1" />
                  <button className={`${btn} text-income-fg`} disabled={!!busy} onClick={() => tolovTasdiq(p)}>
                    ✓ Tasdiqlash
                  </button>
                  <button className={`${btn} text-expense-fg`} disabled={!!busy} onClick={() => tolovRad(p)}>
                    ✗ Rad etish
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Yangi mijoz */}
        <YangiMijozForm btn={btn} onCreated={(x) => setXabar(x)} />

        {/* Tenantlar */}
        <div className="bg-surface rounded-2xl border border-line shadow-card p-5 overflow-x-auto">
          <h2 className="font-semibold text-fg mb-3">Tenantlar ({tenants.length})</h2>
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-faint text-xs uppercase">
                <th className="pb-2">Kompaniya</th>
                <th className="pb-2">Holat</th>
                <th className="pb-2">Ro'yxatdan</th>
                <th className="pb-2">Muddat</th>
                <th className="pb-2">Userlar</th>
                <th className="pb-2">Oxirgi kirish</th>
                <th className="pb-2 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {tenants.map((t) => (
                <Fragment key={t.id}>
                  <tr>
                    <td className="py-2.5">
                      <p className="font-medium text-fg">{t.name}</p>
                      <p className="text-xs text-faint">
                        {t.slug} · {t.businessCount} biznes
                        {t.pendingPayments > 0 && (
                          <span className="text-expense-fg"> · {t.pendingPayments} to'lov kutilmoqda</span>
                        )}
                      </p>
                    </td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLS[t.status] ?? "bg-surface-2"}`}>
                        {t.status}
                      </span>
                      {t.accessMode !== "FULL" && (
                        <p className="text-2xs text-expense-fg mt-0.5">{t.accessMode}</p>
                      )}
                    </td>
                    <td className="py-2.5 text-muted">{sana(t.createdAt)}</td>
                    <td className="py-2.5 text-muted">{sana(t.deadline)}</td>
                    <td className="py-2.5">
                      <button
                        className="text-brand hover:underline"
                        onClick={() => setOpenUsers(openUsers === t.id ? null : t.id)}
                      >
                        {t.userCount} ta {openUsers === t.id ? "▴" : "▾"}
                      </button>
                    </td>
                    <td className="py-2.5 text-muted">{sana(t.lastActivity)}</td>
                    <td className="py-2.5">
                      <div className="flex gap-1.5 justify-end flex-wrap">
                        <button className={btn} disabled={!!busy} onClick={() => uzaytirish(t)}>
                          + Muddat
                        </button>
                        <button className={btn} disabled={!!busy} onClick={() => tarif(t)}>
                          {t.plan}
                        </button>
                        <button className={`${btn} ${t.status === "BLOCKED" ? "text-income-fg" : "text-expense-fg"}`} disabled={!!busy} onClick={() => blok(t)}>
                          {t.status === "BLOCKED" ? "Blokdan chiqarish" : "Bloklash"}
                        </button>
                        <button className={btn} disabled={!!busy} onClick={() => kirish(t)}>
                          Kirish →
                        </button>
                      </div>
                    </td>
                  </tr>
                  {openUsers === t.id && (
                    <tr>
                      <td colSpan={7} className="py-2 pl-4 bg-surface-2/50">
                        <div className="space-y-1.5">
                          {users
                            .filter((u) => u.tenantId === t.id)
                            .map((u) => (
                              <div key={u.id} className="flex items-center gap-3 text-xs flex-wrap">
                                <span className="font-medium text-fg">{u.ism}</span>
                                <span className="text-muted">{u.login}</span>
                                <span className="text-faint">{u.rol}</span>
                                {!u.isActive && <span className="text-expense-fg">nofaol</span>}
                                <button className={btn} disabled={!!busy} onClick={() => parolTiklash(u)}>
                                  Parol tiklash
                                </button>
                              </div>
                            ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * Yangi mijoz (tenant) yaratish formasi — kompaniya + OWNER + biznes +
 * kategoriyalar + obuna bitta amalda (POST /api/superadmin/tenants).
 */
function YangiMijozForm({ btn, onCreated }: { btn: string; onCreated: (xabar: string) => void }) {
  const router = useRouter();
  const [ochiq, setOchiq] = useState(false);
  const [nom, setNom] = useState("");
  const [login, setLogin] = useState("");
  const [parol, setParol] = useState("");
  const [tarif, setTarif] = useState(PLANLAR[0].code);
  const [turi, setTuri] = useState<"umumiy" | "avto">("umumiy");
  const [kunlar, setKunlar] = useState("30");
  const [xato, setXato] = useState<string | null>(null);
  const [natija, setNatija] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setXato(null);
    setLoading(true);
    try {
      const res = await fetch("/api/superadmin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom, login, parol, tarif, turi, kunlar: Number(kunlar) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik");
        return;
      }
      // Parol faqat shu yerda ko'rsatiladi — bazada hash saqlanadi.
      setNatija(`${data.nom} — login: ${data.login} · parol: ${parol} · tarif: ${data.tarif}`);
      onCreated(`Yangi mijoz yaratildi: ${data.nom} (${data.login}).`);
      setNom("");
      setLogin("");
      setParol("");
      router.refresh();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-surface rounded-2xl border border-line shadow-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-fg">Yangi mijoz</h2>
        <button className={btn} onClick={() => setOchiq(!ochiq)}>
          {ochiq ? "Yopish" : "+ Mijoz qo'shish"}
        </button>
      </div>

      {natija && (
        <p className="mt-3 text-sm rounded-lg border border-line bg-income-soft/40 px-3 py-2">
          ✅ {natija}
          <span className="block text-xs text-muted mt-1">
            Parol faqat shu yerda ko'rinadi — mijozga yetkazing.
          </span>
        </p>
      )}

      {ochiq && (
        <form onSubmit={submit} className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-muted mb-1">Kompaniya nomi</label>
            <input value={nom} onChange={(e) => setNom(e.target.value)} className={inp} required />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Login (telefon yoki nom)</label>
            <input value={login} onChange={(e) => setLogin(e.target.value)} className={inp} required />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Parol (kamida 8 belgi)</label>
            <input value={parol} onChange={(e) => setParol(e.target.value)} className={inp} required />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Tarif</label>
            <select value={tarif} onChange={(e) => setTarif(e.target.value)} className={inp}>
              {PLANLAR.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.nomi} — {p.oylikNarx.toLocaleString("ru-RU")} so'm
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Biznes rejimi</label>
            <select
              value={turi}
              onChange={(e) => setTuri(e.target.value as "umumiy" | "avto")}
              className={inp}
            >
              {BIZNES_TURLARI.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.nomi}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Obuna (kun, 0 → 14 kun sinov)</label>
            <input
              value={kunlar}
              onChange={(e) => setKunlar(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              className={inp}
            />
          </div>
          {xato && <p className="md:col-span-3 text-sm text-expense-fg">{xato}</p>}
          <div className="md:col-span-3 flex justify-end">
            <button type="submit" className={btn} disabled={loading}>
              {loading ? "Yaratilmoqda..." : "Yaratish"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
