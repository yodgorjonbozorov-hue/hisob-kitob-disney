import { Yuklanmoqda } from "@/components/superadmin/Holatlar";

export default function ControlCenterLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 rounded-lg bg-surface-2 animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-surface-2 animate-pulse" />
        ))}
      </div>
      <Yuklanmoqda />
    </div>
  );
}
