import { redirect } from "next/navigation";
import { getCtx } from "@/lib/auth";
import { createWorkspace } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Create workspace" };

export default async function OnboardingPage() {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  if (ctx.workspace) redirect("/app");
  return (
    <>
      <div className="flex items-center gap-3">
        <div className="flex gap-1" aria-hidden>
          <span className="h-1 w-6 rounded-full bg-accent" />
          <span className="h-1 w-6 rounded-full bg-line-strong" />
        </div>
        <p className="text-xs font-medium text-muted">Step 1 of 2</p>
      </div>
      <h1 className="mt-4 text-[22px] font-semibold tracking-[-0.03em]">Create your workspace</h1>
      <p className="mt-1.5 mb-6 text-sm leading-relaxed text-muted">You&apos;ll be the owner. Only owners and admins can approve payouts.</p>
      <AuthForm
        action={createWorkspace}
        submit="Create workspace"
        fields={[
          { name: "name", label: "Workspace name", placeholder: "Acme Labs" },
          {
            name: "paypalEmail",
            optional: true,
            label: "Your PayPal sandbox email",
            type: "email",
            placeholder: ctx.user.email,
            hint: "Where your own reimbursements are paid. Create sandbox accounts at developer.paypal.com → Testing tools.",
          },
        ]}
      />
    </>
  );
}
