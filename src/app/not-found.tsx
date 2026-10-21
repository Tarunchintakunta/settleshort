import Link from "next/link";
import { ButtonLink, Logo } from "@/components/ui";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <Link href="/" aria-label="SettleShort home" className="mb-10">
        <Logo />
      </Link>
      <p className="font-mono text-sm text-muted">404</p>
      <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em]">This page doesn&apos;t exist</h1>
      <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-ink-2">The link may be old, or the page was moved.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <ButtonLink href="/app">Go to the app</ButtonLink>
        <ButtonLink href="/" variant="secondary">
          Home
        </ButtonLink>
      </div>
      <p className="mt-6 text-sm text-muted">
        Or read the{" "}
        <Link href="/docs" className="inline-block py-1 font-medium text-accent underline underline-offset-4">
          docs
        </Link>{" "}
        or{" "}
        <a href="/demo" className="inline-block py-1 font-medium text-accent underline underline-offset-4">
          open the demo
        </a>
        .
      </p>
    </main>
  );
}
