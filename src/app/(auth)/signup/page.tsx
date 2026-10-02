import Link from "next/link";
import { signup } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Invited by a teammate? Use the same email to join their workspace.</p>
      <AuthForm
        action={signup}
        submit="Create account"
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
