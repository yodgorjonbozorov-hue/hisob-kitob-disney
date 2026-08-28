"use client";

import { Modal } from "@/components/ui/Modal";

/**
 * Selfie ko'rish — rasm faqat avtorizatsiyalangan API orqali yuklanadi
 * (`/api/hr/davomat/selfie/[id]`), ochiq URL yo'q.
 */
export function SelfieModal({
  selfieId,
  sarlavha,
  onYopish,
}: {
  selfieId: string | null;
  sarlavha: string;
  onYopish: () => void;
}) {
  return (
    <Modal open={Boolean(selfieId)} onClose={onYopish} title={sarlavha}>
      {selfieId && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/hr/davomat/selfie/${selfieId}`}
          alt="Davomat selfiesi"
          className="w-full rounded-2xl object-contain max-h-[70vh] bg-surface-2"
        />
      )}
    </Modal>
  );
}
