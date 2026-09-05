"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import { formatSom, formatSomLabel } from "@/lib/format";
import { QadamMahsulotlar, jamiSumma, type TaminotSatr } from "./QadamMahsulotlar";
import { QadamTolov, kassaTanlashKerak } from "./QadamTolov";
import { YangiMahsulot } from "./YangiMahsulot";
import type { AccountDTO } from "@/lib/queries/accounts";
import type { OmborKategoriyaDTO, TaminotDTO } from "@/lib/queries/ombor";
import type { SupplierDTO } from "@/lib/queries/xarid";
import type { TaminotTolovUsuli } from "@/lib/validation/taminot";

/** Ta'minot tafsilotidan tahrirlash formasining boshlang'ich holati. */
function satrlarDan(t: TaminotDTO): TaminotSatr[] {
  return t.satrlar.map((s) => ({
    productId: s.productId,
    nomi: s.nomi,
    birlik: s.birlik,
    miqdor: String(s.miqdor),
    birlikNarx: formatSom(s.birlikNarx),
  }));
}

/**
 * TA'MINOTNI TAHRIRLASH (DIREKTOR).
 *
 * Forma yaratish oqimi bilan AYNI komponentlardan qurilgan
 * (`QadamMahsulotlar`, `QadamTolov`) — ikkinchi ko'rinish yaratilmadi,
 * shu bois miqdor/narx qoidalari ikki joyda ayrilib ketmaydi. Farqi
 * qadamlar yo'q: direktor nimani to'g'rilashni allaqachon biladi, uni
 * to'rt ekrandan o'tkazish ortiqcha.
 *
 * Hisob oqibatlari SERVERDA hisoblanadi (`taminotTahrir`): ombor farqi,
 * eski chiqim/qarzning qaytarilishi va yangisining yozilishi. Bu yerda
 * faqat forma va ogohlantirish bor.
 */
export function TaminotTahrir({
  taminot,
  onClose,
  onDone,
}: {
  taminot: TaminotDTO;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [taminotchilar, setTaminotchilar] = useState<SupplierDTO[]>([]);
  const [kassalar, setKassalar] = useState<AccountDTO[]>([]);
  const [kategoriyalar, setKategoriyalar] = useState<OmborKategoriyaDTO[]>([]);
  const [supplierId, setSupplierId] = useState(taminot.supplierId);
  const [usul, setUsul] = useState<TaminotTolovUsuli>(
    taminot.tolovTuri === "qarz" ? "qarz" : "naqd"
  );
  const [accountId, setAccountId] = useState<string | null>(null);
  const [satrlar, setSatrlar] = useState<TaminotSatr[]>(satrlarDan(taminot));
  const [sana, setSana] = useState((taminot.qabulSana ?? taminot.sana).slice(0, 10));
  const [izoh, setIzoh] = useState(taminot.izoh ?? "");
  const [yangiMahsulotNomi, setYangiMahsulotNomi] = useState<string | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);

  // Ro'yxatlar shu yerda yuklanadi: tahrirlash oynasi Ombor sahifasidan ham,
  // ta'minotchi profilidan ham ochiladi — ikkalasiga proplarni tarqatgandan
  // ko'ra bir marta so'rash sodda va ikkala chaqiruvchi ham bir xil ishlaydi.
  useEffect(() => {
    let bekor = false;
    void (async () => {
      const [s, k, kat] = await Promise.all([
        fetch("/api/ombor/taminotchilar?faol=0").then((r) => r.json()).catch(() => []),
        fetch("/api/accounts").then((r) => r.json()).catch(() => []),
        fetch("/api/ombor/kategoriyalar").then((r) => r.json()).catch(() => []),
      ]);
      if (bekor) return;
      setTaminotchilar(Array.isArray(s) ? s : []);
      setKassalar(Array.isArray(k) ? k : []);
      setKategoriyalar(Array.isArray(kat) ? kat : kat?.kategoriyalar ?? []);
    })();
    return () => {
      bekor = true;
    };
  }, []);

  const kassaTayyor = !kassaTanlashKerak(usul, kassalar) || Boolean(accountId);
  const satrlarTayyor =
    satrlar.length > 0 && satrlar.every((s) => Number(s.miqdor) > 0) && jamiSumma(satrlar) > 0;
  const yaroqli = satrlarTayyor && kassaTayyor && Boolean(supplierId);

  async function saqla() {
    if (!yaroqli || saqlanmoqda) return;
    setXato(null);
    setSaqlanmoqda(true);
    try {
      const res = await fetch(`/api/ombor/taminot/${taminot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          tolovUsuli: usul,
          accountId,
          sana,
          izoh: izoh.trim() || null,
          satrlar: satrlar.map((s) => ({
            productId: s.productId,
            miqdor: Number(s.miqdor.replace(/[^0-9]/g, "")),
            birlikNarx: Number(s.birlikNarx.replace(/[^0-9]/g, "")),
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setXato(data.error ?? "Tahrirlab bo'lmadi");
        return;
      }
      toast({ message: "Ta'minot to'g'rilandi — ombor va kassa yangilandi", tone: "success" });
      onDone();
    } catch {
      setXato("Tarmoq xatosi — qayta urinib ko'ring");
    } finally {
      setSaqlanmoqda(false);
    }
  }

  const eskiJami = taminot.jamiSumma;
  const yangiJami = jamiSumma(satrlar);

  return (
    <Modal open onClose={onClose} title="Ta'minotni to'g'rilash" size="lg">
      <div className="space-y-4">
        <p className="text-xs text-muted bg-surface-2 rounded-lg px-3 py-2">
          O&apos;zgarish saqlanganda ombor qoldig&apos;i farq bo&apos;yicha to&apos;g&apos;rilanadi,
          eski chiqim yoki qarz esa qaytarilib yangisi yoziladi. Har to&apos;g&apos;rilash tarixda
          qoladi.
        </p>

        <div>
          <label className={LABEL_CLASS} htmlFor="tt-supplier">
            Ta&apos;minotchi
          </label>
          <Select
            id="tt-supplier"
            value={supplierId}
            onChange={setSupplierId}
            searchable={taminotchilar.length > 7}
            options={
              taminotchilar.length
                ? taminotchilar.map((s) => ({ value: s.id, label: s.nomi }))
                : [{ value: taminot.supplierId, label: taminot.supplierNomi }]
            }
          />
        </div>

        <QadamMahsulotlar
          satrlar={satrlar}
          onChange={setSatrlar}
          onYangiMahsulot={(nomi) => setYangiMahsulotNomi(nomi)}
        />

        <QadamTolov
          usul={usul}
          onUsul={setUsul}
          accountId={accountId}
          onAccount={setAccountId}
          kassalar={kassalar}
        />

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="tt-sana">
              Sana
            </label>
            <input
              id="tt-sana"
              type="date"
              value={sana}
              onChange={(e) => setSana(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="tt-izoh">
              Izoh
            </label>
            <input
              id="tt-izoh"
              value={izoh}
              onChange={(e) => setIzoh(e.target.value)}
              maxLength={500}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {yangiJami !== eskiJami && (
          <p className="text-sm text-fg bg-brand-wash rounded-lg px-3 py-2">
            Jami summa {formatSomLabel(eskiJami)} &rarr;{" "}
            <span className="font-semibold">{formatSomLabel(yangiJami)}</span>
          </p>
        )}

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Bekor
          </Button>
          <Button
            size="lg"
            disabled={!yaroqli}
            loading={saqlanmoqda}
            onClick={() => void saqla()}
            className="flex-[2]"
          >
            O&apos;zgarishni saqlash
          </Button>
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
                birlikNarx: m.kelganNarx > 0 ? formatSom(m.kelganNarx) : "",
              },
            ]);
          }}
        />
      )}
    </Modal>
  );
}
