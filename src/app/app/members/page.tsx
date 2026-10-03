import { PageHeader, Pill } from "@/components/ui";
import { InviteForm, PaypalEmailCell, ReleaseToggle, VerifyPaypal } from "@/components/settings/members-client";
import { requirePageCtx } from "@/lib/auth";
import { workspaceMembers } from "@/lib/claims";

export const metadata = { title: "Members" };

export default async function MembersPage({ searchParams }: PageProps<"/app/members">) {
  const ctx = await requirePageCtx();
  const members = await workspaceMembers(ctx.workspace.id);
  const canGrant = !!members.find((m) => m.id === ctx.user.id)?.canRelease;
  const welcome = (await searchParams).welcome;
  return (
    <>
      <PageHeader title="Members" sub="Who submits claims, who approves them, who can release money, and where PayPal sends reimbursements." />
      {welcome && (
        <div className="rise mb-8 rounded-[12px] border border-accent/20 bg-accent-soft px-4 py-4 text-sm leading-relaxed text-ink-2">
          <b className="text-ink">Last step:</b> add your teammates and their PayPal sandbox emails, then create your first claim.
        </div>
      )}
      <div className="mb-8 overflow-x-auto rounded-[12px] border border-line shadow-soft">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-[11px] font-medium tracking-[0.06em] text-muted uppercase">
            <tr>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">PayPal receiver</th>
              <th className="px-5 py-3 font-medium" title="May send approved money to PayPal">Release</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {members.map((m) => (
              <tr key={m.id}>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-[12px] font-semibold text-ink" aria-hidden>
                      {m.name[0]}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium tracking-[-0.011em]">{m.name}</p>
                      <p className="truncate text-xs text-muted">{m.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <Pill tone={m.role === "member" ? "neutral" : "accent"} className="capitalize">
                    {m.role}
                  </Pill>
                </td>
                <td className="px-5 py-3.5">
                  <PaypalEmailCell m={m} canEdit={ctx.isAdmin} />
                  <div className="mt-1">
                    <VerifyPaypal m={m} canVerify={ctx.isAdmin && m.id !== ctx.user.id} />
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <ReleaseToggle m={m} canEdit={canGrant} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ctx.isAdmin && <InviteForm />}
    </>
  );
}
