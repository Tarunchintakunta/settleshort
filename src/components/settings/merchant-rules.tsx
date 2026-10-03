"use client";

import { useRouter } from "next/navigation";
import { TrashIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui";
import { api } from "@/lib/client";

type Rule = { id: string; merchantLabel: string; category: string; uses: number; confirmedBy: string };

/** Every confirmed merchant rule, who confirmed it, and how often it applied. Admins can remove one. */
export function MerchantRules({ rules, isAdmin }: { rules: Rule[]; isAdmin: boolean }) {
  const router = useRouter();
  if (!rules.length) return <p className="text-sm text-muted">No rules yet. Pick a category on a claim and tick &ldquo;Always use&rdquo; to create one.</p>;
  return (
    <ul className="divide-y divide-line text-sm">
      {rules.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 py-2">
          <span>
            <b className="font-medium">{r.merchantLabel}</b> → {r.category}
            <span className="ml-2 text-xs text-muted">
              by {r.confirmedBy} · used {r.uses}×
            </span>
          </span>
          {isAdmin && (
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Delete rule for ${r.merchantLabel}`}
              onClick={async () => {
                await api(`/merchant-rules/${r.id}`, { method: "DELETE" });
                router.refresh();
              }}
            >
              <TrashIcon className="size-4" aria-hidden />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
