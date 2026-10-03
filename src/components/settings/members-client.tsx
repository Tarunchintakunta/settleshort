"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserPlusIcon } from "@phosphor-icons/react";
import { Button, Field, inputCls } from "@/components/ui";
import { api } from "@/lib/client";

type Member = { id: string; name: string; email: string; role: string; paypalEmail: string | null; membershipId: string; canRelease: boolean };

export function InviteForm() {
  const router = useRouter();
  const [f, setF] = useState({ name: "", email: "", paypalEmail: "", role: "member" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <section className="rounded-[12px] border border-line p-6 shadow-soft">
      <h2 className="mb-5 flex items-center gap-2 text-[15px] font-semibold tracking-[-0.015em]">
        <UserPlusIcon className="size-4" aria-hidden /> Add a teammate
      </h2>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMsg(null);
          try {
            await api("/members/invite", { json: f });
            setMsg({ ok: true, text: `${f.name} added. They sign up with ${f.email} to log in.` });
            setF({ name: "", email: "", paypalEmail: "", role: "member" });
            router.refresh();
          } catch (err) {
            setMsg({ ok: false, text: (err as Error).message });
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Name">
          <input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Email">
          <input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={inputCls} />
        </Field>
        <Field label="PayPal receiver email" hint="Their PayPal sandbox account. Defaults to their email.">
          <input type="email" value={f.paypalEmail} onChange={(e) => setF({ ...f, paypalEmail: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Role">
          <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} className={inputCls}>
            <option value="member">Member: submits claims</option>
            <option value="admin">Admin: approves payouts</option>
          </select>
        </Field>
        <div className="sm:col-span-2 flex items-center gap-3">
          <Button disabled={busy}>Add member</Button>
          {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
        </div>
      </form>
    </section>
  );
}

export function PaypalEmailCell({ m, canEdit }: { m: Member; canEdit: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(m.paypalEmail ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | string>("idle");
  if (!canEdit) return <span className="font-mono text-xs">{m.paypalEmail ?? "Not set"}</span>;
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("saving");
        try {
          await api(`/members/${m.membershipId}`, { method: "PATCH", json: { paypalReceiverEmail: v } });
          setState("saved");
          router.refresh();
        } catch (err) {
          setState((err as Error).message);
        }
      }}
    >
      <input aria-label={`PayPal email for ${m.name}`} type="email" value={v} onChange={(e) => setV(e.target.value)} className={`${inputCls} h-9 min-w-0 font-mono text-xs sm:min-w-[220px]`} />
      {v !== (m.paypalEmail ?? "") && (
        <Button size="sm" variant="secondary" disabled={state === "saving"}>
          Save
        </Button>
      )}
      {state === "saved" && v === m.paypalEmail && <span className="text-xs text-success">Saved</span>}
      {!["idle", "saving", "saved"].includes(state) && <span className="text-xs text-danger">{state}</span>}
    </form>
  );
}

/** Release authority: may send approved money to PayPal. Approving claims is separate. */
export function ReleaseToggle({ m, canEdit }: { m: Member; canEdit: boolean }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <label className="inline-flex items-center gap-2 text-xs">
      <input
        type="checkbox"
        checked={m.canRelease}
        disabled={!canEdit || busy}
        onChange={async (e) => {
          setBusy(true);
          setErr(null);
          try {
            await api(`/members/${m.membershipId}`, { method: "PATCH", json: { canRelease: e.target.checked } });
            router.refresh();
          } catch (x) {
            setErr((x as Error).message);
          } finally {
            setBusy(false);
          }
        }}
        className="size-4 accent-[var(--accent)]"
        aria-label={`Release authority for ${m.name}`}
      />
      <span className={m.canRelease ? "text-ink" : "text-muted"}>{m.canRelease ? "Can release" : "No"}</span>
      {err && <span className="text-danger">{err}</span>}
    </label>
  );
}
