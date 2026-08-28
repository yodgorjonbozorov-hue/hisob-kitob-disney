"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { daqiqaMatn } from "@/lib/davomat/vaqt";
import type { MenHolatDTO } from "@/lib/queries/davomat";
import { KameraOlish } from "./KameraOlish";
import { MenTarix } from "./MenTarix";

interface Lokatsiya {
  lat: number;
  lng: number;
  aniqlikM: number | null;
}

interface Natija {
  turi: "kelish" | "ketish";
  vaqtida: boolean;
  kechikishDaqiqa: number;
  ishlanganDaqiqa?: number;
}

const OYLAR = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

function sanaMatn(sana: string): string {
  const [, oy, kun] = sana.split("-");
  return `${parseInt(kun, 10)}-${OYLAR[parseInt(oy, 10) - 1]}`;
}

export function MenClient({ boshlangich, ism }: { boshlangich: MenHolatDTO; ism: string }) {
  const router = useRouter();
  const holat = boshlangich;
  const [amal, setAmal] = useState<"kelish" | "ketish" | null>(null);
  const [kamera, setKamera] = useState(false);
  const [yuborilmoqda, setYuborilmoqda] = useState(false);
  const [xato, setXato] = useState<string | null>(null);
  const [natija, setNatija] = useState<Natija | null>(null);

  const bugun = holat.bugun;
  const ishda = Boolean(bugun?.kelgan && !bugun?.ketgan);
  const tugagan = Boolean(bugun?.kelgan && bugun?.ketgan);

  async function lokatsiyaOl(): Promise<Lokatsiya> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Bu qurilmada lokatsiya ishlamaydi"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (p) =>
          resolve({
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            aniqlikM: p.coords.accuracy != null ? Math.round(p.coords.accuracy) : null,
          }),
        (e) =>
          reject(
            new Error(
              e.code === e.PERMISSION_DENIED
                ? "Davomatni tasdiqlash uchun lokatsiyaga ruxsat bering"
                : "Lokatsiya aniqlanmadi — ochiq joyda qaytadan urinib ko'ring"
            )
          ),
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 }
      );
    });
  }

  async function yubor(turi: "kelish" | "ketish", selfie?: { base64: string; mime: string }) {
    setYuborilmoqda(true);
    setXato(null);
    try {
      let lok: Lokatsiya | null = null;
      if (holat.siyosat.gpsTalab) lok = await lokatsiyaOl();
      const res = await fetch(`/api/hr/men/${turi}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: lok?.lat ?? null,
          lng: lok?.lng ?? null,
          aniqlikM: lok?.aniqlikM ?? null,
          selfieBase64: selfie?.base64 ?? null,
          selfieMime: selfie?.mime ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      setNatija({
        turi,
        vaqtida: data.vaqtida,
        kechikishDaqiqa: data.kechikishDaqiqa,
        ishlanganDaqiqa: data.ishlanganDaqiqa,
      });
      router.refresh();
    } catch (e) {
      setXato(e instanceof Error ? e.message : "Serverga ulanib bo'lmadi");
    } finally {
      setYuborilmoqda(false);
      setAmal(null);
    }
  }

  function boshla(turi: "kelish" | "ketish") {
    setXato(null);
    setNatija(null);
    setAmal(turi);
    if (holat.siyosat.selfieTalab) {
      setKamera(true);
    } else {
      void yubor(turi);
    }
  }

  if (!holat.xodim) {
    return (
      <div className="space-y-6 max-w-md mx-auto">
        <h1 className="text-xl sm:text-2xl font-bold text-fg">Davomatim</h1>
        <Card>
          <p className="text-muted text-sm">
            Hisobingiz xodim kartochkasiga bog&apos;lanmagan. Administrator sizni Xodimlar
            bo&apos;limida hisobingizga bog&apos;lashi kerak.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-fg">Salom, {holat.xodim.ism || ism}</h1>
        <p className="text-sm text-muted mt-1">Bugun: {sanaMatn(holat.sana)}</p>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted text-sm">Ish vaqtingiz</p>
            <p className="text-lg font-bold text-fg tnum">
              {holat.jadval?.ishKuni
                ? `${holat.jadval.boshlanish} — ${holat.jadval.tugash}`
                : holat.jadval
                  ? "Dam olish kuni"
                  : "Jadval belgilanmagan"}
            </p>
          </div>
          {ishda && <Badge tone="kirim">Hozir ishda</Badge>}
          {tugagan && <Badge tone="neutral">Ish tugagan</Badge>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-2xs">
          {holat.siyosat.gpsTalab && (
            <span className="px-2 py-1 rounded-lg bg-surface-2 text-muted">📍 Lokatsiya talab qilinadi</span>
          )}
          {holat.siyosat.selfieTalab && (
            <span className="px-2 py-1 rounded-lg bg-surface-2 text-muted">📷 Selfie talab qilinadi</span>
          )}
          {holat.siyosat.radiusTalab && holat.ishJoyi && (
            <span className="px-2 py-1 rounded-lg bg-surface-2 text-muted">
              {holat.ishJoyi.nomi} · {holat.ishJoyi.radiusM} m
            </span>
          )}
        </div>
      </Card>

      {bugun?.kelgan && (
        <Card>
          <div className="flex items-baseline justify-between">
            <p className="text-muted text-sm">Ish boshlandi</p>
            <p className="text-2xl font-bold text-fg tnum">{bugun.kelgan}</p>
          </div>
          {bugun.jarimaDaqiqa > 0 ? (
            <p className="text-sm text-expense mt-1">⚠️ {bugun.kechikishDaqiqa} daqiqa kechikdingiz</p>
          ) : (
            <p className="text-sm text-income mt-1">✅ Vaqtida keldingiz</p>
          )}
          {bugun.ketgan && (
            <div className="mt-2 pt-2 border-t border-line flex items-baseline justify-between">
              <p className="text-muted text-sm">Ish tugadi: {bugun.ketgan}</p>
              <p className="text-sm font-medium text-fg">{daqiqaMatn(bugun.ishlanganDaqiqa)}</p>
            </div>
          )}
        </Card>
      )}

      {natija && (
        <Card className={natija.vaqtida ? "border-income" : "border-debt"}>
          <p className="font-bold text-fg">
            {natija.turi === "kelish" ? "Ish boshlandi" : "Ish tugatildi"}
          </p>
          <p className="text-sm mt-1 text-muted">
            {natija.turi === "kelish"
              ? natija.vaqtida
                ? "✅ Vaqtida keldingiz"
                : `⚠️ ${natija.kechikishDaqiqa} daqiqa kechikdingiz`
              : `Ishlangan vaqt: ${daqiqaMatn(natija.ishlanganDaqiqa ?? 0)}`}
          </p>
        </Card>
      )}

      {xato && (
        <div className="rounded-xl bg-expense-soft text-expense text-sm p-3">{xato}</div>
      )}

      {!tugagan &&
        (ishda ? (
          <Button
            variant="danger"
            size="lg"
            className="w-full"
            loading={yuborilmoqda}
            onClick={() => boshla("ketish")}
          >
            ISHNI TUGATISH
          </Button>
        ) : (
          <Button
            size="lg"
            className="w-full"
            loading={yuborilmoqda}
            onClick={() => boshla("kelish")}
          >
            ISHNI BOSHLASH
          </Button>
        ))}

      <KameraOlish
        ochiq={kamera}
        onYopish={() => {
          setKamera(false);
          setAmal(null);
        }}
        onSurat={(base64, mime) => {
          setKamera(false);
          if (amal) void yubor(amal, { base64, mime });
        }}
      />

      <MenTarix />
    </div>
  );
}
