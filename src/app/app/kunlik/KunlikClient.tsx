"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import type {
  KunlikDirektorDTO,
  KunlikKassaDTO,
  KunlikOperatsiyaDTO,
  KunlikReportDTO,
  KutilayotganKunDTO,
} from "@/lib/queries/kunlik";
import type { SmenaHolatDTO } from "@/lib/queries/smena";
import type { KunlikRuxsat } from "@/lib/services/kunlik";
import { KunlikSarlavha } from "./KunlikSarlavha";
import { XulosaKartalar } from "./XulosaKartalar";
import { SmenaCard } from "./SmenaCard";
import { YakunCard } from "./YakunCard";
import { TushumForm } from "./TushumForm";
import { TopshirishModal } from "./TopshirishModal";
import { DirektorModal } from "./DirektorModal";
import { Operatsiyalar } from "./Operatsiyalar";
import { KutilayotganKunlar } from "./KutilayotganKunlar";
import { StickyAmal } from "./StickyAmal";

export interface KunlikSahifaProps {
  report: KunlikReportDTO;
  ruxsat: KunlikRuxsat;
  bugun: string;
  direktor: KunlikDirektorDTO;
  smena: SmenaHolatDTO;
  kassa: KunlikKassaDTO;
  operatsiyalar: KunlikOperatsiyaDTO[];
  kategoriyalar: { id: string; nomi: string }[];
  kutilayotganlar: KutilayotganKunDTO[];
}

/**
 * KUNLIK HISOBOT — sahifa boshqaruvchisi.
 *
 * Tartib ataylab shunday: sarlavha va holat → kun xulosasi → smena
 * solishtiruvi → kun yakuni (pul) → tushum kiritish → operatsiyalar lentasi.
 * Ya'ni "kun qanday o'tdi" savolidan "endi nima qilaman" savoliga qarab
 * yuriladi. Mobil'da asosiy amal sticky panelda takrorlanadi.
 */
export function KunlikClient({
  report,
  ruxsat,
  bugun,
  direktor,
  smena,
  kassa,
  operatsiyalar,
  kategoriyalar,
  kutilayotganlar,
}: KunlikSahifaProps) {
  const router = useRouter();
  const [direktorModal, setDirektorModal] = useState(false);
  const [topshirishModal, setTopshirishModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const bugungi = report.sana === bugun;
  const ochiq = report.holat === "OPEN";

  /** Direktor qarori va qayta ochish — bitta yo'l, bitta xato ko'rsatkichi. */
  async function amal(url: string, tana: Record<string, unknown>) {
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sana: report.sana, ...tana }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      router.refresh();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  function qaror(amali: "qabul" | "rad") {
    if (amali === "rad") {
      const sabab = prompt("Rad etish sababi (kassir ko'radi):");
      if (!sabab?.trim()) return;
      void amal("/api/kunlik/tasdiqlash", { amal: "rad", qarorIzoh: sabab.trim() });
      return;
    }
    const farq = report.naqdFarq;
    const ogoh =
      farq && farq !== 0
        ? `Kassada ${farq < 0 ? "KAMOMAD" : "ORTIQCHA"}: ${Math.abs(farq).toLocaleString(
            "uz-UZ"
          )} so'm.\nShunga qaramay qabul qilinsinmi?`
        : "Kun yakuni qabul qilinsinmi? Pul kassirdan markaziy kassaga o'tadi.";
    if (!confirm(ogoh)) return;
    void amal("/api/kunlik/tasdiqlash", { amal: "qabul" });
  }

  function qaytaOch() {
    if (!confirm("Kun qayta ochilsinmi? Pul harakati ham orqaga qaytariladi (storno).")) return;
    void amal("/api/kunlik/qayta-ochish", {});
  }

  return (
    <div className="space-y-5">
      <KunlikSarlavha
        sana={report.sana}
        holat={report.holat}
        bugun={bugun}
        ruxsat={ruxsat}
        direktor={direktor}
        onDirektor={() => setDirektorModal(true)}
      />

      {ruxsat.tasdiqlaydi && <KutilayotganKunlar kunlar={kutilayotganlar} />}

      <XulosaKartalar report={report} />

      <SmenaCard holat={smena} ruxsat={ruxsat} bugungi={bugungi} />

      <YakunCard
        report={report}
        kassa={kassa}
        ruxsat={ruxsat}
        bugungi={bugungi}
        loading={loading}
        onTopshirish={() => setTopshirishModal(true)}
        onQaror={qaror}
        onQaytaOch={qaytaOch}
      />

      {xato && (
        <p className="text-sm text-expense" role="alert">
          {xato}
        </p>
      )}

      {bugungi && ochiq && (
        <TushumForm kategoriyalar={kategoriyalar} onDone={() => router.refresh()} />
      )}
      {bugungi && !ochiq && (
        <Card>
          <p className="text-sm text-muted">
            {report.holat === "SUBMITTED"
              ? "Bugungi kassa direktorga topshirilgan — yangi tushum kiritilmaydi. Kerak bo'lsa direktor kunni qayta ochadi."
              : "Bugungi kun yakunlangan — yangi tushum kiritilmaydi. Tuzatish kerak bo'lsa direktor kunni qayta ochadi."}
          </p>
        </Card>
      )}

      <Operatsiyalar operatsiyalar={operatsiyalar} bugungi={bugungi} />

      {/* Sticky panel kontentni yopib qolmasin — pastda bo'sh joy. */}
      <div className="sm:hidden h-24" aria-hidden />

      <StickyAmal
        holat={report.holat}
        qoldiq={kassa.qoldiq}
        loading={loading}
        tasdiqlaydi={ruxsat.tasdiqlaydi}
        bugungi={bugungi}
        onTopshirish={() => setTopshirishModal(true)}
        onQabul={() => qaror("qabul")}
        onRad={() => qaror("rad")}
      />

      {topshirishModal && (
        <TopshirishModal
          sana={report.sana}
          kassa={kassa}
          direktorIsm={direktor.direktorIsm}
          onClose={() => setTopshirishModal(false)}
          onDone={() => {
            setTopshirishModal(false);
            router.refresh();
          }}
        />
      )}

      {direktorModal && (
        <DirektorModal
          onClose={() => setDirektorModal(false)}
          onDone={() => {
            setDirektorModal(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
