import { son } from "./turlar";

/**
 * KOMPAKT XULOSA — faqat ro'yxatning O'ZIDAN hisoblanadigan to'rt raqam.
 * Qo'shimcha so'rov ham, taxminiy ko'rsatkich ham yo'q.
 */
export function Xulosa({
  jami,
  faol,
  nofaol,
  tranzaksiyalar,
}: {
  jami: number;
  faol: number;
  nofaol: number;
  tranzaksiyalar: number;
}) {
  const qatorlar = [
    { nomi: "Jami bizneslar", qiymat: jami },
    { nomi: "Faol", qiymat: faol },
    { nomi: "Nofaol", qiymat: nofaol },
    { nomi: "Jami tranzaksiyalar", qiymat: tranzaksiyalar },
  ];
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-2xl border border-line bg-line overflow-hidden">
      {qatorlar.map((q) => (
        <div key={q.nomi} className="bg-surface px-4 py-3">
          <dt className="text-2xs text-faint uppercase tracking-wide">{q.nomi}</dt>
          <dd className="text-xl font-semibold text-fg tnum mt-0.5">{son(q.qiymat)}</dd>
        </div>
      ))}
    </dl>
  );
}
