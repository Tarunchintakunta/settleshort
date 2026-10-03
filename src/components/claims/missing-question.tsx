"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChatCircleDotsIcon } from "@phosphor-icons/react";
import { Alert, Button, inputCls } from "@/components/ui";
import { api } from "@/lib/client";
import type { MissingQuestion } from "@/lib/evidence";

/** Asks for the single next missing piece, nothing else. Answering it doesn't touch any other field. */
export function MissingQuestionCard({ claimId, questions }: { claimId: string; questions: MissingQuestion[] }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const q = questions[0];
  if (!q) return null;
  const json = q.field === "amount" ? { amountCents: Math.round(Number(value) * 100) } : { [q.field]: value.trim() };
  return (
    <section className="rise mb-8 rounded-[12px] border border-accent/25 bg-accent-soft p-5 shadow-soft" aria-labelledby="missing-h">
      <h2 id="missing-h" className="flex items-center gap-2 text-sm font-semibold text-accent">
        <ChatCircleDotsIcon className="size-4" weight="fill" aria-hidden /> {questions.length === 1 ? "One thing missing" : `${questions.length} things missing, one at a time`}
      </h2>
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            await api(`/claims/${claimId}`, { method: "PATCH", json });
            setValue("");
            router.refresh();
          } catch (x) {
            setErr((x as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="flex min-w-[260px] flex-1 flex-col gap-1.5">
          <span className="text-[15px] font-medium text-ink">{q.question}</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            type={q.field === "txnDate" ? "date" : "text"}
            inputMode={q.field === "amount" ? "decimal" : undefined}
            placeholder={q.placeholder}
            className={inputCls}
            autoComplete="off"
            required
          />
        </label>
        <Button disabled={busy || !value.trim()}>Answer</Button>
      </form>
      {err && (
        <div className="mt-2">
          <Alert>{err}</Alert>
        </div>
      )}
    </section>
  );
}
