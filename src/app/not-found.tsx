import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { BRAND } from "@/lib/brand";

/** 404 — Next.js'ning inglizcha "This page could not be found" ekrani o'rniga. */
export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <p className="text-4xl mb-4">🔎</p>
        <h1 className="text-xl font-semibold text-fg">Sahifa topilmadi</h1>
        <p className="text-sm text-muted mt-2">
          Bu manzilda sahifa yo&apos;q — havola eskirgan yoki noto&apos;g&apos;ri yozilgan bo&apos;lishi mumkin.
        </p>
        <div className="flex gap-2 justify-center mt-6">
          <Link href="/app">
            <Button>Bosh sahifa</Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary">Kirish</Button>
          </Link>
        </div>
        <p className="text-2xs text-faint mt-6">
          {BRAND.nomi} · {BRAND.domen}
        </p>
      </div>
    </div>
  );
}
