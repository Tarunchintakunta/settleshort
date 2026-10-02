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
      <p className="text-[11px] font-medium tracking-[0.14em] text-accent uppercase">Step 1 of 2</p>
      <h1 className="mt-2 text-[22px] font-semibold tracking-[-0.03em]">Create your workspace</h1>
      <p className="mt-1.5 mb-6 text-sm leading-relaxed text-muted">You&apos;ll be the owner, the only role (with admins) that can approve payouts.</p>
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
