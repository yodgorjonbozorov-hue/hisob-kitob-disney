"use client";

import { ModuleError } from "@/components/ui/ModuleError";

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ModuleError modul="Jarima & Bonus" {...props} />;
}
