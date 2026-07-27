"use client";

import { useRouter, usePathname } from "next/navigation";
import { Segmented } from "@/components/ui/Segmented";

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
        <span className="block text-xs font-medium text-muted mb-1">Obyekt</span>
        <select
          value={initial.entity}
          onChange={(e) => apply({ entity: e.target.value })}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm min-h-[40px]"
        >
          <option value="">Barchasi</option>
          <option value="transaction">Tranzaksiya</option>
          <option value="user">Foydalanuvchi</option>
          <option value="category">Kategoriya</option>
        </select>
      </div>
    </div>
  );
}
