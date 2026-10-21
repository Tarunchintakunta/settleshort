import Link from "next/link";
import { ButtonLink } from "@/components/ui";
import { inviteByToken } from "@/lib/invites";
import { signup } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const invite = (await searchParams).invite;
  const token = typeof invite === "string" ? invite.slice(0, 100) : "";
  const inv = token ? await inviteByToken(token) : null;
  if (token && !inv)
    return (
      <>
        <h1 className="text-[22px] font-semibold tracking-[-0.03em]">This invite link no longer works</h1>
        <p className="mt-1.5 mb-6 text-sm leading-relaxed text-muted">It was already used, expired after 14 days, or was revoked. Ask your admin to resend it from the Members page.</p>
        <ButtonLink href="/login" variant="secondary" className="w-full">
          Sign in instead
        </ButtonLink>
      </>
    );
  return (
    <>
      <h1 className="text-[22px] font-semibold tracking-[-0.03em]">{inv?.workspaceName ? `Join ${inv.workspaceName}` : "Create your account"}</h1>
      <p className="mt-1.5 mb-6 text-sm leading-relaxed text-muted">
        {inv
          ? `${inv.inviterName ? `${inv.inviterName} invited you` : "You were invited"}${inv.workspaceName ? ` to ${inv.workspaceName}` : ""}. Set a password to finish.`
          : "Start a workspace for your team. Invited by a teammate? Open the invite link they shared."}
      </p>
      <AuthForm
        action={signup}
        submit={inv ? "Join workspace" : "Create account"}
        hidden={token ? { invite: token } : {}}
        fields={[
          { name: "name", label: "Full name", autoComplete: "name", value: inv?.name },
          { name: "email", label: "Work email", type: "email", autoComplete: "email", value: inv?.email, readOnly: !!inv },
          { name: "password", label: "Password", type: "password", autoComplete: "new-password", hint: "At least 8 characters" },
        ]}
      />
      <p className="mt-6 text-center text-sm text-muted">
        Have an account?{" "}
        <Link href="/login" className="inline-block py-1 font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
