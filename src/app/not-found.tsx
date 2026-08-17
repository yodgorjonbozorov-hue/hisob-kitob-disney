import { SearchX } from "lucide-react";
import { LinkButton } from "@/components/ui/LinkButton";
import { BRAND } from "@/lib/brand";

/** 404 — Next.js'ning inglizcha "This page could not be found" ekrani o'rniga. */
export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-surface-2 text-muted mb-4">
          <SearchX className="w-7 h-7" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <h1 className="font-heading text-lg font-semibold text-fg">Sahifa topilmadi</h1>
        <p className="text-sm text-muted mt-2">
          Bu manzilda sahifa yo&apos;q — havola eskirgan yoki noto&apos;g&apos;ri yozilgan bo&apos;lishi mumkin.
        </p>
        <div className="flex gap-2 justify-center mt-6">
          <LinkButton href="/app">Bosh sahifa</LinkButton>
          <LinkButton href="/login" variant="secondary">
            Kirish
          </LinkButton>
        </div>
        <p className="text-2xs text-faint mt-6">
          {BRAND.nomi} · {BRAND.domen}
        </p>
      </div>
    </div>
  );
}
