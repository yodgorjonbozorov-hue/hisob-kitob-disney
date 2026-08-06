"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

/**
 * Hujjat biriktirish. Ikki rejim:
 *  - havola (har doim ishlaydi);
 *  - fayl yuklash (saqlagich sozlangan bo'lsa).
 */
export function IlovaModal({
  entity,
  entityId,
  sarlavha,
  yuklashMumkin,
  onClose,
  onDone,
}: {
  entity: string;
  entityId: string;
  sarlavha: string;
  yuklashMumkin: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [rejim, setRejim] = useState<"havola" | "fayl">(yuklashMumkin ? "fayl" : "havola");
  const [nomi, setNomi] = useState("");
  const [url, setUrl] = useState("");
  const [fayl, setFayl] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setXato(null);
    try {
      let res: Response;
      if (rejim === "fayl") {
        if (!fayl) {
          setXato("Fayl tanlanmagan");
          return;
        }
        const form = new FormData();
        form.append("entity", entity);
        form.append("entityId", entityId);
        form.append("nomi", nomi || fayl.name);
        form.append("fayl", fayl);
        res = await fetch("/api/hujjatlar/ilova", { method: "POST", body: form });
      } else {
        res = await fetch("/api/hujjatlar/ilova", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entity, entityId, nomi, url }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      onDone();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  const input = "w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg";

  return (
    <Modal open onClose={onClose} title={`Hujjat biriktirish — ${sarlavha}`}>
      <form onSubmit={submit} className="space-y-3">
        {yuklashMumkin && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={rejim === "fayl" ? "primary" : "secondary"}
              onClick={() => setRejim("fayl")}
            >
              Fayl yuklash
            </Button>
            <Button
              size="sm"
              variant={rejim === "havola" ? "primary" : "secondary"}
              onClick={() => setRejim("havola")}
            >
              Havola
            </Button>
          </div>
        )}

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="i-nomi">
            Hujjat nomi
          </label>
          <input
            id="i-nomi"
            value={nomi}
            onChange={(e) => setNomi(e.target.value)}
            required={rejim === "havola"}
            maxLength={200}
            placeholder={rejim === "fayl" ? "Bo'sh qoldirilsa fayl nomi olinadi" : "Masalan: Shartnoma skani"}
            className={input}
          />
        </div>

        {rejim === "fayl" ? (
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="i-fayl">
              Fayl
            </label>
            <input
              id="i-fayl"
              type="file"
              onChange={(e) => setFayl(e.target.files?.[0] ?? null)}
              className={input}
            />
            <p className="text-2xs text-faint mt-1">
              PDF, rasm, Word, Excel yoki matn. 10 MB gacha.
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="i-url">
              Havola
            </label>
            <input
              id="i-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              maxLength={2000}
              placeholder="https://drive.google.com/..."
              className={input}
            />
            {!yuklashMumkin && (
              <p className="text-2xs text-faint mt-1">
                Fayl saqlagich sozlanmagan, shuning uchun hozircha faqat tashqi havola
                biriktiriladi.
              </p>
            )}
          </div>
        )}

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={loading}>
            Biriktirish
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
