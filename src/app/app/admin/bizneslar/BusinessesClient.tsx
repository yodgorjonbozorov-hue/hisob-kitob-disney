"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { Asboblar } from "./Asboblar";
import { BiznesJadval } from "./BiznesJadval";
import { BiznesKartalar } from "./BiznesKartalar";
import { HolatModal } from "./HolatModal";
import { Xulosa } from "./Xulosa";
import { YangiBiznesWizard } from "./YangiBiznesWizard";
import { royxatniTayyorla, type BusinessDTO, type Filtr, type Saralash } from "./turlar";

/** Bir sahifada ko'rsatiladigan biznes soni — qolgani "Ko'proq" bilan ochiladi. */
const SAHIFA = 30;

export function BusinessesClient({
  initialBusinesses,
  rol,
  tarifModullari,
  yoqilganModullar,
}: {
  initialBusinesses: BusinessDTO[];
  rol: string;
  tarifModullari: string[];
  yoqilganModullar: string[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [bizneslar, setBizneslar] = useState(initialBusinesses);
  // `router.refresh()` dan keyin server yangi ro'yxat beradi — mahalliy holat
  // unga ergashadi (React'ning "prop o'zgarganda holatni moslash" uslubi).
  const [oxirgiProp, setOxirgiProp] = useState(initialBusinesses);
  if (oxirgiProp !== initialBusinesses) {
    setOxirgiProp(initialBusinesses);
    setBizneslar(initialBusinesses);
  }
  const [qidiruv, setQidiruv] = useState("");
  const [filtr, setFiltr] = useState<Filtr>("hammasi");
  const [saralash, setSaralash] = useState<Saralash>("faollik");
  const [limit, setLimit] = useState(SAHIFA);
  const [wizard, setWizard] = useState(false);
  const [holat, setHolat] = useState<BusinessDTO | null>(null);
  const [band, setBand] = useState(false);

  const owner = rol === "OWNER";

  const sonlar = useMemo(
    () => ({
      hammasi: bizneslar.length,
      faol: bizneslar.filter((b) => b.isActive).length,
      nofaol: bizneslar.filter((b) => !b.isActive).length,
    }),
    [bizneslar]
  );
  const jamiTranzaksiya = useMemo(
    () => bizneslar.reduce((s, b) => s + b.tranzaksiyalar, 0),
    [bizneslar]
  );
  const korinadigan = useMemo(
    () => royxatniTayyorla(bizneslar, { qidiruv, filtr, saralash }),
    [bizneslar, qidiruv, filtr, saralash]
  );
  const kesilgan = korinadigan.slice(0, limit);

  /** Faol/nofaol holatini almashtiradi (ma'lumot o'chmaydi). */
  async function holatniAlmashtir(b: BusinessDTO) {
    setBand(true);
    try {
      const res = await fetch(`/api/businesses/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !b.isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ message: data.error ?? "Saqlab bo'lmadi", tone: "error" });
        return;
      }
      setBizneslar((prev) =>
        prev.map((x) => (x.id === b.id ? { ...x, isActive: data.isActive } : x))
      );
      setHolat(null);
      toast({
        message: data.isActive ? `"${b.nomi}" faollashtirildi` : `"${b.nomi}" nofaollashtirildi`,
        tone: "success",
      });
      router.refresh();
    } catch {
      toast({ message: "Serverga ulanib bo'lmadi", tone: "error" });
    } finally {
      setBand(false);
    }
  }

  const boshRoyxat = bizneslar.length === 0;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Bizneslar</h1>
          <p className="text-sm text-muted mt-1">Barcha bizneslaringizni bir joydan boshqaring</p>
        </div>
        <Button onClick={() => setWizard(true)} className="shrink-0 min-h-[44px]">
          <Plus size={16} aria-hidden />
          <span className="hidden sm:inline">Yangi biznes</span>
          <span className="sm:hidden">Yangi</span>
        </Button>
      </header>

      {boshRoyxat ? (
        <Card>
          <EmptyState
            icon={<Building2 size={22} aria-hidden />}
            title="Birinchi biznesingizni yarating"
            description="Balansa'da kirim, chiqim, kassa va boshqa jarayonlarni boshqarishni boshlang."
            action={<Button onClick={() => setWizard(true)}>+ Biznes yaratish</Button>}
          />
        </Card>
      ) : (
        <>
          <Xulosa
            jami={sonlar.hammasi}
            faol={sonlar.faol}
            nofaol={sonlar.nofaol}
            tranzaksiyalar={jamiTranzaksiya}
          />

          <Asboblar
            qidiruv={qidiruv}
            filtr={filtr}
            saralash={saralash}
            sonlar={sonlar}
            onQidiruv={(v) => {
              setQidiruv(v);
              setLimit(SAHIFA);
            }}
            onFiltr={(v) => {
              setFiltr(v);
              setLimit(SAHIFA);
            }}
            onSaralash={setSaralash}
          />

          {korinadigan.length === 0 ? (
            <Card>
              <EmptyState
                title="Hech narsa topilmadi"
                description="Qidiruv so'zini yoki filtrni o'zgartirib ko'ring."
              />
            </Card>
          ) : (
            <>
              <Card className="p-0 sm:p-0 lg:p-5 border-0 lg:border shadow-none lg:shadow-card bg-transparent lg:bg-surface">
                <BiznesJadval bizneslar={kesilgan} owner={owner} onHolat={setHolat} />
                <BiznesKartalar bizneslar={kesilgan} owner={owner} onHolat={setHolat} />
              </Card>

              {korinadigan.length > kesilgan.length && (
                <div className="flex justify-center">
                  <Button variant="secondary" onClick={() => setLimit((n) => n + SAHIFA)}>
                    Yana {Math.min(SAHIFA, korinadigan.length - kesilgan.length)} ta ko&apos;rsatish
                    <span className="text-faint">
                      ({kesilgan.length}/{korinadigan.length})
                    </span>
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {wizard && (
        <YangiBiznesWizard
          tarifModullari={tarifModullari}
          yoqilganModullar={yoqilganModullar}
          onClose={() => setWizard(false)}
          // Yaratilgach oyna YOPILMAYDI: wizard'ning oxirgi qadamlari
          // (xodimlar, "Biznes tayyor") shundan keyin ko'rsatiladi. Ro'yxat
          // esa fonda yangilanadi.
          onCreated={() => router.refresh()}
        />
      )}

      {holat && (
        <HolatModal
          biznes={holat}
          band={band}
          onClose={() => setHolat(null)}
          onTasdiq={() => void holatniAlmashtir(holat)}
        />
      )}
    </div>
  );
}
