"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function TelegramLinkButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    setOpen(true);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/me/telegram-link-code", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Xatolik yuz berdi");
        return;
      }
      setCode(data.code);
      setBotUsername(data.botUsername);
    } catch {
      setError("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button onClick={handleOpen} className={className}>
        Telegram bot bilan bog'lash
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Telegram botga ulanish">
        {loading && <p className="text-sm text-muted">Kod yaratilmoqda...</p>}
        {error && <p className="text-sm text-expense">{error}</p>}
        {code && (
          <div className="space-y-3 text-sm">
            <p className="text-muted">
              {botUsername ? (
                <>
                  Telegram'da <span className="font-medium">@{botUsername}</span> botini toping va quyidagi buyruqni
                  yuboring:
                </>
              ) : (
                <>Kompaniya Telegram botini toping va quyidagi buyruqni yuboring:</>
              )}
            </p>
            <div className="bg-surface-2 rounded-lg px-4 py-3 text-center font-mono text-lg tracking-widest">
              /kod {code}
            </div>
            <p className="text-xs text-faint">Kod 10 daqiqa amal qiladi. Hech kimga bermang.</p>
          </div>
        )}
        <div className="flex justify-end pt-4">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Yopish
          </Button>
        </div>
      </Modal>
    </>
  );
}
