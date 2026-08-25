"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { XodimDTO } from "./turlar";

/**
 * YARATILDI EKRANI — login va vaqtinchalik parolni BIR MARTA ko'rsatadi.
 *
 * Parol serverda faqat hash ko'rinishida saqlanadi, ya'ni bu oyna yopilgach
 * uni hech kim (jumladan direktor ham) qayta ko'ra olmaydi — faqat qaytadan
 * tiklash mumkin. Shu bois ogohlantirish matni bor va parol brauzer
 * xotirasida ham shu oynadan uzoqroq qolmaydi.
 */

function KochirishTugmasi({ matn, label }: { matn: string; label: string }) {
  const [kochirildi, setKochirildi] = useState(false);
  return (
    <button
      type="button"
      aria-label={`${label} — ko'chirish`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(matn);
          setKochirildi(true);
          setTimeout(() => setKochirildi(false), 2000);
        } catch {
          // Clipboard ruxsati yo'q (HTTP yoki eski brauzer) — matn ko'rinib
          // turibdi, qo'lda ko'chiriladi. Xato ko'rsatish shovqin bo'lardi.
        }
      }}
      className="shrink-0 text-2xs font-medium text-brand hover:underline min-h-[44px] px-2"
    >
      {kochirildi ? "Ko'chirildi" : "Ko'chirish"}
    </button>
  );
}

function Maydon({ nom, qiymat }: { nom: string; qiymat: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3">
      <div className="min-w-0 py-2">
        <p className="text-2xs text-faint">{nom}</p>
        <p className="text-sm font-medium text-fg break-all">{qiymat}</p>
      </div>
      <KochirishTugmasi matn={qiymat} label={nom} />
    </div>
  );
}

export function XodimYaratildi({
  xodim,
  parol,
  onClose,
}: {
  xodim: XodimDTO;
  parol: string;
  onClose: () => void;
}) {
  return (
    <Modal open onClose={onClose} title="Xodim yaratildi">
      <div className="space-y-4">
        <p className="text-sm text-fg">
          <span aria-hidden>✓</span> <span className="font-medium">{xodim.ism}</span> yaratildi —{" "}
          {xodim.rolNomi}.
        </p>

        <div className="space-y-2">
          <Maydon nom="Login" qiymat={xodim.login} />
          <Maydon nom="Vaqtinchalik parol" qiymat={parol} />
        </div>

        <p className="text-xs text-muted rounded-lg bg-surface-2 px-3 py-2">
          Bu parolni xodimga hozir bering — oyna yopilgandan keyin uni qayta ko&apos;rib
          bo&apos;lmaydi (faqat yangisini tiklash mumkin). Xodim birinchi kirishda
          o&apos;zining parolini qo&apos;yadi.
        </p>

        <div className="flex justify-end">
          <Button onClick={onClose}>Yopish</Button>
        </div>
      </div>
    </Modal>
  );
}
