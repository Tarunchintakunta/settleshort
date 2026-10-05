"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Field, inputCls } from "@/components/ui";
import type { FormState } from "./actions";

type F = { name: string; label: string; type?: string; autoComplete?: string; placeholder?: string; hint?: string; optional?: boolean };

export function AuthForm({ action, fields, submit, hidden = {} }: { action: (s: FormState, f: FormData) => Promise<FormState>; fields: F[]; submit: string; hidden?: Record<string, string> }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  // Controlled values: React resets uncontrolled fields after every action, which wiped the email after a wrong password.
  const [values, setValues] = useState<Record<string, string>>({});
  // The error belongs to the attempt that caused it; editing any field clears it.
  const [shownFor, setShownFor] = useState<FormState>(undefined);
  const error = state?.error && state !== shownFor ? state.error : null;
  return (
    <form action={formAction} className="space-y-4">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {fields.map((f) => (
        <Field key={f.name} label={f.label} hint={f.hint}>
          <input
            name={f.name}
            type={f.type ?? "text"}
            autoComplete={f.autoComplete}
            placeholder={f.placeholder}
            className={inputCls}
            required={!f.optional}
            value={values[f.name] ?? ""}
            onChange={(e) => {
              setValues((v) => ({ ...v, [f.name]: e.target.value }));
              setShownFor(state);
            }}
          />
        </Field>
      ))}
      {error && <Alert>{error}</Alert>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "One moment…" : submit}
      </Button>
    </form>
  );
}
