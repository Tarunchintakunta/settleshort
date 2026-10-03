"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button } from "@/components/ui";
import { api } from "@/lib/client";

/** The receiver closes the loop: money arrived, or it didn't. */
export function ConfirmReceipt({ itemId, amount }: { itemId: string; amount: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const send = async (received: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/payouts/${itemId}/confirm`, { json: { received } });
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-4 border-t border-line pt-4">
      <p className="text-[13px] text-ink-2">
        Did <span className="money font-medium text-ink">{amount}</span> arrive in your PayPal account?
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="approve" disabled={busy} onClick={() => send(true)}>
          Yes, I received it
        </Button>
        <Button size="sm" variant="danger" disabled={busy} onClick={() => send(false)}>
          No, it&apos;s missing
        </Button>
      </div>
      {err && (
        <div className="mt-2">
          <Alert>{err}</Alert>
        </div>
      )}
    </div>
  );
}
