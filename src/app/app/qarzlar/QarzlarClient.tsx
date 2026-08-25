"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { formatSomLabel } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { isAvto, type QarzTuri } from "@/lib/biznesTuri";
import { muddatHolati, MUDDAT_TARTIBI } from "@/lib/qarzMuddat";
import { todayDateOnlyString } from "@/lib/date";
import type { MijozTanlov } from "@/components/qarz/MijozTanlash";
import type {
  QarzDTO,
  QarzDashboardDTO,
  QarzdorDTO,
  QarzdorTafsilotDTO,
  QarzdorOchiqQarz,
} from "@/lib/queries/qarz";
import { QarzKPI } from "./QarzKPI";
import { QarzJadval } from "./QarzJadval";
import { QarzTafsilot } from "./QarzTafsilot";
import { QarzdorRoyxat } from "./QarzdorRoyxat";
import { QarzdorTafsilot } from "./QarzdorTafsilot";
import { QarzdorTolovSheet } from "./QarzdorTolovSheet";
import {
  QarzFiltrPanel,
  type QarzKorinish,
  type QarzYonalish,
  type QarzTezFiltr,
  type QarzTartib,
} from "./QarzFiltrPanel";
import { QarzYangiModal, type QarzProductOption } from "./QarzYangiModal";
import type { KassaOption } from "./QarzTolovForm";

export type { QarzProductOption };

/** To'lov varag'i ochilganda kerak bo'ladigan minimal ma'lumot. */
interface TolovNishoni {
  ism: string;
  tel: string | null;
  turi: string;
  kalit: string;
  jamiQarz: number;
  ochiqQarzlar: QarzdorOchiqQarz[];
}

/**
 * QARZDORLAR TARTIBI — brauzer tarafi.
 *
 * Server ham AYNI qoidani qo'llaydi (`lib/queries/qarz.ts`), lekin filtr
 * qo'llangandan keyin tartib brauzerda qayta hisoblanadi: foydalanuvchi
 * tartibni almashtirganda sahifa qayta yuklanmasligi kerak.
 */
function sarala(royxat: QarzdorDTO[], tartib: QarzTartib): QarzdorDTO[] {
  const nusxa = [...royxat];
  switch (tartib) {
    case "summa":
      return nusxa.sort((a, b) => b.qarz - a.qarz || a.ism.localeCompare(b.ism));
    case "ism":
      return nusxa.sort((a, b) => a.ism.localeCompare(b.ism));
    case "muddat":
      return nusxa.sort(
        (a, b) =>
          (a.yaqinMuddat ?? "9999").localeCompare(b.yaqinMuddat ?? "9999") || b.qarz - a.qarz
      );
    default:
      return nusxa.sort(
        (a, b) =>
          MUDDAT_TARTIBI[a.muddatHolat] - MUDDAT_TARTIBI[b.muddatHolat] ||
          b.muddatiOtganSumma - a.muddatiOtganSumma ||
          b.qarz - a.qarz ||
          a.ism.localeCompare(b.ism)
      );
  }
}

/**
 * QARZLAR MODULI — ikki yo'nalish, ikki ko'rinish, bitta ma'lumot.
 *
 *   "Menga qarzdor"  — mijozlarning biznesga qarzi (aktiv);
 *   "Men qarzdorman" — biznesning ta'minotchiga qarzi (majburiyat).
 * Ikkalasi ATAYLAB bir summaga qo'shilmaydi (26-talab).
 *
 *   "Qarzdorlar" — SHAXS kesimi: kim qancha qarzdor (kundalik savol);
 *   "Yozuvlar"   — QARZ kesimi: qaysi savdo qarzga ketdi (tekshiruv uchun).
 *
 * FILTR HOLATI BITTA: KPI kartalar ham, chiplar ham ayni `tez` qiymatini
 * o'zgartiradi — foydalanuvchi ro'yxat nega qisqarganini har doim ko'radi.
 */
export function QarzlarClient({
  initialDebts,
  qarzdorlar,
  dashboard,
  kassalar,
  products = [],
  biznesTuri = "umumiy",
  bekorQilaOladi = false,
  boshlangichYonalish = "olinadigan",
}: {
  initialDebts: QarzDTO[];
  qarzdorlar: QarzdorDTO[];
  dashboard: QarzDashboardDTO;
  kassalar: KassaOption[];
  products?: QarzProductOption[];
  biznesTuri?: string;
  /** Qarzni bekor qilish faqat boshqaruvchida. */
  bekorQilaOladi?: boolean;
  /** URL'dagi `?turi=` — bosh sahifadagi karta shu bilan keladi. */
  boshlangichYonalish?: QarzYonalish;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const avto = isAvto(biznesTuri);
  const [debts, setDebts] = useState(initialDebts);
  // router.refresh() dan keyin server yangi ro'yxatni beradi — moslaymiz.
  useEffect(() => setDebts(initialDebts), [initialDebts]);

  // "Barcha" yo'nalishi olib tashlandi: aktiv va majburiyat aralashmasin.
  const [yonalish, setYonalish] = useState<Exclude<QarzYonalish, "hammasi">>(
    boshlangichYonalish === "beriladigan" ? "beriladigan" : "olinadigan"
  );
  const [korinish, setKorinish] = useState<QarzKorinish>("qarzdorlar");
  const [tez, setTez] = useState<QarzTezFiltr>("hammasi");
  const [tartib, setTartib] = useState<QarzTartib>("kritik");
  const [kategoriya, setKategoriya] = useState("");
  const [q, setQ] = useState("");
  const [ochilgan, setOchilgan] = useState<string | null>(null);
  const [ochilganQarzdor, setOchilganQarzdor] = useState<QarzdorDTO | null>(null);
  const [tolov, setTolov] = useState<TolovNishoni | null>(null);
  // Bosh sahifadagi "+ Yangi → Qarz" shu havola bilan keladi (`?yangi=1`):
  // qarz formasi shu yerda qoladi, dashboard uni QAYTA yozmaydi.
  const yangiSoralgan = useSearchParams().get("yangi") === "1";
  const [yangi, setYangi] = useState<{ turi: QarzTuri; mijoz: MijozTanlov | null } | null>(
    yangiSoralgan
      ? { turi: boshlangichYonalish === "beriladigan" ? "beriladigan" : "olinadigan", mijoz: null }
      : null
  );

  const matn = q.trim().toLowerCase();
  const bugun = todayDateOnlyString();
  const beriladigan = yonalish === "beriladigan";

  /** Qarzdorlar kesimidagi tez filtr — server bergan `muddatHolat` bo'yicha. */
  function qarzdorMos(d: QarzdorDTO): boolean {
    switch (tez) {
      case "kechikdi":
        return d.muddatHolat === "kechikdi";
      case "bugun":
        return d.muddatHolat === "bugun";
      case "yaqin":
        return d.muddatHolat === "yaqin";
      case "ochiq":
        return d.status === "OPEN";
      case "qisman":
        return d.status === "PARTIALLY_PAID";
      // Qarzdorlar kesimida yopilgan qarz yo'q — bu chip yozuvlar uchun.
      case "yopilgan":
        return false;
      default:
        return true;
    }
  }

  /** Yozuvlar kesimidagi tez filtr — bitta QARZ yozuvi bo'yicha. */
  function yozuvMos(d: QarzDTO): boolean {
    const { holat } = muddatHolati(d.muddat, d.isYopilgan, bugun);
    switch (tez) {
      case "kechikdi":
        return holat === "kechikdi";
      case "bugun":
        return holat === "bugun";
      case "yaqin":
        return holat === "yaqin";
      case "ochiq":
        return d.status === "OPEN";
      case "qisman":
        return d.status === "PARTIALLY_PAID";
      case "yopilgan":
        return d.status === "PAID";
      case "bugun-berilgan":
        return d.sana.slice(0, 10) === bugun;
      case "bugun-tolangan":
        return d.oxirgiTolov?.slice(0, 10) === bugun;
      default:
        return true;
    }
  }

  const korinadiganQarzdorlar = useMemo(
    () =>
      qarzdorlar
        .filter((d) => d.turi === yonalish)
        .filter(qarzdorMos)
        .filter(
          (d) => !matn || d.ism.toLowerCase().includes(matn) || (d.tel ?? "").includes(matn)
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qarzdorlar, yonalish, matn, tez]
  );

  const korinadiganYozuvlar = useMemo(
    () =>
      debts
        .filter((d) => d.turi === yonalish)
        .filter(yozuvMos)
        .filter((d) => !kategoriya || d.kategoriyaNomi === kategoriya)
        .filter(
          (d) =>
            !matn ||
            d.mijozNomi.toLowerCase().includes(matn) ||
            (d.mijozTel ?? "").includes(matn)
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debts, yonalish, matn, tez, kategoriya]
  );

  /** Yozuvlar kesimidagi kategoriya ro'yxati — mavjudlaridan quriladi. */
  const kategoriyalar = useMemo(
    () =>
      [
        ...new Set(
          debts.filter((d) => d.turi === yonalish).map((d) => d.kategoriyaNomi).filter(Boolean)
        ),
      ].sort() as string[],
    [debts, yonalish]
  );

  const sanoq: Record<QarzYonalish, number> = {
    hammasi: qarzdorlar.length,
    olinadigan: qarzdorlar.filter((d) => d.turi === "olinadigan").length,
    beriladigan: qarzdorlar.filter((d) => d.turi === "beriladigan").length,
  };

  /** Ro'yxatdagi "To'lov qabul qilish" — tafsilotni ochmasdan serverdan o'qiydi. */
  async function tolovOch(d: QarzdorDTO) {
    try {
      const params = new URLSearchParams({ kalit: d.kalit, turi: d.turi });
      const res = await fetch(`/api/debts/qarzdor?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        toast({ message: data.error ?? "Qarzdorni o'qib bo'lmadi", tone: "error" });
        return;
      }
      const t = data as QarzdorTafsilotDTO;
      setTolov({
        ism: t.ism,
        tel: t.tel,
        turi: t.turi,
        kalit: t.kalit,
        jamiQarz: t.jamiQarz,
        ochiqQarzlar: t.ochiqQarzlar,
      });
    } catch {
      toast({ message: "Serverga ulanib bo'lmadi", tone: "error" });
    }
  }

  function eslatma(d: QarzDTO) {
    const text = `Assalomu alaykum, ${d.mijozNomi}. Sizning ${formatSomLabel(
      d.qolgan
    )} miqdoridagi qarzingiz eslatib o'tamiz. Iltimos, imkoniyat bo'lganda to'lab qo'ysangiz. Rahmat.`;
    navigator.clipboard?.writeText(text).then(
      () => toast({ message: "Eslatma matni nusxalandi", tone: "success" }),
      () => toast({ message: text, tone: "neutral", duration: 8000 })
    );
  }

  /** Qarzdor kartochkasidan "+ Qarz qo'shish" — mijoz oldindan to'ldiriladi. */
  function qarzdordanQosh(t: QarzdorTafsilotDTO) {
    setOchilganQarzdor(null);
    setYangi({
      turi: t.turi === "beriladigan" ? "beriladigan" : "olinadigan",
      mijoz: { contactId: t.contactId, ism: t.ism, tel: t.tel ?? "" },
    });
  }

  return (
    <div className="space-y-4">
      <QarzKPI d={dashboard} faol={tez} onTanla={setTez} yonalish={yonalish} />

      <QarzFiltrPanel
        yonalish={yonalish}
        onYonalish={(v) => setYonalish(v === "beriladigan" ? "beriladigan" : "olinadigan")}
        sanoq={sanoq}
        korinish={korinish}
        onKorinish={setKorinish}
        q={q}
        onQ={setQ}
        tez={tez}
        onTez={(v) => {
          setTez(v);
          // "Yopilgan" qarzdorlar kesimida yo'q — ko'rinish o'zi almashadi.
          if (v === "yopilgan" || v === "bugun-berilgan" || v === "bugun-tolangan") {
            setKorinish("yozuvlar");
          }
        }}
        tartib={tartib}
        onTartib={setTartib}
        kategoriyalar={kategoriyalar}
        kategoriya={kategoriya}
        onKategoriya={setKategoriya}
      />

      {korinish === "qarzdorlar" ? (
        <QarzdorRoyxat
          qarzdorlar={sarala(korinadiganQarzdorlar, tartib)}
          onOch={setOchilganQarzdor}
          onTolov={tolovOch}
          onQarzQosh={() => setYangi({ turi: yonalish, mijoz: null })}
          bosh={sanoq[yonalish] === 0}
          beriladigan={beriladigan}
        />
      ) : (
        <QarzJadval
          qarzlar={korinadiganYozuvlar}
          onOch={(d) => setOchilgan(d.id)}
          onEslatma={eslatma}
        />
      )}

      {/* Pastda doim ko'rinadigan asosiy amal (20-talab). Mobil pastki
          navigatsiya `h-14` + safe-area egallaydi — FAB aynan undan
          yuqorida turadi, ustiga tushmaydi. */}
      <div className="fixed right-4 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.75rem)] lg:bottom-6 z-30">
        <Button
          onClick={() => setYangi({ turi: yonalish, mijoz: null })}
          className="min-h-[48px] shadow-raised rounded-full px-5"
        >
          + Qarz qo&apos;shish
        </Button>
      </div>
      {/* FAB ro'yxatning oxirgi kartasini to'sib qolmasin. */}
      <div className="h-16" aria-hidden />

      {tolov && (
        <QarzdorTolovSheet
          {...tolov}
          kassalar={kassalar}
          onClose={() => setTolov(null)}
          onDone={(xabar) => {
            setTolov(null);
            toast({ message: xabar, tone: "success" });
            router.refresh();
          }}
        />
      )}
      {ochilganQarzdor && (
        <QarzdorTafsilot
          kalit={ochilganQarzdor.kalit}
          turi={ochilganQarzdor.turi}
          kassalar={kassalar}
          onQarzQosh={qarzdordanQosh}
          onClose={() => setOchilganQarzdor(null)}
          onChanged={() => router.refresh()}
        />
      )}
      {ochilgan && (
        <QarzTafsilot
          debtId={ochilgan}
          kassalar={kassalar}
          bekorQilaOladi={bekorQilaOladi}
          onClose={() => setOchilgan(null)}
          onChanged={() => router.refresh()}
        />
      )}
      {yangi && (
        <QarzYangiModal
          turi={yangi.turi}
          mijoz={yangi.mijoz}
          products={products}
          avto={avto}
          onClose={() => setYangi(null)}
          onDone={() => {
            setYangi(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
