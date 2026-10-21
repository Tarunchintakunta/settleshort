"use client";

import { AgGridReact, type CustomCellRendererProps } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { gridTheme } from "@/components/claims/claims-grid";
import { StatusPill } from "@/components/ui";
import { formatMoney } from "@/lib/money";

export type GridBatch = {
  id: string;
  name: string;
  items: number;
  paid: number;
  status: string;
  totalCents: number;
  currency: string;
  paypalPayoutBatchId: string | null;
  mode: string | null;
  createdAt: string;
  approvedAt: string | null;
};

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");

const cols: ColDef<GridBatch>[] = [
  { field: "name", headerName: "Batch", flex: 1.2, minWidth: 130 },
  { field: "status", headerName: "Status", minWidth: 180, flex: 1, cellRenderer: (p: CustomCellRendererProps<GridBatch>) => <StatusPill status={p.value} /> },
  { headerName: "Payouts", minWidth: 85, flex: 0.6, valueGetter: (p) => `${p.data!.paid}/${p.data!.items} paid`, comparator: (_a, _b, x, y) => x.data!.items - y.data!.items },
  {
    field: "totalCents",
    headerName: "Total",
    minWidth: 90,
    flex: 0.7,
    type: "rightAligned",
    cellClass: "tabular-nums font-medium",
    valueFormatter: (p) => formatMoney(p.value, p.data!.currency),
  },
  { field: "paypalPayoutBatchId", headerName: "PayPal batch id", flex: 1, minWidth: 120, cellClass: "font-mono text-xs", valueFormatter: (p) => p.value ?? "Not sent" },
  { field: "createdAt", headerName: "Created", minWidth: 128, flex: 0.8, valueFormatter: (p) => when(p.value), sort: "desc" },
  { field: "approvedAt", headerName: "Approved", minWidth: 128, flex: 0.8, valueFormatter: (p) => when(p.value) },
];

export function BatchesGrid({ rows }: { rows: GridBatch[] }) {
  const router = useRouter();
  return (
    <>
      <ul className="space-y-2 lg:hidden" aria-label="Batches">
        {rows.map((b) => (
          <li key={b.id}>
            <Link href={`/app/batches/${b.id}`} className="block rounded-[12px] border border-line bg-panel p-4 shadow-soft transition-colors active:bg-sunken">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 font-medium break-words">{b.name}</p>
                <span className="money shrink-0 font-semibold">{formatMoney(b.totalCents, b.currency)}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
                <StatusPill status={b.status} />
                <span className="tnum">
                  {b.paid}/{b.items} paid
                </span>
                <span className="tnum">{when(b.createdAt)}</span>
              </div>
              {b.paypalPayoutBatchId && <p className="mt-2 font-mono text-[11px] text-muted">{b.paypalPayoutBatchId}</p>}
            </Link>
          </li>
        ))}
      </ul>
      <div className="hidden lg:block" style={{ height: Math.min(640, 46 + Math.max(rows.length, 4) * 52) }}>
        <AgGridReact<GridBatch>
        theme={gridTheme}
        rowData={rows}
        columnDefs={cols}
        defaultColDef={{ resizable: false, sortable: true }}
        getRowId={(p) => p.data.id}
        onRowClicked={(e) => router.push(`/app/batches/${e.data!.id}`)}
        rowClass="cursor-pointer"
        animateRows
      />
      </div>
    </>
  );
}
