import { EmptyState } from "@/components/ui/EmptyState";

/**
 * UX HOLATLARI (talab 54/55/56).
 *
 * Har sahifa uchun bir xil to'rt holat: yuklanmoqda, bo'sh, xato, ruxsat yo'q.
 * Matnlar ANIQ: foydalanuvchiga nima qilish kerakligini aytadi, "Xatolik
 * yuz berdi" bilan cheklanmaydi.
 */

export function Yuklanmoqda({ qator = 6 }: { qator?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Yuklanmoqda">
      {Array.from({ length: qator }).map((_, i) => (
        <div key={i} className="h-12 rounded-lg bg-surface-2 animate-pulse" />
      ))}
    </div>
  );
}

export function BoshHolat({
  sarlavha,
  izoh,
  amal,
}: {
  sarlavha: string;
  izoh?: string;
  amal?: React.ReactNode;
}) {
  return <EmptyState title={sarlavha} description={izoh} action={amal} />;
}

export function FiltrBoshHolat({ tozalaHref }: { tozalaHref: string }) {
  return (
    <BoshHolat
      sarlavha="Filtrga mos yozuv topilmadi"
      izoh="Qidiruv so'zini qisqartiring yoki filtrlarni tozalang."
      amal={
        <a
          href={tozalaHref}
          className="text-sm text-brand font-medium underline underline-offset-4"
        >
          Filtrlarni tozalash
        </a>
      }
    />
  );
}

export function XatoHolat({
  xabar,
  requestId,
  qaytaUrin,
}: {
  xabar?: string;
  requestId?: string | null;
  qaytaUrin?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-expense-soft bg-expense-soft/40 p-5 text-center">
      <p className="font-medium text-expense-fg">Nimadir noto&apos;g&apos;ri ketdi</p>
      <p className="text-sm text-muted mt-1">
        {xabar ?? "So'rovni bajarib bo'lmadi. Bir oz kutib qayta urinib ko'ring."}
      </p>
      {requestId && (
        <p className="text-2xs text-faint mt-2 font-mono">Murojaat raqami: {requestId}</p>
      )}
      {qaytaUrin && <div className="mt-4">{qaytaUrin}</div>}
    </div>
  );
}

export function RuxsatYoq({ bolim }: { bolim: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-8 text-center">
      <p className="font-medium text-fg">Bu bo&apos;lim sizning rolingizga ochiq emas</p>
      <p className="text-sm text-muted mt-1">
        &quot;{bolim}&quot; bo&apos;limini ko&apos;rish uchun kengroq huquq kerak. Kerak bo&apos;lsa
        ROOT superadminga murojaat qiling.
      </p>
    </div>
  );
}
