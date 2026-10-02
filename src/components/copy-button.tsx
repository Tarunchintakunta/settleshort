"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { cx } from "@/components/ui";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
      className={cx(
        "inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2 text-[12px] font-medium transition-colors",
        copied ? "text-success" : "text-muted hover:bg-panel hover:text-ink",
      )}
    >
      {copied ? <CheckIcon className="size-3.5" weight="bold" aria-hidden /> : <CopyIcon className="size-3.5" aria-hidden />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
