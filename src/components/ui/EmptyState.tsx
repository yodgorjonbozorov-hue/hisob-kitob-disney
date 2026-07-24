import { ReactNode } from "react";

/** Bo'sh holat — ikonka + bir qatorli izoh + ixtiyoriy asosiy amal (CTA). */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className = "",
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-12 px-4 ${className}`}>
      <div className="w-12 h-12 rounded-2xl bg-surface-2 text-faint flex items-center justify-center mb-3 text-xl">
        {icon ?? "∅"}
      </div>
      <p className="font-medium text-fg">{title}</p>
      {description && <p className="text-sm text-muted mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
