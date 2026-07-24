export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-surface rounded-2xl shadow-card border border-line p-5 ${className}`}>
      {children}
    </div>
  );
}
