import Link from "next/link";
import { Card, Logo } from "@/components/ui";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-[100dvh] flex-1 flex-col items-center justify-center px-4 py-16">
      <Link href="/" className="mb-8" aria-label="SettleShort home">
        <Logo className="text-lg" />
      </Link>
      <Card className="rise w-full max-w-[400px] p-8 shadow-soft">{children}</Card>
      <p className="mt-6 text-sm text-muted">
        Just looking?{" "}
        <a href="/demo" className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
          Open the demo workspace
        </a>
      </p>
    </main>
  );
}
