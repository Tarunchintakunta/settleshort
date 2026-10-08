"use client";

import { AgGridReact, type CustomCellRendererProps } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type GridApi } from "ag-grid-community";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { GitMergeIcon, MagnifyingGlassIcon, StackIcon } from "@phosphor-icons/react";
import { Alert, Button, Confidence, cx, inputCls, Pill, PROVIDER_LABEL, tabBtn } from "@/components/ui";
import { api } from "@/lib/client";
import { formatMoney } from "@/lib/money";

ModuleRegistry.registerModules([AllCommunityModule]);

export type GridClaim = {
  id: string;
  number: number;
  txnDate: string | null;
  vendor: string;
  /** Vendor, or a generated title when there's none yet (see lib/title.ts). */
  title: string;
  amountCents: number;
  currency: string;
  payer: string;
  source: string;
  aiConfidence: number | null;
  provider?: string;
  status: string;
  duplicate: boolean;
  /** Claim numbers behind a High/Medium soft-fraud signal (see lib/risk.ts). */
  riskRefs: number[];
  /** Truthful status label (see lib/status.ts). */
  truth: { label: string; tone: "neutral" | "accent" | "success" | "warning" | "danger" };
};

// Grid colors come from the app's CSS tokens, so light and dark mode both follow.
export const gridTheme = themeQuartz.withParams({
  fontFamily: "var(--font-geist-sans)",
  backgroundColor: "var(--panel)",
  foregroundColor: "var(--ink)",
  accentColor: "var(--accent)",
  borderColor: "var(--line)",
  headerBackgroundColor: "var(--panel)",
  headerTextColor: "var(--muted)",
  headerFontWeight: 500,
  headerFontSize: 11,
  rowHoverColor: "var(--sunken)",
  selectedRowBackgroundColor: "var(--accent-soft)",
  wrapperBorderRadius: 12,
  wrapperBorder: { color: "var(--line)" },
  columnBorder: false,
  headerColumnBorder: false,
  rowHeight: 52,
  headerHeight: 42,
  fontSize: 13.5,
  spacing: 8,
  cellHorizontalPadding: 12,
});

// Why a row's checkbox is disabled. Only claims in review or ready can be batched or merged.
const LOCKED_REASON: Record<string, string> = {
  in_batch: "Already in a settlement batch",
  paid: "Already paid",

  rejected: "Rejected claims can't be batched",
  draft: "Finish the draft before batching",
};
const SOURCE_LABEL = (s: string) => (s === "slack" ? "Slack" : s === "upload" ? "Receipt" : s === "manual" ? "Message" : s[0].toUpperCase() + s.slice(1));
const shortDate = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "No date");

/** One amber chip for the matcher's duplicate flag or a soft-fraud signal; the tooltip names the look-alikes. */
function DupChip({ c }: { c: GridClaim }) {
  if (!c.duplicate && !c.riskRefs.length) return null;
  const why = c.riskRefs.length ? `Looks like ${c.riskRefs.map((n) => `#${n}`).join(", ")}` : "Possible duplicate";
  return (
    <span title={why} aria-label={`Duplicate? ${why}`}>
      <Pill tone="warning" dot>
        Duplicate?
      </Pill>
    </span>
  );
}

const selectable = (status?: string) => ["pending_review", "matched", "partially_paid", "failed"].includes(status ?? "");

const FILTERS = [
  { key: "", label: "All" },
  { key: "pending_review", label: "Needs review" },
  { key: "matched", label: "Approved" },
  { key: "in_batch", label: "In batch" },
  { key: "paid", label: "Paid" },
  { key: "rejected", label: "Rejected" },
];

export function ClaimsGrid({ rows, isAdmin }: { rows: GridClaim[]; isAdmin: boolean }) {
  const router = useRouter();
  const gridApi = useRef<GridApi<GridClaim>>(null);
  const [selected, setSelected] = useState<GridClaim[]>([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cols = useMemo<ColDef<GridClaim>[]>(
    () => [
      { field: "number", headerName: "#", width: 60, cellClass: "tnum text-muted", valueFormatter: (p) => `${p.value}` },
      { field: "txnDate", headerName: "Date", width: 92, cellClass: "tnum text-ink-2", valueFormatter: (p) => shortDate(p.value) },
      {
        field: "vendor",
        flex: 1.6,
        minWidth: 160,
        autoHeight: true,
        getQuickFilterText: (p) => p.data?.title ?? "",
        cellClass: "flex items-center py-1.5",
        cellRenderer: (p: CustomCellRendererProps<GridClaim>) => (
          <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 leading-tight">
            <span className="truncate">{p.data?.title}</span>
            {!p.value && <Pill tone="warning">Add vendor</Pill>}
            {p.data && <DupChip c={p.data} />}
          </span>
        ),
      },
      {
        field: "amountCents",
        headerName: "Amount",
        width: 108,
        type: "rightAligned",
        cellClass: "money font-medium",
        valueFormatter: (p) => formatMoney(p.value, p.data!.currency),
      },
      { field: "payer", headerName: "Paid by", flex: 1, minWidth: 112 },
      { field: "source", width: 84, valueFormatter: (p) => SOURCE_LABEL(p.value) },
      {
        field: "aiConfidence",
        headerName: "Confidence",
        width: 118,
        tooltipValueGetter: (p) => (p.data?.aiConfidence == null ? undefined : `Extracted by ${PROVIDER_LABEL[p.data.provider ?? ""] ?? "AI"}`),
        cellRenderer: (p: CustomCellRendererProps<GridClaim>) => <Confidence value={p.value} />,
      },
      {
        field: "status",
        width: 150,
        cellRenderer: (p: CustomCellRendererProps<GridClaim>) =>
          p.data ? (
            <Pill tone={p.data.truth.tone} dot>
              {p.data.truth.label}
            </Pill>
          ) : null,
      },
    ],
    [],
  );

  const shown = useMemo(() => (status ? rows.filter((r) => r.status === status) : rows), [rows, status]);
  // Cards don't use the grid's quick filter, so apply the same search here.
  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? shown.filter((r) => `${r.title} ${r.payer} ${r.number}`.toLowerCase().includes(t)) : shown;
  }, [shown, q]);
  const ready = selected.filter((s) => ["matched", "partially_paid", "failed"].includes(s.status));

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="sticky top-0 z-10 mb-3 flex flex-col gap-2 rounded-[12px] border border-line bg-panel p-2 shadow-soft sm:flex-row sm:items-center md:static">
        {/* Phones: one scrollable row of chips; the fade on the right says there's more. */}
        <div
          className="flex min-w-0 gap-0.5 overflow-x-auto rounded-[10px] bg-sunken p-1 pr-8 md:pr-1 [mask-image:linear-gradient(to_right,black_85%,transparent)] [scrollbar-width:none] md:flex-wrap md:overflow-visible md:[mask-image:none]"
          role="tablist"
          aria-label="Filter by status"
        >
          {FILTERS.map((f) => (
            <button key={f.key} role="tab" className={cx(tabBtn(status === f.key), "min-h-11 shrink-0 whitespace-nowrap md:min-h-0")} aria-selected={status === f.key} onClick={() => setStatus(f.key)}>
              {f.label}
              <span className="tnum ml-1.5 opacity-60">{f.key ? rows.filter((r) => r.status === f.key).length : rows.length}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:ml-auto sm:w-64">
          <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            name="claim-search"
            role="searchbox"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            aria-label="Search claims"
            placeholder="Search vendor or person"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={cx(inputCls, "h-9 pl-9 [&::-webkit-search-cancel-button]:hidden")}
          />
        </div>
      </div>

      {isAdmin && selected.length > 0 && (
        <div
          role="region"
          aria-label="Selection actions"
          className="rise mb-3 flex flex-wrap items-center gap-3 rounded-[12px] border border-accent/25 bg-accent-soft px-4 py-2"
        >
          <span className="text-sm text-ink">
            <b className="tnum font-semibold">{selected.length}</b> selected
            {ready.length !== selected.length && <span className="text-ink-2"> · {ready.length} ready to batch</span>}
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || selected.length < 2}
              onClick={() =>
                run(async () => {
                  await api("/claims/merge", { json: { ids: [...selected].sort((a, b) => a.number - b.number).map((s) => s.id) } });
                  router.refresh();
                })
              }
            >
              <GitMergeIcon className="size-4" aria-hidden /> Merge
            </Button>
            <Button
              size="sm"
              disabled={busy || !ready.length}
              onClick={() =>
                run(async () => {
                  const b = await api<{ id: string }>("/batches", { json: { claimIds: ready.map((r) => r.id) } });
                  router.push(`/app/batches/${b.id}`);
                })
              }
            >
              <StackIcon className="size-4" aria-hidden /> Create batch ({ready.length})
            </Button>
          </div>
        </div>
      )}
      {error && (
        <div className="mb-3">
          <Alert>{error}</Alert>
        </div>
      )}

      {/* Phones and small tablets: cards instead of a grid that hides most columns. */}
      <ul className="space-y-2 md:hidden" aria-label="Claims">
        {visible.length ? (
          visible.map((c) => (
            <li key={c.id}>
              <Link href={`/app/claims/${c.id}`} className="block min-h-[72px] rounded-[12px] border border-line bg-panel p-4 shadow-soft transition-colors active:bg-sunken">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 font-medium break-words">
                    <span className="tnum mr-1.5 text-muted">#{c.number}</span>
                    {c.title}
                  </p>
                  <span className="money shrink-0 text-right font-semibold">{formatMoney(c.amountCents, c.currency)}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Pill tone={c.truth.tone} dot>
                    {c.truth.label}
                  </Pill>
                  <DupChip c={c} />
                  <span className="text-xs text-muted">{SOURCE_LABEL(c.source)}</span>
                </div>
                <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                  <span>{c.payer}</span>·<span className="tnum">{shortDate(c.txnDate)}</span>
                  {c.aiConfidence != null && (
                    <>
                      ·<span className="tnum">{Math.round(c.aiConfidence * 100)}% sure</span>
                    </>
                  )}
                </p>
                {!c.vendor && <p className="mt-1.5 text-xs font-medium text-warning">Needs vendor</p>}
              </Link>
            </li>
          ))
        ) : (
          <li className="rounded-[12px] border border-dashed border-line-strong px-4 py-10 text-center text-sm text-muted">No claims match this filter</li>
        )}
      </ul>

      <div className="hidden md:block">
        <AgGridReact<GridClaim>
          theme={gridTheme}
          rowData={shown}
          columnDefs={cols}
          defaultColDef={{ resizable: false, sortable: true }}
          quickFilterText={q}
          getRowId={(p) => p.data.id}
          rowSelection={isAdmin ? { mode: "multiRow", enableClickSelection: false, isRowSelectable: (n) => selectable(n.data?.status) } : undefined}
          selectionColumnDef={{
            width: 44,
            headerTooltip: "Select claims in review or ready",
            tooltipValueGetter: (p) => (selectable(p.data?.status) ? undefined : (LOCKED_REASON[p.data?.status ?? ""] ?? "Can't be selected")),
          }}
          tooltipShowDelay={250}
          onGridReady={(e) => (gridApi.current = e.api)}
          onSelectionChanged={(e) => setSelected(e.api.getSelectedRows())}
          onRowClicked={(e) => {
            const t = e.event?.target as HTMLElement | undefined;
            if (t?.closest(".ag-selection-checkbox, .ag-checkbox")) return;
            router.push(`/app/claims/${e.data!.id}`);
          }}
          rowClass="cursor-pointer"
          overlayNoRowsTemplate="No claims match this filter"
          // The page scrolls, the grid doesn't: one scrollbar.
          domLayout="autoHeight"
          pagination
          paginationPageSize={25}
          paginationPageSizeSelector={false}
          animateRows
        />
      </div>
      {isAdmin && (
        <p className="mt-3 hidden text-xs leading-relaxed text-muted md:block">
          Select ready claims to build a settlement batch, or two look-alikes to merge them. Claims already in a batch, paid or rejected are locked; hover a checkbox to see why.
        </p>
      )}
    </div>
  );
}
