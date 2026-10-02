import { PageHeader } from "@/components/ui";
import { InviteForm, PaypalEmailCell } from "@/components/settings/members-client";
import { requirePageCtx } from "@/lib/auth";
import { workspaceMembers } from "@/lib/claims";

export const metadata = { title: "Members" };

export default async function MembersPage({ searchParams }: PageProps<"/app/members">) {
  const ctx = await requirePageCtx();
  const members = await workspaceMembers(ctx.workspace.id);
  const welcome = (await searchParams).welcome;
  return (
    <>
      <PageHeader title="Members" sub="Who submits claims, who approves, and where PayPal sends their reimbursements." />
      {welcome && (
        <div className="rise mb-6 rounded-[12px] bg-accent-soft p-4 text-sm text-ink-2">
          <b className="text-ink">Last step:</b> add your teammates and their PayPal sandbox emails, then create your first claim.
        </div>
      )}
      <div className="mb-8 overflow-x-auto rounded-[12px] border border-line">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs text-muted">
            <tr>
              <th className="px-5 py-3 font-normal">Name</th>
              <th className="px-5 py-3 font-normal">Role</th>
              <th className="px-5 py-3 font-normal">PayPal receiver</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {members.map((m) => (
              <tr key={m.id}>
                <td className="px-5 py-3">
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-muted">{m.email}</p>
                </td>
                <td className="px-5 py-3 capitalize">{m.role}</td>
                <td className="px-5 py-3">
                  <PaypalEmailCell m={m} canEdit={ctx.isAdmin} />
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
