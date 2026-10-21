import { PageHeader, Pill } from "@/components/ui";
import { DelegationPanel, EscalatesTo, InviteForm, OffboardButton, LimitCell, PaypalEmailCell, ReleaseToggle, RoleSelect, VerifyPaypal } from "@/components/settings/members-client";
import { requirePageCtx } from "@/lib/auth";
import { workspaceMembers } from "@/lib/claims";
import { db, delegations } from "@/lib/db";
import { and, eq, gt } from "drizzle-orm";

export const metadata = { title: "Members" };

export default async function MembersPage({ searchParams }: PageProps<"/app/members">) {
  const ctx = await requirePageCtx();
  const [members, dels] = await Promise.all([
    workspaceMembers(ctx.workspace.id),
    db.select().from(delegations).where(and(eq(delegations.workspaceId, ctx.workspace.id), gt(delegations.endsAt, new Date()))),
  ]);
  const canGrant = !!members.find((m) => m.id === ctx.user.id)?.canRelease;
  const welcome = (await searchParams).welcome;
  return (
    <>
      <PageHeader title="Members" sub="Who submits claims, who approves them, who can release money, and where PayPal sends reimbursements." />
      {welcome && (
        <div className="rise mb-8 rounded-[12px] border border-accent/20 bg-accent-soft px-4 py-4 text-sm leading-relaxed text-ink-2">
          <b className="text-ink">Step 2 of 2:</b> add your teammates and their PayPal sandbox emails, then create your first claim.
        </div>
      )}
      <div className="mb-8 overflow-x-auto rounded-[12px] border border-line shadow-soft">
        <table className="w-full text-sm max-lg:block">
          <thead className="border-b border-line text-left text-[11px] font-medium tracking-[0.06em] text-muted uppercase max-lg:hidden">
            <tr>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">PayPal receiver</th>
              <th className="px-5 py-3 font-medium" title="Largest claim they approve alone">Approves up to</th>
              <th className="px-5 py-3 font-medium" title="May send approved money to PayPal">Release</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line max-lg:block">
            {members.map((m) => (
              <tr key={m.id} className="max-lg:grid max-lg:grid-cols-2 max-lg:gap-x-4 max-lg:gap-y-4 max-lg:p-4">
                <td className="px-5 py-3.5 max-lg:col-span-2 max-lg:block max-lg:p-0">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-[12px] font-semibold text-ink" aria-hidden>
                      {m.name[0]}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium tracking-[-0.011em]">{m.name}</p>
                      {(ctx.isAdmin || m.id === ctx.user.id) && <p className="truncate text-xs text-muted">{m.email}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 max-lg:block max-lg:p-0">
                  <p className="mb-1 text-[11px] font-medium tracking-[0.06em] text-muted uppercase lg:hidden">Role</p>
                  {ctx.isAdmin && m.id !== ctx.user.id && !m.offboardedAt && m.role !== "owner" ? (
                    <RoleSelect m={m} canEdit />
                  ) : (
                    <Pill tone={m.offboardedAt ? "neutral" : m.role === "member" ? "neutral" : "accent"} className="capitalize">
                      {m.offboardedAt ? "Left" : m.role}
                    </Pill>
                  )}
                  {ctx.isAdmin && m.id !== ctx.user.id && <OffboardButton m={m} />}
                </td>
                <td className="px-5 py-3.5 max-lg:block max-lg:p-0">
                  <p className="mb-1 text-[11px] font-medium tracking-[0.06em] text-muted uppercase lg:hidden">PayPal receiver</p>
                  {ctx.isAdmin || m.id === ctx.user.id ? (
                    <>
                      <PaypalEmailCell m={m} canEdit={ctx.isAdmin} />
                      <div className="mt-1">
                        <VerifyPaypal m={m} canVerify={ctx.isAdmin && m.id !== ctx.user.id} />
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-muted">{m.paypalVerifiedAt ? "Verified" : "Not verified"}</span>
                  )}
                </td>
                <td className="px-5 py-3.5 max-lg:block max-lg:p-0">
                  <p className="mb-1 text-[11px] font-medium tracking-[0.06em] text-muted uppercase lg:hidden">Approves up to</p>
                  <LimitCell m={m} canEdit={ctx.isAdmin && m.id !== ctx.user.id} />
                  <EscalatesTo m={m} members={members} canEdit={ctx.isAdmin} />
                </td>
                <td className="px-5 py-3.5 max-lg:block max-lg:p-0">
                  <p className="mb-1 text-[11px] font-medium tracking-[0.06em] text-muted uppercase lg:hidden">Release</p>
                  <ReleaseToggle m={m} canEdit={canGrant} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DelegationPanel me={ctx.user.id} members={members} rows={dels.map((d) => ({ ...d, endsAt: d.endsAt.toISOString() }))} canDelegate={ctx.role !== "member"} />
      {ctx.isAdmin && <InviteForm />}
    </>
  );
}
