"use client";

import { useActionState } from "react";
import { changePassword } from "@/lib/actions/auth";
import { buttonStyles, Field, FormMessage, inputStyles } from "@/components/ui";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, null);
  return (
    <form action={action} className="max-w-sm space-y-4">
      <Field label="New password" htmlFor="password" hint="At least 8 characters.">
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className={inputStyles} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm">
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className={inputStyles} />
      </Field>
      <FormMessage state={state} />
      <button disabled={pending} className={buttonStyles.primary}>
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
