"use client";

import { useActionState } from "react";
import { Alert, Button, Field, inputCls } from "@/components/ui";
import type { FormState } from "./actions";

type F = { name: string; label: string; type?: string; autoComplete?: string; placeholder?: string; hint?: string; optional?: boolean };

export function AuthForm({ action, fields, submit, hidden = {} }: { action: (s: FormState, f: FormData) => Promise<FormState>; fields: F[]; submit: string; hidden?: Record<string, string> }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
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
