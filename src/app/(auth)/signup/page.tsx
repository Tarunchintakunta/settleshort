import Link from "next/link";
import { signup } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const invite = (await searchParams).invite;
  const token = typeof invite === "string" ? invite.slice(0, 100) : "";
  return (
    <>
      <h1 className="text-[22px] font-semibold tracking-[-0.03em]">Create your account</h1>
      <p className="mt-1.5 mb-6 text-sm leading-relaxed text-muted">
        {token ? "You were invited to a workspace. Use the email your admin invited." : "Start a workspace for your team. Invited by a teammate? Open the invite link they shared."}
      </p>
      <AuthForm
        action={signup}
        submit="Create account"
        hidden={token ? { invite: token } : {}}
        fields={[
          { name: "name", label: "Full name", autoComplete: "name" },
          { name: "email", label: "Work email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", autoComplete: "new-password", hint: "At least 8 characters" },
        ]}
      />
      <p className="mt-6 text-center text-sm text-muted">
        Have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
