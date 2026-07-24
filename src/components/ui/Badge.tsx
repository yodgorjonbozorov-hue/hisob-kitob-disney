export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "kirim" | "chiqim" | "neutral" | "warning" | "info";
}) {
  const toneClasses = {
    kirim: "bg-income-soft text-income-fg",
    chiqim: "bg-expense-soft text-expense-fg",
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    info: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    neutral: "bg-surface-2 text-muted",
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-medium ${toneClasses}`}
    >
      {children}
    </span>
  );
}
