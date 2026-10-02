"use client";

import { useActionState } from "react";
import { signIn } from "@/lib/actions/auth";
import { buttonStyles, Field, FormMessage, inputStyles, cx } from "@/components/ui";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState(signIn, notice ? { error: notice } : null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" required className={inputStyles} />
      </Field>
      <Field label="Password" htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputStyles} />
      </Field>
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className={cx(buttonStyles.primary, "w-full py-2.5")}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
