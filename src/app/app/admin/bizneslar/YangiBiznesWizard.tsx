"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { faoliyatByCode } from "@/lib/biznesFaoliyati";
import { modulQisqaNomi } from "@/lib/modules/biznesModullari";
import {
  QadamBiznes,
  QadamKassa,
  QadamModullar,
  QadamXodimlar,
  type ModulTanlov,
} from "./WizardQadamlar";

const QADAMLAR = ["Biznes", "Modullar", "Kassa", "Xodimlar", "Tayyor"];

/**
 * YANGI BIZNES — SOZLASH OQIMI (setup wizard).
 *
 * Nega qadamma-qadam: bitta formada nom, faoliyat, ombor/kassa bayroqlari va
 * kassa nomi birga so'ralganda foydalanuvchi qaysi javob nimaga ta'sir
 * qilishini ko'rmaydi. Bu yerda har qadam bitta savol beradi.
 *
 * YARIM BIZNES QOLMAYDI: biznes 3-qadamda BIR MARTA yaratiladi (server kassani
 * ham o'sha so'rovda ochadi va uddalay olmasa biznesni ortga qaytaradi), keyingi
 * qadamlar esa faqat yo'l ko'rsatadi. Takroriy yuborish `yaratilgan` holati va
 * serverdagi nom takrorlanmasligi sharti bilan to'siladi.
 */
export function YangiBiznesWizard({
  tarifModullari,
  yoqilganModullar,
  onClose,
  onCreated,
}: {
  /** Tenant tarifidagi modul kodlari (lib/billing/plans.ts). */
  tarifModullari: string[];
  /** Kompaniya bo'yicha allaqachon yoqilgan modul kodlari. */
  yoqilganModullar: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const router = useRouter();
  const [qadam, setQadam] = useState(0);
  const [nomi, setNomi] = useState("");
  const [faoliyat, setFaoliyat] = useState("xizmat");
  const [omborli, setOmborli] = useState(false);
  const [magazin, setMagazin] = useState(false);
  const [kassaNomi, setKassaNomi] = useState("Naqd kassa");
  const [yaratilgan, setYaratilgan] = useState<{ id: string; nomi: string } | null>(null);
  const [band, setBand] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const tarif = new Set(tarifModullari);
  const modullar: ModulTanlov[] = [
    {
      code: "MOLIYA",
      nomi: "Kirim / chiqim va qarzlar",
      tavsif: "Yozuvlar, kassa qoldig'i, budjet va hisobotlar. Har biznesda ishlaydi.",
      qulf: "core",
    },
    {
      code: "OMBOR",
      nomi: "Ombor va sotuv",
      tavsif: "Mahsulot qoldig'i va sotuv. Tovar sotadigan bizneslar uchun.",
      qulf: tarif.has("OMBOR") ? null : "tarif",
    },
    {
      code: "MAGAZIN",
      nomi: "Kassa (POS)",
      tavsif: "Shtrix-kod, savat va chek. Ombor ustida ishlaydi.",
      qulf: tarif.has("MAGAZIN") ? null : "tarif",
    },
  ];
  const tanlangan = new Set<string>([
    ...(omborli ? ["OMBOR"] : []),
    ...(magazin ? ["MAGAZIN"] : []),
  ]);

  /** Kompaniya bo'ylab yoqilgan, biznesga avtomatik keladigan modullar. */
  const kompaniyaModullari = yoqilganModullar
    .filter((c) => !["MOLIYA", "OMBOR", "MAGAZIN", "BOSHQARUV"].includes(c))
    .map(modulQisqaNomi);

  function faoliyatniTanla(code: string) {
    setFaoliyat(code);
    const f = faoliyatByCode(code);
    // Faoliyat — BOSHLANG'ICH taklif; keyingi qadamda foydalanuvchi o'zgartiradi.
    setOmborli(f?.omborli ?? false);
    setMagazin(f?.magazin ?? false);
  }

  function modulToggle(code: string) {
    if (code === "OMBOR") {
      const yangi = !omborli;
      setOmborli(yangi);
      if (!yangi) setMagazin(false); // kassa ombor ustida ishlaydi
      return;
    }
    if (code === "MAGAZIN") {
      const yangi = !magazin;
      setMagazin(yangi);
      if (yangi) setOmborli(true);
    }
  }

  async function yarat() {
    if (yaratilgan || band) return; // takroriy yuborish to'sig'i
    setBand(true);
    setXato(null);
    try {
      const res = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomi: nomi.trim(),
          faoliyat,
          omborli,
          magazin,
          kassaNomi: kassaNomi.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Biznes yaratilmadi");
        return;
      }
      setYaratilgan({ id: data.id, nomi: data.nomi });
      setQadam(3);
      onCreated();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setBand(false);
    }
  }

  const oldinga =
    qadam === 0
      ? { label: "Davom etish", disabled: nomi.trim().length === 0, ish: () => setQadam(1) }
      : qadam === 1
        ? { label: "Davom etish", disabled: false, ish: () => setQadam(2) }
        : qadam === 2
          ? { label: "Biznesni yaratish", disabled: false, ish: yarat }
          : qadam === 3
            ? { label: "Keyin qo'shaman", disabled: false, ish: () => setQadam(4) }
            : { label: "Biznesni ochish", disabled: false, ish: () => ochish() };

  function ochish() {
    if (!yaratilgan) return;
    router.push(`/app/admin/bizneslar/${yaratilgan.id}`);
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Yangi biznes">
      <div className="space-y-4">
        <ol className="flex items-center gap-1.5 list-none" aria-label="Sozlash qadamlari">
          {QADAMLAR.map((q, i) => (
            <li key={q} className="flex-1">
              <span
                className={`block h-1 rounded-full ${i <= qadam ? "bg-brand" : "bg-line"}`}
                aria-hidden
              />
              <span className={`block text-2xs mt-1 ${i === qadam ? "text-fg" : "text-faint"}`}>
                {q}
              </span>
            </li>
          ))}
        </ol>

        {qadam === 0 && (
          <QadamBiznes nomi={nomi} faoliyat={faoliyat} onNomi={setNomi} onFaoliyat={faoliyatniTanla} />
        )}
        {qadam === 1 && (
          <div className="space-y-3">
            <QadamModullar modullar={modullar} tanlangan={tanlangan} onToggle={modulToggle} />
            {kompaniyaModullari.length > 0 && (
              <p className="text-xs text-faint bg-surface-2 rounded-xl px-3 py-2">
                Kompaniya bo&apos;ylab yoqilgan modullar bu bizneste ham ishlaydi:{" "}
                {kompaniyaModullari.join(" · ")}.
              </p>
            )}
          </div>
        )}
        {qadam === 2 && <QadamKassa kassaNomi={kassaNomi} onKassa={setKassaNomi} />}
        {qadam === 3 && <QadamXodimlar />}
        {qadam === 4 && yaratilgan && (
          <div className="rounded-xl bg-income-soft text-income-fg p-4">
            <p className="font-medium">✓ Biznes tayyor</p>
            <p className="text-sm mt-1">
              &quot;{yaratilgan.nomi}&quot; yaratildi va boshlang&apos;ich kassasi ochildi.
            </p>
          </div>
        )}

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex flex-wrap gap-2 justify-end pt-1">
          {qadam > 0 && qadam < 3 && (
            <Button variant="secondary" onClick={() => setQadam(qadam - 1)} disabled={band}>
              Orqaga
            </Button>
          )}
          {qadam === 3 && (
            <Button variant="secondary" onClick={() => router.push("/app/admin/foydalanuvchilar")}>
              Xodim biriktirish
            </Button>
          )}
          {qadam < 3 && (
            <Button variant="secondary" onClick={onClose} disabled={band}>
              Bekor qilish
            </Button>
          )}
          <Button onClick={oldinga.ish} disabled={oldinga.disabled} loading={band}>
            {oldinga.label}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
