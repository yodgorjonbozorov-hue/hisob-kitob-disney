"use client";

import { useRouter, usePathname } from "next/navigation";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";

export function AuditFilters({ initial }: { initial: { entity: string; action: string } }) {
  const router = useRouter();
  const pathname = usePathname();

  function apply(patch: { entity?: string; action?: string }) {
    const next = { ...initial, ...patch };
    const params = new URLSearchParams();
    if (next.entity) params.set("entity", next.entity);
    if (next.action) params.set("action", next.action);
    router.push(`${pathname}${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div>
        <span className="block text-xs font-medium text-muted mb-1">Amal</span>
        <Segmented
          value={initial.action}
          onChange={(v) => apply({ action: v })}
          options={[
            { value: "", label: "Barchasi" },
            { value: "create", label: "Yaratildi" },
            { value: "update", label: "O'zgartirildi" },
            { value: "delete", label: "O'chirildi" },
          ]}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted mb-1" htmlFor="audit-obyekt">
          Obyekt
        </label>
        <Select
          id="audit-obyekt"
          value={initial.entity}
          onChange={(v) => apply({ entity: v })}
          className="min-w-[10rem]"
          options={[
            { value: "", label: "Barchasi" },
            { value: "transaction", label: "Tranzaksiya" },
            { value: "user", label: "Foydalanuvchi" },
            { value: "category", label: "Kategoriya" },
          ]}
        />
      </div>
    </div>
  );
}
