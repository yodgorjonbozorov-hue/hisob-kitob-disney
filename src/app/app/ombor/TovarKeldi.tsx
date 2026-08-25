"use client";

import { useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { QadamTaminotchi } from "./QadamTaminotchi";
import { QadamTolov } from "./QadamTolov";
import { QadamMahsulotlar, jamiSumma, type TaminotSatr } from "./QadamMahsulotlar";
import { QadamYakun } from "./QadamYakun";
import { YangiMahsulot } from "./YangiMahsulot";
import type { TaminotchiQisqa } from "./YangiTaminotchi";
import type { TaminotTolovUsuli } from "@/lib/validation/taminot";
import type { AccountDTO } from "@/lib/queries/accounts";
import type { OmborKategoriyaDTO } from "@/lib/queries/ombor";

const QADAM_NOMI = ["Kimdan?", "Qanday to'landi?", "Nima keldi?", "Saqlash"];

/**
 * "+ TOVAR KELDI" — Omborning eng muhim oqimi.
 *
 * To'rtta qadam, har birida BITTA savol. Ilgari bu uch qadamli xarid
 * buyurtmasi edi (qoralama yaratish → tasdiqlash → qabul qilish) va
 * foydalanuvchi 20 ta maydonli formani bir ekranda ko'rardi.
 *
 * TAKROR SAQLASHDAN HIMOYA IKKI QAVATLI:
 *   1. bu yerda — oqim ochilganda BIR MARTA yaratiladigan `idempotencyKey`
 *      (`useRef`, shu bois qayta render kalitni o'zgartirmaydi) va
 *      `saqlanmoqda` bayrog'i;
 *   2. serverda — `PurchaseOrder` dagi UNIQUE cheklov. Faqat frontend
 *      himoyasi yetarli emas: brauzer so'rovni qayta yuborsa yoki
 *      foydalanuvchi ikki qurilmadan bossa, ombor ikki marta oshardi.
 */
export function TovarKeldi({
  taminotchilar: boshlangichTaminotchilar,
  kassalar,
  kategoriyalar,
  onClose,
  onDone,
}: {
  taminotchilar: TaminotchiQisqa[];
  kassalar: AccountDTO[];
  kategoriyalar: OmborKategoriyaDTO[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [taminotchilar, setTaminotchilar] = useState(boshlangichTaminotchilar);
  const [qadam, setQadam] = useState(0);
  const [supplier, setSupplier] = useState<TaminotchiQisqa | null>(null);
  const [usul, setUsul] = useState<TaminotTolovUsuli | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [satrlar, setSatrlar] = useState<TaminotSatr[]>([]);
  const [yangiMahsulotNomi, setYangiMahsulotNomi] = useState<string | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);

  // Oqim ochilganda BIR MARTA. Qayta urinishda ham AYNI shu kalit ketadi —
  // server ikkinchi yozuvni yaratmaydi.
  const idempotencyKey = useRef(yangiKalit());

  const kassaNomi = useMemo(
    () => kassalar.find((k) => k.id === accountId)?.nomi ?? null,
    [accountId, kassalar]
  );

  /** Shu qadamdan keyingisiga o'tish mumkinmi. */
  const davomEtishMumkin =
    qadam === 0
      ? Boolean(supplier)
      : qadam === 1
        ? Boolean(usul)
        : qadam === 2
          ? satrlar.length > 0 &&
            satrlar.every((s) => Number(s.miqdor) > 0) &&
            jamiSumma(satrlar) > 0
          : true;

  async function saqla() {
    if (!supplier || !usul || saqlanmoqda) return;
    setXato(null);
    setSaqlanmoqda(true);
    try {
      const res = await fetch("/api/ombor/taminot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current,
          supplierId: supplier.id,
          tolovUsuli: usul,
          accountId,
          satrlar: satrlar.map((s) => ({
            productId: s.productId,
            miqdor: Number(s.miqdor.replace(/[^0-9]/g, "")),
            birlikNarx: Number(s.birlikNarx.replace(/[^0-9]/g, "")),
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setXato(data.error ?? "Ta'minotni saqlab bo'lmadi");
        return;
      }
      toast({
        message: data.takror
          ? "Ta'minot allaqachon saqlangan — ikki marta yozilmadi"
          : "Ta'minot saqlandi, ombor qoldig'i oshdi",
        tone: "success",
      });
      onDone();
      onClose();
    } catch {
      setXato("Tarmoq xatosi — qayta urinib ko'ring");
    } finally {
      setSaqlanmoqda(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Tovar keldi · ${QADAM_NOMI[qadam]}`} size="lg">
      <div className="space-y-4">
        <Progress qadam={qadam} />

        {qadam === 0 && (
          <QadamTaminotchi
            taminotchilar={taminotchilar}
            tanlanganId={supplier?.id ?? null}
            onTanla={(t) => {
              setSupplier(t);
              setQadam(1);
            }}
            onQoshildi={(t) => {
              setTaminotchilar((prev) => [...prev, t]);
              setSupplier(t);
              setQadam(1);
            }}
          />
        )}

        {qadam === 1 && (
          <QadamTolov
            usul={usul}
            onUsul={(u) => {
              setUsul(u);
              setQadam(2);
            }}
            accountId={accountId}
            onAccount={setAccountId}
            kassalar={kassalar}
          />
        )}

        {qadam === 2 && (
          <QadamMahsulotlar
            satrlar={satrlar}
            onChange={setSatrlar}
            onYangiMahsulot={(nomi) => setYangiMahsulotNomi(nomi)}
          />
        )}

        {qadam === 3 && supplier && usul && (
          <QadamYakun
            supplierNomi={supplier.nomi}
            usul={usul}
            satrlar={satrlar}
            kassaNomi={kassaNomi}
          />
        )}

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          <Button
            variant="secondary"
            onClick={() => (qadam === 0 ? onClose() : setQadam(qadam - 1))}
            className="flex-1"
          >
            {qadam === 0 ? "Bekor" : "Orqaga"}
          </Button>
          {qadam < 3 ? (
            <Button
              size="lg"
              disabled={!davomEtishMumkin}
              onClick={() => setQadam(qadam + 1)}
              className="flex-[2]"
            >
              Keyingi
            </Button>
          ) : (
            <Button size="lg" loading={saqlanmoqda} onClick={() => void saqla()} className="flex-[2]">
              Ta&apos;minotni saqlash
            </Button>
          )}
        </div>
      </div>

      {yangiMahsulotNomi !== null && (
        <YangiMahsulot
          kategoriyalar={kategoriyalar}
          boshlangichNomi={yangiMahsulotNomi}
          onClose={() => setYangiMahsulotNomi(null)}
          onDone={(m) => {
            setYangiMahsulotNomi(null);
            setSatrlar((prev) => [
              ...prev,
              {
                productId: m.id,
                nomi: m.nomi,
                birlik: m.birlik,
                miqdor: "",
                birlikNarx: m.kelganNarx > 0 ? String(m.kelganNarx) : "",
              },
            ]);
          }}
        />
      )}
    </Modal>
  );
}

function Progress({ qadam }: { qadam: number }) {
  return (
    <div className="flex gap-1.5" aria-label={`${qadam + 1}-qadam, jami 4`}>
      {QADAM_NOMI.map((nomi, i) => (
        <span
          key={nomi}
          className={`h-1.5 flex-1 rounded-full transition ${
            i <= qadam ? "bg-brand" : "bg-surface-2"
          }`}
        />
      ))}
    </div>
  );
}

/**
 * Idempotentlik kaliti. `crypto.randomUUID` eski brauzerlarda (va HTTPS'siz
 * kontekstda) yo'q — shu bois zaxira yo'l bor, aks holda oqim butunlay
 * ochilmay qolardi.
 */
function yangiKalit(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
