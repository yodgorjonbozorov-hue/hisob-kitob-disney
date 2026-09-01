"use client";

import { useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { formatSom, formatSomLabel, formatDateUz, parseSomInput } from "@/lib/format";
import { todayDateOnlyString } from "@/lib/date";
import { telKorinish } from "@/lib/validation/qarz";
import {
  QARZ_TOLOV_USULLARI,
  QARZ_TOLOV_NOMI,
  QARZ_TOLOV_BELGI,
  type QarzTolovUsuli,
} from "@/lib/validation/qarz";
import type { QarzdorOchiqQarz } from "@/lib/queries/qarz";
import type { KassaOption } from "./QarzTolovForm";

/**
 * Bir martalik kalit — takror to'lovdan himoyaning KLIENT tarafi (23-talab).
 *
 * Kalit forma OCHILGANDA bir marta yaratiladi va yuborishda o'zgarmaydi:
 * tugma ikki marta bosilsa server ikkala so'rovda AYNI kalitni ko'radi va
 * ikkinchisiga mavjud to'lovni qaytaradi. Server tarafda esa
 * `@@unique([debtId, idempotencyKey])` poygani bazada hal qiladi.
 */
function yangiKalit(): string {
  const c = globalThis.crypto;
  if (c && "randomUUID" in c) return c.randomUUID();
  return `k-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

/** Eng eski qarzdan boshlab taqsimlashning BRAUZERDAGI oynasi. */
function oldindanTaqsimla(
  qarzlar: QarzdorOchiqQarz[],
  summa: number
): { qarz: QarzdorOchiqQarz; ulush: number }[] {
  const natija: { qarz: QarzdorOchiqQarz; ulush: number }[] = [];
  let qoldi = summa;
  for (const q of qarzlar) {
    if (qoldi <= 0) break;
    const ulush = Math.min(qoldi, q.qolgan);
    natija.push({ qarz: q, ulush });
    qoldi -= ulush;
  }
  return natija;
}

/**
 * MIJOZ BO'YICHA TO'LOV — modulning eng ko'p bosiladigan amali (6-talab).
 *
 * Nima ko'rsatiladi: kim, qancha qarzi bor, qancha to'laydi va SHUNDAN
 * KEYIN qancha qoladi. Oxirgi raqam ataylab kattaligicha turadi — kassir
 * mijozga aynan uni aytadi.
 *
 * TAQSIMOT KO'RINADI: pul qaysi qarzlarga ketishini foydalanuvchi
 * TASDIQLASHDAN OLDIN ko'radi. Avtomatik qoida (eng eskisidan) jimgina
 * ishlab ketmaydi — buxgalteriya qarori yashirin bo'lmasligi kerak.
 *
 * MOBIL: `Modal` telefonda pastdan chiqadigan varaq (bottom sheet), summa
 * maydonida `inputMode="numeric"` — raqamli klaviatura ochiladi (21-talab).
 */
export function QarzdorTolovSheet({
  ism,
  tel,
  turi,
  kalit,
  jamiQarz,
  ochiqQarzlar,
  kassalar,
  onClose,
  onDone,
}: {
  ism: string;
  tel: string | null;
  turi: string;
  kalit: string;
  jamiQarz: number;
  ochiqQarzlar: QarzdorOchiqQarz[];
  kassalar: KassaOption[];
  onClose: () => void;
  onDone: (xabar: string) => void;
}) {
  const beriladigan = turi === "beriladigan";
  // Summa ATAYLAB bo'sh boshlanadi: operator mijoz real bergan pulni o'zi
  // yozadi. Jami qarzni oldindan yozib qo'yish qisman to'lovda xato
  // tasdiqlashga olib kelardi.
  const [summa, setSumma] = useState("");
  const [tolovTuri, setTolovTuri] = useState<QarzTolovUsuli>("naqd");
  const [accountId, setAccountId] = useState("");
  const [sana, setSana] = useState(todayDateOnlyString());
  const [izoh, setIzoh] = useState("");
  const [qolda, setQolda] = useState<string>("");
  const [xato, setXato] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const idempotencyKey = useRef(yangiKalit());

  const s = parseSomInput(summa);
  const tanlangan = ochiqQarzlar.find((q) => q.id === qolda) ?? null;
  const chegara = tanlangan ? tanlangan.qolgan : jamiQarz;

  const taqsimot = useMemo(() => {
    if (s <= 0 || s > chegara) return [];
    return tanlangan
      ? [{ qarz: tanlangan, ulush: s }]
      : oldindanTaqsimla(ochiqQarzlar, s);
  }, [s, chegara, tanlangan, ochiqQarzlar]);

  const qoladi = chegara - (s > 0 && s <= chegara ? s : 0);

  async function yubor() {
    if (loading) return;
    setXato(null);
    if (s <= 0) {
      setXato("To'lov summasini kiriting");
      return;
    }
    if (s > chegara) {
      setXato(
        `To'lov ${formatSomLabel(chegara)} dan ko'p bo'lmasligi kerak — ortiqcha to'lov qabul qilinmaydi`
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/debts/qarzdor/tolov", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turi,
          kalit,
          summa: s,
          sana,
          tolovTuri,
          accountId: accountId || undefined,
          izoh: izoh.trim() || undefined,
          idempotencyKey: idempotencyKey.current,
          taqsimot: tanlangan ? [{ debtId: tanlangan.id, summa: s }] : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik");
        return;
      }
      onDone(
        data.yangiTolov === false
          ? "To'lov allaqachon qabul qilingan edi"
          : `${formatSomLabel(data.summa)} qabul qilindi · qoldi ${formatSomLabel(data.qolgan)}`
      );
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={beriladigan ? "To'lov qilish" : "To'lov qabul qilish"}>
      <div className="space-y-4">
        <div className="rounded-xl bg-surface-2 px-4 py-3">
          <p className="font-semibold text-fg truncate">{ism}</p>
          {tel && <p className="text-2xs text-muted truncate">{telKorinish(tel)}</p>}
          <p className="text-2xs text-muted mt-2">
            {beriladigan ? "Jami majburiyat" : "Jami qarz"}
          </p>
          <p className="text-2xl font-bold tnum text-debt break-words">
            {formatSomLabel(jamiQarz)}
          </p>
          <p className="text-2xs text-faint mt-0.5">{ochiqQarzlar.length} ta ochiq qarz</p>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1" htmlFor="qarzdor-tolov-summa">
            To&apos;lov summasi (so&apos;m)
          </label>
          <input
            id="qarzdor-tolov-summa"
            type="text"
            inputMode="numeric"
            value={summa}
            onChange={(e) => {
              const n = parseSomInput(e.target.value);
              setSumma(n ? formatSom(n) : "");
            }}
            placeholder="To'lov summasini kiriting"
            className="w-full min-h-[48px] rounded-lg border border-line px-3 py-2 text-lg font-semibold tnum"
            autoFocus
          />
        </div>

        <div>
          <span className="block text-xs text-muted mb-1">To&apos;lov turi</span>
          <div className="grid grid-cols-3 gap-2">
            {QARZ_TOLOV_USULLARI.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTolovTuri(t)}
                aria-pressed={tolovTuri === t}
                className={`min-h-[44px] px-2 py-2 rounded-lg border text-sm transition ${
                  tolovTuri === t
                    ? "border-brand bg-brand-wash text-brand font-medium"
                    : "border-line bg-surface-2 text-fg hover:border-brand"
                }`}
              >
                <span aria-hidden>{QARZ_TOLOV_BELGI[t]}</span> {QARZ_TOLOV_NOMI[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {kassalar.length > 1 && (
            <div>
              <label className="block text-xs text-muted mb-1" htmlFor="qarzdor-tolov-kassa">
                Kassa
              </label>
              <Select
                id="qarzdor-tolov-kassa"
                value={accountId}
                onChange={setAccountId}
                searchable={kassalar.length > 7}
                options={[
                  { value: "", label: "To'lov turiga mos kassa" },
                  ...kassalar.map((k) => ({ value: k.id, label: k.nomi })),
                ]}
              />
            </div>
          )}
          <div>
            <label className="block text-xs text-muted mb-1" htmlFor="qarzdor-tolov-sana">
              To&apos;lov sanasi
            </label>
            <input
              id="qarzdor-tolov-sana"
              type="date"
              value={sana}
              onChange={(e) => setSana(e.target.value)}
              className="w-full min-h-[44px] rounded-lg border border-line px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* TAQSIMOT: standart qoida eng eski qarzdan, lekin xodim aniq bitta
            qarzni tanlab ham yozishi mumkin (8-talab). */}
        {ochiqQarzlar.length > 1 && (
          <div>
            <label className="block text-xs text-muted mb-1" htmlFor="qarzdor-tolov-qaysi">
              Qaysi qarzga yoziladi
            </label>
            <Select
              id="qarzdor-tolov-qaysi"
              value={qolda}
              // Summa avtomatik to'ldirilmaydi — operator yozgan qiymat
              // saqlanadi; chegaradan oshsa yuborishda xato ko'rsatiladi.
              onChange={setQolda}
              searchable={ochiqQarzlar.length > 7}
              options={[
                { value: "", label: "Eng eski qarzdan boshlab (avtomatik)" },
                ...ochiqQarzlar.map((q) => ({
                  value: q.id,
                  label: formatDateUz(new Date(q.sana)),
                  tavsif: `qolgan ${formatSom(q.qolgan)}${q.izoh ? ` · ${q.izoh}` : ""}`,
                })),
              ]}
            />
          </div>
        )}

        {taqsimot.length > 0 && (
          <div className="rounded-lg border border-line overflow-hidden">
            <p className="px-3 py-2 text-2xs font-medium text-muted bg-surface-2">
              Pul qaysi qarzlarga tushadi
            </p>
            <ul className="divide-y divide-line">
              {taqsimot.map(({ qarz, ulush }) => (
                <li key={qarz.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-xs text-muted min-w-0 truncate">
                    {formatDateUz(new Date(qarz.sana))}
                    {qarz.izoh ? ` · ${qarz.izoh}` : ""}
                  </span>
                  <span className="text-xs tnum whitespace-nowrap">
                    <span className="text-income font-medium">{formatSom(ulush)}</span>
                    <span className="text-faint">
                      {" "}
                      · {qarz.qolgan - ulush === 0 ? "yopiladi" : `${formatSom(qarz.qolgan - ulush)} qoladi`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <label className="block text-xs text-muted mb-1" htmlFor="qarzdor-tolov-izoh">
            Izoh (ixtiyoriy)
          </label>
          <input
            id="qarzdor-tolov-izoh"
            type="text"
            value={izoh}
            onChange={(e) => setIzoh(e.target.value)}
            className="w-full min-h-[44px] rounded-lg border border-line px-3 py-2 text-sm"
          />
        </div>

        <div className="rounded-xl bg-surface-2 px-4 py-3 flex items-baseline justify-between gap-3">
          <span className="text-xs text-muted">Shundan keyin qoladi</span>
          <span className="text-xl font-bold tnum text-debt break-words">
            {formatSomLabel(qoladi)}
          </span>
        </div>

        <p className="text-2xs text-faint">
          {beriladigan
            ? "Chiqim yozuvi TO'LOV SANASI bilan yaratiladi."
            : "Kirim yozuvi TO'LOV SANASI bilan, qarz kategoriyasiga yoziladi — qarz berilgan kun hisobotiga tushmaydi."}
        </p>

        {xato && (
          <p className="text-expense text-sm" role="alert">
            {xato}
          </p>
        )}

        {/* Telefonda tasdiqlash tugmasi doim ko'rinib turadi (21-talab). */}
        <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-[env(safe-area-inset-bottom)] bg-surface border-t border-line flex gap-2 justify-end sm:static sm:mx-0 sm:px-0 sm:border-0 sm:bg-transparent sm:pb-0">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Bekor qilish
          </Button>
          <Button
            onClick={yubor}
            loading={loading}
            disabled={loading || s <= 0}
            className="min-h-[44px]"
          >
            Tasdiqlash
          </Button>
        </div>
      </div>
    </Modal>
  );
}
