"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, inputCls, Pill } from "@/components/ui";
import { api } from "@/lib/client";

type Props = {
  claimId: string;
  kind: string;
  depositStatus: string | null;
  depositNote: string | null;
  recoverableClient: string | null;
  recoveryStatus: string | null;
  recoveryRef: string | null;
  canEdit: boolean;
  isAdmin: boolean;
};

const DEP: Record<string, ["warning" | "success" | "neutral", string]> = { held: ["warning", "Deposit held"], returned: ["success", "Deposit returned"], consumed: ["neutral", "Deposit used up"] };
const REC: Record<string, string> = { to_invoice: "To invoice", invoiced: "Invoiced", recovered: "Recovered", written_off: "Written off" };

/** Refundable deposits and costs to bill a client: tracked separately from what the employee is owed. */
export function TrackingCard(p: Props) {
  const router = useRouter();
  const [client, setClient] = useState(p.recoverableClient ?? "");
  const [ref, setRef] = useState(p.recoveryRef ?? "");
  const [err, setErr] = useState<string | null>(null);
  const patch = async (json: Record<string, unknown>) => {
    setErr(null);
    try {
      await api(`/claims/${p.claimId}/tracking`, { method: "PATCH", json });
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <section aria-labelledby="track-h" className="rounded-[12px] border border-line bg-panel p-4 text-sm shadow-soft">
      <h2 id="track-h" className="text-[15px] font-semibold tracking-[-0.015em]">
        Deposit and client billing
      </h2>
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {p.kind === "deposit" && p.depositStatus ? (
            <Pill tone={DEP[p.depositStatus][0]} dot>
              {DEP[p.depositStatus][1]}
            </Pill>
          ) : (
            <span className="text-muted">Regular expense</span>
          )}
          {p.canEdit && p.kind !== "deposit" && (
            <Button size="sm" variant="ghost" onClick={() => patch({ kind: "deposit" })}>
              It&apos;s a refundable deposit
            </Button>
          )}
          {p.isAdmin && p.kind === "deposit" && p.depositStatus === "held" && (
            <>
              <Button size="sm" variant="secondary" onClick={() => patch({ depositStatus: "returned", returnedTo: "company", depositNote: "Returned to the company account" })}>
                Returned to company
              </Button>
              <Button size="sm" variant="secondary" onClick={() => patch({ depositStatus: "returned", returnedTo: "employee", depositNote: "Refunded to the employee's card" })}>
                Refunded to employee
              </Button>
              <Button size="sm" variant="ghost" onClick={() => patch({ depositStatus: "consumed", depositNote: "Kept against damage or fees" })}>
                Used up
              </Button>
            </>
          )}
        </div>
        {p.depositNote && <p className="text-xs text-muted">{p.depositNote}</p>}

        <div className="flex flex-wrap items-center gap-2">
          {p.recoverableClient ? (
            <>
              <span>
                Bill to <b className="font-medium">{p.recoverableClient}</b>
              </span>
              <Pill tone={p.recoveryStatus === "recovered" ? "success" : "accent"}>{REC[p.recoveryStatus ?? "to_invoice"]}</Pill>
              {p.canEdit &&
                (["invoiced", "recovered", "written_off"] as const)
                  .filter((s) => s !== p.recoveryStatus && (p.isAdmin || s === "invoiced"))
                  .map((s) => (
                    <Button key={s} size="sm" variant="ghost" onClick={() => patch({ recoveryStatus: s, recoveryRef: ref || undefined })}>
                      Mark {REC[s].toLowerCase()}
                    </Button>
                  ))}
            </>
          ) : (
            p.canEdit && (
              <form
                className="flex flex-wrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  patch({ recoverableClient: client.trim() });
                }}
              >
                <input aria-label="Client to bill" placeholder="Bill this to a client? Name them" value={client} onChange={(e) => setClient(e.target.value)} className={`${inputCls} h-9 w-56`} autoComplete="off" required />
                <Button size="sm" variant="secondary">
                  Flag as recoverable
                </Button>
              </form>
            )
          )}
        </div>
        {p.recoverableClient && p.canEdit && (
          <input aria-label="Invoice reference" placeholder="Invoice reference (optional)" value={ref} onChange={(e) => setRef(e.target.value)} className={`${inputCls} h-9 w-56`} autoComplete="off" />
        )}
        {p.recoveryRef && <p className="text-xs text-muted">Reference: {p.recoveryRef}</p>}
      </div>
      {err && (
        <div className="mt-2">
          <Alert>{err}</Alert>
        </div>
      )}
    </section>
  );
}
