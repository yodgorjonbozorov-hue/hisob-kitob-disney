/**
 * XODIM AVATARI — rasm bo'lsa rasm, bo'lmasa ismning bosh harflari.
 * Rang ism hashidan chiqariladi (bir xil ism doim bir xil rang — chart
 * palitrasidan, dark/light ikkalasida ham o'qiladi).
 */
const RANGLAR = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

const OLCHAM = {
  sm: "w-9 h-9 text-xs",
  md: "w-12 h-12 text-sm",
  lg: "w-16 h-16 text-lg",
} as const;

export function boshHarflar(ism: string): string {
  const qismlar = ism.trim().split(/\s+/).filter(Boolean);
  if (qismlar.length === 0) return "?";
  if (qismlar.length === 1) return qismlar[0].slice(0, 2).toUpperCase();
  return (qismlar[0][0] + qismlar[1][0]).toUpperCase();
}

function rangIndex(ism: string): number {
  let h = 0;
  for (let i = 0; i < ism.length; i++) h = (h * 31 + ism.charCodeAt(i)) | 0;
  return Math.abs(h) % RANGLAR.length;
}

export function XodimAvatar({
  ism,
  rasmUrl,
  size = "md",
}: {
  ism: string;
  rasmUrl: string | null;
  size?: keyof typeof OLCHAM;
}) {
  if (rasmUrl) {
    return (
      <span
        className={`${OLCHAM[size]} shrink-0 rounded-full overflow-hidden bg-surface-2 border border-line inline-flex`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={rasmUrl} alt={ism} className="w-full h-full object-cover" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={`${OLCHAM[size]} ${RANGLAR[rangIndex(ism)]} shrink-0 rounded-full inline-flex items-center justify-center font-bold text-white`}
    >
      {boshHarflar(ism)}
    </span>
  );
}
