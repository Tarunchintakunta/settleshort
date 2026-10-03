import Image from "next/image";
import Link from "next/link";
import { CurrencyDollarIcon, QuotesIcon, ShieldCheckIcon } from "@phosphor-icons/react/ssr";
import { Card, Logo } from "@/components/ui";

const proof = [
  { Icon: QuotesIcon, text: "Every field shows the receipt text it came from" },
  { Icon: ShieldCheckIcon, text: "Nothing is paid until an admin types APPROVE" },
  { Icon: CurrencyDollarIcon, text: "PayPal Payouts, sandbox only. No real money moves." },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="grid min-h-[100dvh] flex-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
      <aside className="relative hidden border-r border-line bg-sunken lg:flex lg:flex-col lg:px-12 lg:py-10 xl:px-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(var(--line-strong)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
        />
        <Link href="/" aria-label="SettleShort home" className="relative w-fit">
          <Logo />
        </Link>
        <div className="relative my-auto max-w-[560px] py-12">
          <p className="text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] text-ink">
            Receipt in. Settled out.
            <br />
            One approve.
          </p>
          <ul className="mt-8 space-y-3.5">
            {proof.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[15px] text-ink-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-[8px] border border-line bg-panel text-accent">
                  <Icon size={16} weight="bold" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
          <figure className="mt-10 rounded-[12px] border border-line bg-panel p-3 shadow-soft">
            <Image
              src="/marketing/extraction.png"
              alt="A Nopa receipt beside the claim SettleShort read from it, each field quoting the receipt line it came from."
              width={2880}
              height={1800}
              sizes="(min-width: 1280px) 560px, 45vw"
              className="h-auto w-full rounded-[8px] border border-line dark:brightness-[0.9]"
            />
          </figure>
        </div>
      </aside>
      <div className="flex flex-col items-center justify-center px-4 py-16">
        <Link href="/" className="mb-8 lg:hidden" aria-label="SettleShort home">
          <Logo className="text-lg" />
        </Link>
        <Card className="rise w-full max-w-[420px] p-8 sm:p-9">{children}</Card>
        <p className="mt-6 text-center text-sm text-muted">
          Just looking?{" "}
          <a href="/demo" className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            Open the demo workspace
          </a>
        </p>
      </div>
    </main>
  );
}
