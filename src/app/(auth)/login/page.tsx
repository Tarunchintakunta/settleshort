import Link from "next/link";
import { login } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-[22px] font-semibold tracking-[-0.03em]">Sign in</h1>
      <p className="mt-1.5 mb-6 text-sm leading-relaxed text-muted">Welcome back to your settlement desk.</p>
      <AuthForm
        action={login}
        submit="Sign in"
        fields={[
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
        ]}
      />
      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="font-medium text-accent hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
