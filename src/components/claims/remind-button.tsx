"use client";

import { useState } from "react";
import { BellIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui";
import { api } from "@/lib/client";

/** Sends the explained reminder (Slack when connected) and shows exactly what was said. */
export function RemindButton({ claimId }: { claimId: string }) {
  const [out, setOut] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-2">
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await api<{ text: string; delivered: string }>(`/claims/${claimId}/remind`, { method: "POST" });
            setOut(`${r.delivered === "slack" ? "Sent to Slack" : "Logged (connect Slack to deliver)"}: ${r.text}`);
          } catch (e) {
            setOut((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <BellIcon className="size-4" aria-hidden /> Send reminder
      </Button>
      {out && <p className="mt-1.5 text-xs text-muted">{out}</p>}
    </div>
  );
}
