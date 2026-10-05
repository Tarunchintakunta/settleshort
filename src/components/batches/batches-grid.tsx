"use client";

import { AgGridReact, type CustomCellRendererProps } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
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
  { field: "name", headerName: "Batch", flex: 1.4, minWidth: 160 },
  { field: "status", headerName: "Status", width: 150, cellRenderer: (p: CustomCellRendererProps<GridBatch>) => <StatusPill status={p.value} /> },
  { headerName: "Payouts", width: 110, valueGetter: (p) => `${p.data!.paid}/${p.data!.items} paid`, comparator: (_a, _b, x, y) => x.data!.items - y.data!.items },
  {
    field: "totalCents",
    headerName: "Total",
    width: 130,
    type: "rightAligned",
    cellClass: "tabular-nums font-medium",
    valueFormatter: (p) => formatMoney(p.value, p.data!.currency),
  },
  { field: "paypalPayoutBatchId", headerName: "PayPal batch id", flex: 1, minWidth: 150, cellClass: "font-mono text-xs", valueFormatter: (p) => p.value ?? "Not sent" },
  { field: "mode", headerName: "Mode", width: 110, valueFormatter: (p) => (p.value === "sandbox" ? "Sandbox" : p.value === "simulated" ? "Simulated" : "") },
  { field: "createdAt", headerName: "Created", width: 140, valueFormatter: (p) => when(p.value), sort: "desc" },
  { field: "approvedAt", headerName: "Approved", width: 140, valueFormatter: (p) => when(p.value) },
];

export function BatchesGrid({ rows }: { rows: GridBatch[] }) {
  const router = useRouter();
  return (
    <div style={{ height: Math.min(640, 46 + Math.max(rows.length, 4) * 52) }}>
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
  );
}
