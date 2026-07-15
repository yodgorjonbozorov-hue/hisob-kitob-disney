export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-5 ${className}`}>
      {children}
    </div>
  );
}
