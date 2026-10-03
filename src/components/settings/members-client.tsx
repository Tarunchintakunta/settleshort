"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserPlusIcon } from "@phosphor-icons/react";
import { Button, Field, inputCls } from "@/components/ui";
import { api } from "@/lib/client";

type Member = { id: string; name: string; email: string; role: string; paypalEmail: string | null; membershipId: string; canRelease: boolean; paypalVerifiedAt: Date | string | null; approvalLimitCents: number | null; escalatesToUserId: string | null; offboardedAt: Date | string | null };

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

/** Payee verification: an admin (never the person themselves) confirms the PayPal address is theirs. */
export function VerifyPaypal({ m, canVerify }: { m: Member; canVerify: boolean }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  if (m.paypalVerifiedAt) return <span className="text-xs font-medium text-success">Verified</span>;
  if (!m.paypalEmail) return <span className="text-xs text-muted">No address</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-xs font-medium text-warning">Unverified</span>
      {canVerify && (
        <Button
          size="sm"
          variant="secondary"
          title="Confirm this PayPal address belongs to them. Payouts are blocked until then."
          onClick={async () => {
            setErr(null);
            try {
              await api(`/members/${m.membershipId}`, { method: "PATCH", json: { verifyPaypal: true } });
              router.refresh();
            } catch (x) {
              setErr((x as Error).message);
            }
          }}
        >
          Verify
        </Button>
      )}
      {err && <span className="text-xs text-danger">{err}</span>}
    </span>
  );
}

/** Largest claim someone may approve alone. Set by another admin, never by the person themselves. */
export function LimitCell({ m, canEdit }: { m: Member; canEdit: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(m.approvalLimitCents != null ? String(m.approvalLimitCents / 100) : "");
  const [err, setErr] = useState<string | null>(null);
  if (m.role === "member") return <span className="text-xs text-muted">Doesn&apos;t approve</span>;
  if (!canEdit) return <span className="money text-xs">{m.approvalLimitCents != null ? `up to ${(m.approvalLimitCents / 100).toFixed(2)}` : "No limit"}</span>;
  const changed = v !== (m.approvalLimitCents != null ? String(m.approvalLimitCents / 100) : "");
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        try {
          await api(`/members/${m.membershipId}`, { method: "PATCH", json: { approvalLimitCents: v ? Math.round(Number(v) * 100) : null } });
          router.refresh();
        } catch (x) {
          setErr((x as Error).message);
        }
      }}
    >
      <input aria-label={`Approval limit for ${m.name}`} inputMode="decimal" placeholder="No limit" value={v} onChange={(e) => setV(e.target.value)} className={`${inputCls} money h-9 w-28 text-xs`} />
      {changed && (
        <Button size="sm" variant="secondary">
          Save
        </Button>
      )}
      {err && <span className="text-xs text-danger">{err}</span>}
    </form>
  );
}

type Del = { id: string; fromUserId: string; toUserId: string; endsAt: string };

/** Holiday cover: hand your approvals to a teammate until a date; it ends on its own. */
export function DelegationPanel({ me, members, rows, canDelegate }: { me: string; members: { id: string; name: string }[]; rows: Del[]; canDelegate: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({ to: "", until: "" });
  const [err, setErr] = useState<string | null>(null);
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "Unknown";
  return (
    <section className="mb-8 rounded-[12px] border border-line p-6 shadow-soft">
      <h2 className="mb-1 text-[15px] font-semibold tracking-[-0.015em]">Approval cover</h2>
      <p className="mb-4 text-sm text-muted">Going away? Hand your approval authority to a teammate until a date. Every approval they make records that it was on your behalf.</p>
      <ul className="mb-4 space-y-1 text-sm">
        {rows.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-2">
            {name(d.toUserId)} covers for {name(d.fromUserId)} until {new Date(d.endsAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
            {d.fromUserId === me && (
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await api(`/delegations/${d.id}`, { method: "DELETE" });
                  router.refresh();
                }}
              >
                End now
              </Button>
            )}
          </li>
        ))}
        {!rows.length && <li className="text-muted">Nobody is covering for anyone.</li>}
      </ul>
      {canDelegate && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            try {
              await api("/delegations", { json: { toUserId: f.to, endsAt: f.until } });
              setF({ to: "", until: "" });
              router.refresh();
            } catch (x) {
              setErr((x as Error).message);
            }
          }}
        >
          <select aria-label="Who covers" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className={`${inputCls} w-auto`} required>
            <option value="">Who covers for me</option>
            {members
              .filter((m) => m.id !== me)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
          <input aria-label="Until" type="date" value={f.until} onChange={(e) => setF({ ...f, until: e.target.value })} className={`${inputCls} w-auto`} required />
          <Button size="sm" variant="secondary">
            Hand over
          </Button>
          {err && <span className="text-xs text-danger">{err}</span>}
        </form>
      )}
    </section>
  );
}

/** Who an overdue approval escalates to after this person. */
export function EscalatesTo({ m, members, canEdit }: { m: Member; members: { id: string; name: string }[]; canEdit: boolean }) {
  const router = useRouter();
  if (m.role === "member") return null;
  return (
    <select
      aria-label={`Escalation after ${m.name}`}
      disabled={!canEdit}
      value={m.escalatesToUserId ?? ""}
      onChange={async (e) => {
        await api(`/members/${m.membershipId}`, { method: "PATCH", json: { escalatesToUserId: e.target.value || null } });
        router.refresh();
      }}
      className={`${inputCls} mt-1 h-8 w-auto text-xs`}
    >
      <option value="">Escalates to: owner</option>
      {members
        .filter((x) => x.id !== m.id)
        .map((x) => (
          <option key={x.id} value={x.id}>
            Escalates to: {x.name}
          </option>
        ))}
    </select>
  );
}

type Report = {
  owedToThem: { claim: { number: number; vendor: string; currency: string }; cents: number }[];
  owedByThem: { claim: { number: number; vendor: string; currency: string }; cents: number }[];
  openClaims: { number: number; vendor: string }[];
  waitingOnThem: { number: number; vendor: string }[];
  subscriptions: { vendor: string; months: string[] }[];
  delegations: unknown[];
};
const fmt = (c: number, cur: string) => new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(c / 100);

/** Shows everything unresolved with a leaving teammate, then removes their access once confirmed. */
export function OffboardButton({ m }: { m: Member }) {
  const router = useRouter();
  const [r, setR] = useState<Report | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (m.offboardedAt) return <span className="text-xs text-muted">Left the company</span>;
  if (m.role === "owner") return null;
  const lines = r
    ? [
        ...r.owedToThem.map((x) => `Company still owes them ${fmt(x.cents, x.claim.currency)} on #${x.claim.number} ${x.claim.vendor}`),
        ...r.owedByThem.map((x) => `They owe back ${fmt(x.cents, x.claim.currency)} on #${x.claim.number} ${x.claim.vendor}`),
        ...r.openClaims.map((c) => `Their claim #${c.number} ${c.vendor} isn't approved yet`),
        ...r.waitingOnThem.map((c) => `#${c.number} ${c.vendor} waits on their approval; it will escalate`),
        ...r.subscriptions.map((s) => `They pay for ${s.vendor} personally (${s.months.join(", ")}): move it before they go`),
        ...(r.delegations.length ? [`${r.delegations.length} approval cover arrangement(s) will end`] : []),
      ]
    : [];
  return (
    <div className="text-xs">
      {!r ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            setErr(null);
            try {
              setR(await api<Report>(`/members/${m.membershipId}/offboard`));
            } catch (x) {
              setErr((x as Error).message);
            }
          }}
        >
          Offboard…
        </Button>
      ) : (
        <div className="mt-1 max-w-sm rounded-[8px] border border-line bg-sunken p-3">
          <p className="font-medium">Before {m.name} leaves</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {lines.length ? lines.map((l) => <li key={l}>{l}</li>) : <li>Nothing open. Safe to offboard.</li>}
          </ul>
          <p className="mt-2 text-muted">Offboarding removes app access. Anything owed either way stays tracked until settled.</p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="danger"
              onClick={async () => {
                try {
                  await api(`/members/${m.membershipId}/offboard`, { method: "POST" });
                  router.refresh();
                } catch (x) {
                  setErr((x as Error).message);
                }
              }}
            >
              Offboard {m.name.split(" ")[0]}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setR(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {err && <span className="text-danger">{err}</span>}
    </div>
  );
}
