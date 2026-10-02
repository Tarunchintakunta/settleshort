import type { ReactNode } from "react";

/** Fades a block up as it scrolls into view (CSS scroll-driven). Visible by default when unsupported. */
export function Reveal({ children, className }: { children: ReactNode; className?: string; delay?: number }) {
  return <div className={["reveal", className].filter(Boolean).join(" ")}>{children}</div>;
}
