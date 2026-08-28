"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import { RADIUS_PRESETLAR } from "@/lib/validation/davomat";

export interface IshJoyiDTO {
  id: string;
  nomi: string;
  lat: number;
  lng: number;
  radiusM: number;
  standart: boolean;
  isActive: boolean;
}

export function IshJoyiModal({ joy, onYopish }: { joy: IshJoyiDTO | null; onYopish: () => void }) {
  const router = useRouter();
  const [nomi, setNomi] = useState(joy?.nomi ?? "");
  const [lat, setLat] = useState(joy ? String(joy.lat) : "");
  const [lng, setLng] = useState(joy ? String(joy.lng) : "");
  const [radius, setRadius] = useState(joy?.radiusM ?? 100);
  const [standart, setStandart] = useState(joy?.standart ?? false);
  const [xato, setXato] = useState<string | null>(null);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [gpsYuklanmoqda, setGpsYuklanmoqda] = useState(false);

  function hozirgiJoylashuv() {
    if (!navigator.geolocation) {
      setXato("Bu qurilmada lokatsiya ishlamaydi");
      return;
    }
    setGpsYuklanmoqda(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude.toFixed(6));
        setLng(p.coords.longitude.toFixed(6));
        setGpsYuklanmoqda(false);
      },
      () => {
        setXato("Lokatsiya aniqlanmadi — ruxsat berilganini tekshiring");
        setGpsYuklanmoqda(false);
      },
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  }

  async function saqla(e: React.FormEvent) {
    e.preventDefault();
    setXato(null);
    setYuklanmoqda(true);
    try {
      const body = {
        nomi,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        radiusM: radius,
        standart,
      };
      if (!Number.isFinite(body.lat) || !Number.isFinite(body.lng)) {
        setXato("Koordinatalar noto'g'ri");
        return;
      }
      const res = await fetch(joy ? `/api/hr/ish-joyi/${joy.id}` : "/api/hr/ish-joyi", {
        method: joy ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      onYopish();
      router.refresh();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setYuklanmoqda(false);
    }
  }

  return (
    <Modal open onClose={onYopish} title={joy ? "Ish joyini tahrirlash" : "Yangi ish joyi"}>
      <form onSubmit={saqla} className="space-y-4">
        <div>
          <label className={LABEL_CLASS} htmlFor="ij-nomi">Nomi</label>
          <input
            id="ij-nomi"
            className={INPUT_CLASS}
            value={nomi}
            onChange={(e) => setNomi(e.target.value)}
            placeholder="Masalan: Fortex ofisi"
            required
            maxLength={120}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="ij-lat">Kenglik (lat)</label>
            <input
              id="ij-lat"
              className={INPUT_CLASS}
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              inputMode="decimal"
              placeholder="41.311081"
              required
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="ij-lng">Uzunlik (lng)</label>
            <input
              id="ij-lng"
              className={INPUT_CLASS}
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              inputMode="decimal"
              placeholder="69.240562"
              required
            />
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full"
          loading={gpsYuklanmoqda}
          onClick={hozirgiJoylashuv}
        >
          📍 Hozirgi joylashuvimni olish
        </Button>
        <div>
          <label className={LABEL_CLASS} htmlFor="ij-radius">Ruxsat radiusi (metr)</label>
          <div className="flex gap-2 mb-2">
            {RADIUS_PRESETLAR.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRadius(r)}
                className={`px-3 h-9 rounded-lg text-sm border ${
                  radius === r
                    ? "bg-brand-wash text-brand border-brand"
                    : "bg-surface text-muted border-line"
                }`}
              >
                {r} m
              </button>
            ))}
          </div>
          <input
            id="ij-radius"
            type="number"
            inputMode="numeric"
            min={20}
            max={10_000}
            className={INPUT_CLASS}
            value={radius}
            onChange={(e) => setRadius(parseInt(e.target.value || "0", 10))}
            required
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-fg min-h-[44px]">
          <input
            type="checkbox"
            checked={standart}
            onChange={(e) => setStandart(e.target.checked)}
            className="w-4 h-4"
          />
          Biznes standart ish joyi
        </label>
        {xato && <p className="text-sm text-expense">{xato}</p>}
        <Button type="submit" className="w-full" loading={yuklanmoqda}>
          Saqlash
        </Button>
      </form>
    </Modal>
  );
}
