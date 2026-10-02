import type { Metadata } from "next";
import { BuildingsIcon, FileLockIcon, FingerprintIcon, KeyIcon, ListChecksIcon, RepeatIcon, ShieldCheckIcon, TestTubeIcon } from "@phosphor-icons/react/ssr";
import { wrap } from "@/components/marketing/Nav";
import { Shot } from "@/components/marketing/Shot";

export const metadata: Metadata = {
  title: "Security",
  description:
    "How SettleShort keeps AI away from money: a human approval gate, sandbox-only PayPal, least-privilege roles, prompt-injection defenses, idempotent payouts, and a full audit trail.",
};

const ITEMS = [
  {
    icon: ShieldCheckIcon,
    title: "Human approval gate",
    body: "AI never starts a payout. A batch reaches PayPal only after an admin clicks Approve & Pay and types APPROVE. Per-payout and per-batch caps limit the damage of any approved mistake.",
  },
  {
    icon: TestTubeIcon,
    title: "Sandbox only",
    body: "The PayPal client is pinned to the sandbox API. A live endpoint is refused in code, not just in config. Without sandbox credentials, a clearly labelled payout simulator runs instead.",
  },
  {
    icon: FingerprintIcon,
    title: "Least privilege",
    body: "Members submit and edit their own claims. Only admins build batches and approve payouts. Roles are checked on the server for every request, never trusted from the client.",
  },
  {
    icon: ListChecksIcon,
    title: "Audit everything",
    body: "Claim creation, AI extraction (including the raw model output), edits, merges, rejections, approvals and every PayPal webhook are logged with actor and timestamp.",
  },
  {
    icon: FileLockIcon,
    title: "Prompt-injection mitigation",
    body: "Model output must match a strict JSON schema and is validated again with Zod before it touches the database. Receipt and message text is data only. It can fill fields, never trigger actions.",
  },
  {
    icon: RepeatIcon,
    title: "Idempotency",
    body: "Each batch carries its own sender_batch_id, and PayPal rejects a reused one, so retries and double clicks cannot pay anyone twice. Webhook status updates are safe to replay.",
  },
  {
    icon: BuildingsIcon,
    title: "Workspace scoping",
    body: "Every query is scoped to the caller’s workspace. Claims, payees, batches and uploads from one workspace are never readable from another.",
  },
  {
    icon: KeyIcon,
    title: "Secrets stay on the server",
    body: "PayPal, Anthropic, OpenAI, session and webhook secrets live in server-only environment variables. Inbound webhooks need a shared secret or PayPal signature verification.",
  },
];

export default function SecurityPage() {
  return (
    <div className={`${wrap} py-16 sm:py-24`}>
      <header className="grid gap-12 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-6">
          <h1 className="text-[40px] font-semibold leading-[1.04] tracking-[-0.03em] text-ink sm:text-[56px]">AI drafts. People pay.</h1>
          <p className="mt-5 max-w-[50ch] text-lg leading-relaxed text-ink-2">
            The most capable part of SettleShort, the model, has the least authority. This is everything that stands between a receipt and a payout.
          </p>
        </div>
        <Shot
          className="lg:col-span-6"
          src="/marketing/approve.png"
          alt="The Approve & Pay confirmation dialog, asking the admin to type APPROVE before paying 3 people $287.55."
          sizes="(min-width: 1024px) 560px, calc(100vw - 32px)"
          crop="aspect-[16/9] [&_img]:object-[50%_52%] [&_img]:scale-[1.6]"
          preload
        />
      </header>
      <dl className="mt-20 grid gap-x-12 gap-y-12 sm:grid-cols-2">
        {ITEMS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="border-t border-line pt-6">
            <dt className="flex items-center gap-3 text-lg font-semibold tracking-tight text-ink">
              <Icon size={20} className="text-accent" aria-hidden />
              {title}
            </dt>
            <dd className="mt-3 max-w-[56ch] text-[15px] leading-relaxed text-muted">{body}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-16 text-sm text-muted">
        Found an issue? Open a report on{" "}
        <a href="https://github.com/Tarunchintakunta/settleshort" className="text-accent underline-offset-4 hover:underline" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        .
      </p>
    </div>
  );
}
