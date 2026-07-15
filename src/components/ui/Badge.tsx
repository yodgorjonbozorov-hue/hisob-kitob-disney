export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "kirim" | "chiqim" | "neutral";
}) {
  const toneClasses = {
    kirim: "bg-emerald-100 text-emerald-700",
    chiqim: "bg-rose-100 text-rose-700",
    neutral: "bg-slate-100 text-slate-600",
  }[tone];

  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${toneClasses}`}>
      {children}
    </span>
  );
}
