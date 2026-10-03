"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRightIcon, ChatTextIcon, CheckIcon, FilePdfIcon, QuotesIcon, UploadSimpleIcon, WarningIcon } from "@phosphor-icons/react";
import { Alert, Button, ButtonLink, Confidence, cx, PROVIDER_LABEL, tabBtn, tabTrack } from "@/components/ui";
import { api } from "@/lib/client";
import { formatMoney } from "@/lib/money";

type Claim = {
  id: string;
  number: number;
  vendor: string;
  amountCents: number;
  currency: string;
  txnDate: string | null;
  tipCents: number;
  taxCents: number;
  status: string;
  aiConfidence: number | null;
  duplicateOfId: string | null;
  aiJson: {
    provider?: string;
    evidence?: Record<string, string>;
    payment_last4?: string | null;
    line_items?: { name: string; amount_cents: number }[];
    payee_names?: string[];
    notes?: string;
  } | null;
  matchJson: { rationale?: string; candidates?: { number?: number; score: number }[] } | null;
};

const SAMPLES = [
  { file: "/demo/receipts/coffee_shop_18_40.png", label: "Coffee receipt", kind: "PNG" },
  { file: "/demo/receipts/team_dinner_186_50.png", label: "Team dinner", kind: "PNG" },
  { file: "/demo/receipts/uber_24_00.pdf", label: "Uber trip", kind: "PDF" },
];
const MESSAGES = ["I paid $42.30 for Uber for @rita yesterday", "Chipotle $64 split me @sam @dev", "Paid ₹1200 at Truffles for @jules @sam"];

type Source = { kind: "image"; url: string; name: string } | { kind: "pdf"; name: string } | { kind: "text"; text: string };

export function NewClaim({ provider, claimCount }: { provider: string; claimCount: number }) {
  const [tab, setTab] = useState<"upload" | "text">("upload");
  const [source, setSource] = useState<Source | null>(null);
  const [claim, setClaim] = useState<Claim | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function reset() {
    setSource(null);
    setClaim(null);
    setError(null);
  }

  async function upload(file: File) {
    reset();
    setSource(file.type === "application/pdf" ? { kind: "pdf", name: file.name } : { kind: "image", url: URL.createObjectURL(file), name: file.name });
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api<{ claim: Claim }>("/claims/upload", { method: "POST", body: fd });
      setClaim(r.claim);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function sample(path: string) {
    const blob = await (await fetch(path)).blob();
    await upload(new File([blob], path.split("/").pop()!, { type: blob.type }));
  }

  async function submitText(t: string) {
    reset();
    setSource({ kind: "text", text: t });
    try {
      setClaim(await api<Claim>("/claims/from-text", { json: { text: t } }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (source) return <Extraction source={source} claim={claim} error={error} provider={provider} claimCount={claimCount} onReset={reset} />;

  return (
    <div className="rise">
      <div role="tablist" className={cx(tabTrack, "mb-5")}>
        {(
          [
            ["upload", "Receipt", UploadSimpleIcon],
            ["text", "Message", ChatTextIcon],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cx(tabBtn(tab === k), "flex items-center gap-2")}
          >
            <Icon className="size-4" aria-hidden /> {label}
          </button>
        ))}
      </div>

      {tab === "upload" ? (
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files[0];
              if (f) upload(f);
            }}
            onClick={() => input.current?.click()}
            className={cx(
              "flex min-h-[320px] cursor-pointer flex-col items-center justify-center rounded-[12px] border border-dashed px-6 text-center transition-colors duration-200",
              drag ? "border-accent bg-accent-soft" : "border-line-strong bg-sunken/60 hover:border-accent/60 hover:bg-sunken",
            )}
          >
            <UploadSimpleIcon className="mb-4 size-7 text-muted" aria-hidden />
            <p className="text-[15px] font-medium">Drop a receipt, or click to choose</p>
            <p className="mt-1 text-sm text-muted">Photo or PDF, up to 10MB</p>
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="sr-only"
              aria-label="Receipt file"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
          </div>
          <div>
            <h2 className="text-sm font-medium">No receipt handy?</h2>
            <p className="mt-1 text-sm text-muted">Run one of these through the same pipeline.</p>
            <ul className="mt-4 space-y-2">
              {SAMPLES.map((s) => (
                <li key={s.file}>
                  <button onClick={() => sample(s.file)} className="flex w-full items-center gap-3 rounded-[10px] border border-line bg-panel px-3 py-2.5 text-left text-sm transition-colors hover:border-line-strong hover:bg-sunken">
                    <span className="flex size-8 items-center justify-center rounded-[6px] bg-sunken font-mono text-[10px] text-muted">{s.kind}</span>
                    <span className="flex-1 font-medium">{s.label}</span>
                    <ArrowRightIcon className="size-4 text-muted" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim().length >= 3) submitText(text.trim());
          }}
          className="grid gap-8 lg:grid-cols-[1.4fr_1fr]"
        >
          <div>
            <label htmlFor="msg" className="mb-1.5 block text-[13px] font-medium text-ink-2">
              Paste the message as it was written
            </label>
            <textarea
              id="msg"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="I paid $84.50 at Chipotle for @sam @rita"
              className="w-full rounded-[10px] border border-line bg-panel p-3.5 text-[15px] leading-relaxed shadow-[inset_0_1px_2px_rgb(18_18_20/0.04)] outline-none transition-[border-color,box-shadow] focus:border-accent focus:ring-3 focus:ring-accent/15"
            />
            <p className="mt-1.5 text-xs text-muted">Mention teammates with @firstname. Dollars and rupees both work.</p>
            <Button type="submit" className="mt-4" disabled={text.trim().length < 3}>
              Create claim
            </Button>
          </div>
          <div>
            <h2 className="text-sm font-medium">From your Slack</h2>
            <ul className="mt-4 space-y-2">
              {MESSAGES.map((m) => (
                <li key={m}>
                  <button type="button" onClick={() => setText(m)} className="w-full rounded-[10px] border border-line bg-sunken/70 px-3 py-2.5 text-left text-sm leading-relaxed transition-colors hover:border-line-strong hover:bg-sunken">
                    {m}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </form>
      )}
    </div>
  );
}

function Extraction({ source, claim, error, provider, claimCount, onReset }: { source: Source; claim: Claim | null; error: string | null; provider: string; claimCount: number; onReset: () => void }) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0); // 0 reading, 1 structuring, 2 matching, 3 done
  const isText = source.kind === "text";

  useEffect(() => {
    if (!claim) return;
    let s = 0;
    const t = setInterval(() => {
      s += 1;
      setStep(s);
      if (s >= 3) clearInterval(t);
    }, reduce ? 0 : 340);
    return () => clearInterval(t);
  }, [claim, reduce]);

  const steps = [
    isText ? `Reading the message with ${PROVIDER_LABEL[provider]}` : provider === "local" ? "Reading text with on-device OCR" : `Reading the receipt with ${PROVIDER_LABEL[provider]}`,
    "Structuring vendor, amount, date and people",
    `Checking ${claimCount} existing claims for duplicates`,
  ];
  const ev = claim?.aiJson?.evidence ?? {};
  const fields: { k: string; v: string; q?: string; big?: boolean; m?: boolean }[] = claim
    ? [
        { k: "Vendor", v: claim.vendor || "Not found", q: ev.vendor },
        { k: "Total", v: formatMoney(claim.amountCents, claim.currency), q: ev.total, big: true, m: true },
        { k: "Date", v: claim.txnDate ? new Date(claim.txnDate + "T00:00:00").toLocaleDateString("en-US", { dateStyle: "medium" }) : "Not found", q: ev.date },
        ...(claim.taxCents ? [{ k: "Tax", v: formatMoney(claim.taxCents, claim.currency), m: true }] : []),
        ...(claim.tipCents ? [{ k: "Tip", v: formatMoney(claim.tipCents, claim.currency), m: true }] : []),
        ...(claim.aiJson?.payment_last4 ? [{ k: "Card", v: `ending ${claim.aiJson.payment_last4}` }] : []),
        ...(claim.aiJson?.payee_names?.length ? [{ k: "For", v: claim.aiJson.payee_names.join(", ") }] : []),
      ]
    : [];
  const dup = claim?.duplicateOfId ? claim.matchJson : null;

  const progress = error ? 100 : !claim ? 12 : Math.min(100, ((Math.min(step, 3) + 1) / 4) * 100);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="relative flex min-h-[380px] items-center justify-center overflow-hidden rounded-[12px] border border-line bg-sunken p-8 shadow-[inset_0_1px_0_rgb(255_255_255/0.45)]">
        {source.kind === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={source.url} alt={source.name} className="relative z-10 max-h-[480px] w-auto rounded-[8px] shadow-pop" />
        )}
        {source.kind === "pdf" && (
          <div className="relative z-10 flex flex-col items-center gap-3 rounded-[12px] border border-line bg-panel px-8 py-10 text-muted shadow-soft">
            <FilePdfIcon className="size-14" weight="light" aria-hidden />
            <span className="font-mono text-xs">{source.name}</span>
          </div>
        )}
        {source.kind === "text" && (
          <div className="relative z-10 w-full max-w-sm rounded-[12px] border border-line bg-panel p-5 shadow-pop">
            <p className="mb-2 text-[11px] font-medium tracking-[0.12em] text-muted uppercase">Message</p>
            <p className="text-[15px] leading-relaxed">{source.text}</p>
          </div>
        )}
        {(source.kind === "image" || source.kind === "pdf") && (
          <p className="absolute bottom-3 left-4 z-10 max-w-[80%] truncate font-mono text-[11px] text-muted">{source.name}</p>
        )}
        {!claim && !error && !isText && <div className="scanline pointer-events-none absolute inset-x-0 top-0 z-20 h-24" aria-hidden />}
      </div>

      <div aria-live="polite">
        <div className="mb-5 h-1 overflow-hidden rounded-full bg-sunken" aria-hidden>
          <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ width: `${progress}%` }} />
        </div>
        <ol className="space-y-3">
          {steps.map((label, i) => {
            const done = claim ? step > i : false;
            const active = !error && (claim ? step === i : i === 0);
            return (
              <li key={label} className={cx("flex items-center gap-3 text-sm transition-colors duration-200", done || active ? "text-ink" : "text-muted")}>
                <span
                  className={cx(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border",
                    done ? "border-success bg-success text-white" : active ? "border-accent bg-accent-soft" : "border-line-strong bg-panel",
                  )}
                  aria-hidden
                >
                  {done ? <CheckIcon className="size-3" weight="bold" /> : active ? <span className="size-1.5 animate-pulse rounded-full bg-accent" /> : <span className="size-1.5 rounded-full bg-line-strong" />}
                </span>
                {label}
              </li>
            );
          })}
        </ol>

        {!claim && !error && (
          <div className="mt-8 space-y-2.5" aria-hidden>
            <div className="skeleton h-9 w-2/3" />
            <div className="skeleton h-14 w-full" />
            <div className="skeleton h-14 w-full" />
            <div className="skeleton h-14 w-5/6" />
          </div>
        )}

        {error && (
          <div className="mt-6 space-y-3">
            <Alert>{error}</Alert>
            <Button variant="secondary" onClick={onReset}>
              Try another
            </Button>
          </div>
        )}

        <AnimatePresence>
          {claim && step >= 2 && (
            <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }} className="mt-8">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                <p className="font-mono text-sm font-medium">Claim #{claim.number}</p>
                <Confidence value={claim.aiConfidence} provider={claim.aiJson?.provider} />
              </div>
              <dl>
                {fields.map((f, i) => (
                  <motion.div
                    key={f.k}
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: reduce ? 0 : i * 0.045, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    className="grid grid-cols-[76px_minmax(0,1fr)] items-baseline gap-3 border-b border-line py-3.5 sm:grid-cols-[96px_minmax(0,1fr)]"
                  >
                    <dt className="text-[12px] font-medium tracking-[0.04em] text-muted uppercase">{f.k}</dt>
                    <dd className="min-w-0">
                      <span className={cx(f.big ? "text-[28px] leading-none font-semibold" : "text-sm font-medium", f.m ? "money" : "break-words")}>{f.v}</span>
                      {f.q && (
                        <span className="mt-1.5 flex items-start gap-1.5 rounded-[6px] bg-sunken px-2 py-1 text-[11.5px] text-ink-2">
                          <QuotesIcon className="mt-0.5 size-3 shrink-0 text-muted" weight="fill" aria-hidden />
                          <span className="font-mono leading-relaxed break-words">{f.q}</span>
                        </span>
                      )}
                    </dd>
                  </motion.div>
                ))}
              </dl>
              {claim.aiJson?.notes && <p className="mt-3 text-xs leading-relaxed text-muted">{claim.aiJson.notes}</p>}
            </motion.div>
          )}
        </AnimatePresence>

        {claim && step >= 3 && (
          <div className="rise mt-6 space-y-4">
            {dup ? (
              <Alert tone="warning">
                <span className="flex gap-2.5">
                  <WarningIcon className="mt-0.5 size-4 shrink-0" weight="fill" aria-hidden />
                  <span>
                    {dup.rationale ?? "This looks like a claim you already have."} It stays in review until someone decides.
                  </span>
                </span>
              </Alert>
            ) : (
              <Alert tone="success">
                <span className="flex items-center gap-2">
                  <CheckIcon className="size-4 shrink-0" weight="bold" aria-hidden />
                  {claim.status === "matched" ? "No duplicates. Ready for the next settlement batch." : "No duplicates. Waiting for a quick review because confidence is low."}
                </span>
              </Alert>
            )}
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={`/app/claims/${claim.id}`}>
                Review claim <ArrowRightIcon className="size-4" aria-hidden />
              </ButtonLink>
              <Button variant="secondary" onClick={onReset}>
                Add another
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
