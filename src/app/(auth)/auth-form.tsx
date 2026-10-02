"use client";

import { useActionState } from "react";
import { Alert, Button, Field, inputCls } from "@/components/ui";
import type { FormState } from "./actions";

type F = { name: string; label: string; type?: string; autoComplete?: string; placeholder?: string; hint?: string; optional?: boolean };

export function AuthForm({ action, fields, submit }: { action: (s: FormState, f: FormData) => Promise<FormState>; fields: F[]; submit: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      {fields.map((f) => (
        <Field key={f.name} label={f.label} hint={f.hint}>
          <input name={f.name} type={f.type ?? "text"} autoComplete={f.autoComplete} placeholder={f.placeholder} className={inputCls} required={!f.optional} />
        </Field>
      ))}
      {state?.error && <Alert>{state.error}</Alert>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "One moment…" : submit}
      </Button>
    </form>
  );
}
