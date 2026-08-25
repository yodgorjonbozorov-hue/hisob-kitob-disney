"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import type { MenyuAmali } from "@/components/ui/AmalMenyu";
import { biznesModulKodlari } from "@/lib/modules/biznesModullari";
import type { BiznesTafsilot } from "@/lib/services/biznesTafsilot";
import { HolatModal } from "../HolatModal";
import { BOLIMLAR, type Bolim } from "./bolimlar";
import { DesktopTablar, MobilOrqaga, MobilRoyxat } from "./BolimNav";
import { DetailUsti } from "./DetailUsti";
import { KassaBolim } from "./KassaBolim";
import { ModullarBolim } from "./ModullarBolim";
import { OmborBolim } from "./OmborBolim";
import { UmumiyBolim } from "./UmumiyBolim";
import { XavfliZona } from "./XavfliZona";
import { XodimlarBolim } from "./XodimlarBolim";

/**
 * BIZNES TAFSILOTI — bo'limli boshqaruv ekrani.
 *
 * Mobil'da bo'limlar tab emas, navigatsiya kartochkalari (BolimNav.tsx):
 * 6 ta tabni 375px ga siqish o'qib bo'lmaydigan qatorga aylanardi.
 */
export function BiznesDetail({
  biznes,
  rol,
  boshlangichBolim,
  yoqilganModullar,
  tarifModullari,
}: {
  biznes: BiznesTafsilot;
  rol: string;
  boshlangichBolim: Bolim;
  yoqilganModullar: string[];
  tarifModullari: string[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const owner = rol === "OWNER";
  const korinadigan = BOLIMLAR.filter((b) => !b.ownerOnly || owner);
  const boshlangich = korinadigan.some((b) => b.kod === boshlangichBolim)
    ? boshlangichBolim
    : "umumiy";

  const [bolim, setBolim] = useState<Bolim>(boshlangich);
  // Mobil'da bo'lim TANLANMAGUNCHA ro'yxat ko'rinadi. URL'da bo'lim
  // berilgan bo'lsa (masalan "•••" menyusidan kelingan) darhol ochiladi.
  const [mobilOchiq, setMobilOchiq] = useState(boshlangich !== "umumiy");
  const [holat, setHolat] = useState(false);
  const [band, setBand] = useState(false);
  const [otishBand, setOtishBand] = useState(false);

  const modulSoni = biznesModulKodlari(new Set(yoqilganModullar), {
    omborli: biznes.omborli,
    magazin: biznes.magazin,
  }).length;

  /** Aktiv biznesni almashtirish — ruxsat SERVERDA tekshiriladi. */
  async function biznesgaOt() {
    setOtishBand(true);
    try {
      const res = await fetch("/api/me/active-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: biznes.id }),
      });
      if (!res.ok) {
        toast({ message: (await res.json()).error ?? "Biznesga o'tib bo'lmadi", tone: "error" });
        return;
      }
      router.push("/app");
      router.refresh();
    } catch {
      toast({ message: "Serverga ulanib bo'lmadi", tone: "error" });
    } finally {
      setOtishBand(false);
    }
  }

  async function holatniAlmashtir() {
    setBand(true);
    try {
      const res = await fetch(`/api/businesses/${biznes.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !biznes.isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ message: data.error ?? "Saqlab bo'lmadi", tone: "error" });
        return;
      }
      setHolat(false);
      toast({
        message: data.isActive ? "Biznes faollashtirildi" : "Biznes nofaollashtirildi",
        tone: "success",
      });
      router.refresh();
    } catch {
      toast({ message: "Serverga ulanib bo'lmadi", tone: "error" });
    } finally {
      setBand(false);
    }
  }

  const amallar: MenyuAmali[] = [
    ...korinadigan
      .filter((b) => b.kod !== "xavfsizlik")
      .map((b) => ({
        label: b.nomi,
        onClick: () => {
          setBolim(b.kod);
          setMobilOchiq(true);
        },
      })),
    {
      label: biznes.isActive ? "Nofaollashtirish" : "Faollashtirish",
      onClick: () => setHolat(true),
      ajrat: true,
    },
    ...(owner
      ? [
          {
            label: "Xavfli zona…",
            onClick: () => {
              setBolim("xavfsizlik");
              setMobilOchiq(true);
            },
            tur: "xavf" as const,
            ajrat: true,
          },
        ]
      : []),
  ];

  const nomi = korinadigan.find((b) => b.kod === bolim)?.nomi ?? "";

  return (
    <div className="space-y-5">
      <DetailUsti
        biznes={biznes}
        modulSoni={modulSoni}
        otishBand={otishBand}
        amallar={amallar}
        onOtish={() => void biznesgaOt()}
      />

      <DesktopTablar
        faol={bolim}
        korinadigan={korinadigan}
        onTanla={(b) => {
          setBolim(b);
          setMobilOchiq(true);
        }}
      />

      {!mobilOchiq && (
        <MobilRoyxat
          korinadigan={korinadigan}
          onTanla={(b) => {
            setBolim(b);
            setMobilOchiq(true);
          }}
        />
      )}

      <div className={mobilOchiq ? "space-y-3" : "hidden lg:block space-y-3"}>
        <MobilOrqaga nomi={nomi} onOrqaga={() => setMobilOchiq(false)} />
        {bolim === "xavfsizlik" ? (
          <XavfliZona biznes={biznes} />
        ) : (
          <Card>
            {bolim === "umumiy" && (
              <UmumiyBolim biznes={biznes} onHolat={() => setHolat(true)} />
            )}
            {bolim === "modullar" && (
              <ModullarBolim
                biznes={biznes}
                rol={rol}
                yoqilganModullar={yoqilganModullar}
                tarifModullari={tarifModullari}
              />
            )}
            {bolim === "xodimlar" && <XodimlarBolim xodimlar={biznes.xodimlar} />}
            {bolim === "kassa" && <KassaBolim biznes={biznes} />}
            {bolim === "ombor" && <OmborBolim biznes={biznes} />}
          </Card>
        )}
      </div>

      {holat && (
        <HolatModal
          biznes={biznes}
          band={band}
          onClose={() => setHolat(false)}
          onTasdiq={() => void holatniAlmashtir()}
        />
      )}
    </div>
  );
}
