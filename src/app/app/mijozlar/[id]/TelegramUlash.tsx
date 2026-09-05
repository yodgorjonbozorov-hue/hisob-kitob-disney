"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatToshkentVaqt } from "@/lib/format";
import type { MijozTelegramDTO } from "@/lib/queries/mijozTelegram";

/**
 * MIJOZ KARTOCHKASIDAGI TELEGRAM BLOKI (spec 15).
 *
 * "Telegramga ulash" bosilganda BIR MARTALIK havola va QR chiqadi: sotuvchi
 * mijozga QR'ni ko'rsatadi yoki havolani yuboradi. Havola har bosishda
 * YANGILANADI — eskisi darhol kuchini yo'qotadi.
 */
export function TelegramUlash({
  contactId,
  boshlangich,
  boshqaruvchi,
}: {
  contactId: string;
  boshlangich: MijozTelegramDTO;
  /** Ulanishni uzish faqat direktor/adminda. */
  boshqaruvchi: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [xato, setXato] = useState<string | null>(null);
  const [havola, setHavola] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  async function havolaYarat() {
    setBusy(true);
    setXato(null);
    try {
      const res = await fetch(`/api/mijozlar/${contactId}/telegram`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Havola yaratilmadi");
        return;
      }
      setHavola(data.havola);
      setQr(data.qr);
      setModal(true);
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setBusy(false);
    }
  }

  async function uz() {
    setBusy(true);
    setXato(null);
    try {
      const res = await fetch(`/api/mijozlar/${contactId}/telegram`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setXato(data.error ?? "Uzilmadi");
        return;
      }
      router.refresh();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-muted text-sm mb-1">Telegram</p>
          {boshlangich.ulangan ? (
            <>
              <Badge tone="kirim">✅ Ulangan</Badge>
              <p className="text-2xs text-faint mt-1">
                {boshlangich.username ? `@${boshlangich.username} · ` : ""}
                {boshlangich.ulanganAt
                  ? formatToshkentVaqt(new Date(boshlangich.ulanganAt))
                  : ""}
              </p>
            </>
          ) : (
            <>
              <Badge tone="neutral">⚪ Ulanmagan</Badge>
              <p className="text-2xs text-faint mt-1">
                {boshlangich.kutilayotganHavola
                  ? "Havola yuborilgan — mijoz hali bosmagan"
                  : "Xaridlar Telegramga yuborilmaydi"}
              </p>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={havolaYarat} loading={busy}>
            {boshlangich.ulangan ? "Yangi havola" : "Telegramga ulash"}
          </Button>
          {boshlangich.ulangan && boshqaruvchi && (
            <Button variant="secondary" size="sm" onClick={uz} disabled={busy}>
              Uzish
            </Button>
          )}
        </div>
      </div>
      {xato && <p className="text-2xs text-expense-fg mt-2">{xato}</p>}

      {modal && (
        <Modal open onClose={() => setModal(false)} title="Telegramga ulash">
          <div className="space-y-3">
            {havola ? (
              <>
                <p className="text-sm text-muted">
                  Mijoz shu QR&apos;ni skanerlasin yoki havolani bossin. Havola BIR MARTALIK
                  va 7 kun amal qiladi.
                </p>
                {qr && (
                  <div className="flex justify-center">
                    <Image
                      src={qr}
                      alt="Telegram ulanish QR kodi"
                      width={240}
                      height={240}
                      unoptimized
                      className="rounded-lg border border-line"
                    />
                  </div>
                )}
                <p className="text-2xs text-faint break-all bg-surface border border-line rounded-lg px-3 py-2">
                  {havola}
                </p>
              </>
            ) : (
              <p className="text-sm text-expense-fg">
                Bot manzili sozlanmagan (TELEGRAM_BOT_USERNAME). Administratorga murojaat
                qiling — havola shusiz yasalmaydi.
              </p>
            )}
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setModal(false)}>
                Yopish
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}
