"use client";

import { AgGridReact, type CustomCellRendererProps } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type GridApi } from "ag-grid-community";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { GitMergeIcon, MagnifyingGlassIcon, StackIcon } from "@phosphor-icons/react";
import { Alert, Button, Confidence, cx, inputCls, StatusPill } from "@/components/ui";
import { api } from "@/lib/client";
import { formatMoney } from "@/lib/money";

ModuleRegistry.registerModules([AllCommunityModule]);

export type GridClaim = {
  id: string;
  number: number;
  txnDate: string | null;
  vendor: string;
  amountCents: number;
  currency: string;
  payer: string;
  source: string;
  aiConfidence: number | null;
  provider?: string;
  status: string;
  duplicate: boolean;
};

// Grid colors come from the app's CSS tokens, so light and dark mode both follow.
const theme = themeQuartz.withParams({
  fontFamily: "var(--font-geist-sans)",
  backgroundColor: "var(--panel)",
  foregroundColor: "var(--ink)",
  accentColor: "var(--accent)",
  borderColor: "var(--line)",
  headerBackgroundColor: "var(--panel)",
  headerTextColor: "var(--muted)",
  headerFontWeight: 500,
  headerFontSize: 12.5,
  rowHoverColor: "var(--sunken)",
  selectedRowBackgroundColor: "var(--accent-soft)",
  wrapperBorderRadius: 12,
  wrapperBorder: { color: "var(--line)" },
  columnBorder: false,
  headerColumnBorder: false,
  rowHeight: 52,
  headerHeight: 40,
  fontSize: 13.5,
  spacing: 7,
});

const FILTERS = [
  { key: "", label: "All" },
  { key: "pending_review", label: "Needs review" },
  { key: "matched", label: "Ready" },
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
      { field: "number", headerName: "#", width: 76, cellClass: "font-mono text-muted", valueFormatter: (p) => `${p.value}` },
      { field: "txnDate", headerName: "Date", width: 120, cellClass: "tnum text-ink-2", valueFormatter: (p) => (p.value ? new Date(p.value + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "No date") },
      {
        field: "vendor",
        flex: 1.4,
        minWidth: 160,
        cellRenderer: (p: CustomCellRendererProps<GridClaim>) => (
          <span>
            {p.value || <span className="text-muted">Untitled</span>}
            {p.data?.duplicate && <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">Possible duplicate</span>}
          </span>
        ),
      },
      {
        field: "amountCents",
        headerName: "Amount",
        width: 130,
        type: "rightAligned",
        cellClass: "tnum font-medium",
        valueFormatter: (p) => formatMoney(p.value, p.data!.currency),
      },
      { field: "payer", headerName: "Paid by", flex: 1, minWidth: 130 },
      { field: "source", width: 100, valueFormatter: (p) => (p.value === "slack" ? "Slack" : p.value[0].toUpperCase() + p.value.slice(1)) },
      {
        field: "aiConfidence",
        headerName: "Extraction",
        width: 190,
        cellRenderer: (p: CustomCellRendererProps<GridClaim>) => <Confidence value={p.value} provider={p.data?.provider} />,
      },
      { field: "status", width: 150, cellRenderer: (p: CustomCellRendererProps<GridClaim>) => <StatusPill status={p.value} /> },
    ],
    [],
  );

  const shown = useMemo(() => (status ? rows.filter((r) => r.status === status) : rows), [rows, status]);
  const ready = selected.filter((s) => s.status === "matched");

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
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-0.5 rounded-[10px] bg-sunken p-1" role="tablist" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={status === f.key}
              onClick={() => setStatus(f.key)}
              className={cx("rounded-[7px] px-3 py-1.5 text-[13px] transition-colors", status === f.key ? "bg-panel font-medium text-ink shadow-soft" : "text-muted hover:text-ink")}
            >
              {f.label}
              <span className="ml-1.5 tnum opacity-60">{f.key ? rows.filter((r) => r.status === f.key).length : rows.length}</span>
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input aria-label="Search claims" placeholder="Search vendor, person…" value={q} onChange={(e) => setQ(e.target.value)} className={cx(inputCls, "h-10 pl-9")} />
        </div>
      </div>

      {isAdmin && selected.length > 0 && (
        <div className="rise mb-3 flex flex-wrap items-center gap-3 rounded-[10px] bg-ink px-4 py-2 text-panel shadow-pop">
          <span className="text-sm">
            <b className="tnum">{selected.length}</b> selected
            {ready.length !== selected.length && <span className="opacity-60"> ({ready.length} ready to batch)</span>}
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="text-panel/80 hover:bg-white/10 hover:text-panel"
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

      <div style={{ height: Math.min(640, 46 + Math.max(shown.length, 4) * 52) }}>
        <AgGridReact<GridClaim>
          theme={theme}
          rowData={shown}
          columnDefs={cols}
          defaultColDef={{ resizable: false, sortable: true }}
          quickFilterText={q}
          getRowId={(p) => p.data.id}
          rowSelection={isAdmin ? { mode: "multiRow", enableClickSelection: false, isRowSelectable: (n) => ["pending_review", "matched"].includes(n.data?.status ?? "") } : undefined}
          onGridReady={(e) => (gridApi.current = e.api)}
          onSelectionChanged={(e) => setSelected(e.api.getSelectedRows())}
          onRowClicked={(e) => {
            const t = e.event?.target as HTMLElement | undefined;
            if (t?.closest(".ag-selection-checkbox, .ag-checkbox")) return;
            router.push(`/app/claims/${e.data!.id}`);
          }}
          rowClass="cursor-pointer"
          overlayNoRowsTemplate="No claims match this filter"
          animateRows
        />
      </div>
      <p className="mt-3 text-xs text-muted">Select ready claims to build a settlement batch. Select two look-alikes to merge them.</p>
    </div>
  );
}
