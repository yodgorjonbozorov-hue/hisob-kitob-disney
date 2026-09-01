"use client";

import { ModuleError } from "@/components/ui/ModuleError";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ModuleError modul="Xodimlar KPI" error={error} reset={reset} />;
}
