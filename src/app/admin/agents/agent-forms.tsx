"use client";

import { useActionState, useState } from "react";
import { createAgent, resetAgentPassword, updateAgent } from "@/lib/actions/admin";
import { buttonStyles, cx, Field, FormMessage, inputStyles } from "@/components/ui";
import type { Profile } from "@/types/db";

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export function NewAgentForm({ defaultRatePct }: { defaultRatePct: number }) {
  const [state, action, pending] = useActionState(createAgent, null);
  const [password, setPassword] = useState("");
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" htmlFor="full_name" error={fe.full_name}>
        <input id="full_name" name="full_name" required className={inputStyles} />
      </Field>
      <Field label="Email" htmlFor="email" error={fe.email} hint="They sign in with this.">
        <input id="email" name="email" type="email" required className={inputStyles} />
      </Field>
      <Field label="Phone" htmlFor="phone">
        <input id="phone" name="phone" className={inputStyles} />
      </Field>
      <Field label="Commission rate (%)" htmlFor="commission_rate" hint={`Blank uses the default (${defaultRatePct}%).`} error={fe.commission_rate}>
        <input id="commission_rate" name="commission_rate" type="number" min="0" max="100" step="0.1" className={cx(inputStyles, "font-mono")} />
      </Field>
      <Field label="Temporary password" htmlFor="password" error={fe.password} hint="Share it privately. They can change it after signing in." className="sm:col-span-2">
        <div className="flex gap-2">
          <input
            id="password"
            name="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={cx(inputStyles, "font-mono")}
            autoComplete="off"
          />
          <button type="button" className={buttonStyles.secondary} onClick={() => setPassword(randomPassword())}>
            Generate
          </button>
        </div>
      </Field>
      <div className="space-y-3 sm:col-span-2">
        <FormMessage state={state} />
        <button disabled={pending} className={buttonStyles.primary}>
          {pending ? "Adding…" : "Add agent"}
        </button>
      </div>
    </form>
  );
}

export function EditAgentForm({ agent }: { agent: Profile }) {
  const [state, action, pending] = useActionState(updateAgent, null);
  const fe = state?.fieldErrors ?? {};
  const id = agent.id.slice(0, 8);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem_auto] sm:items-end">
      <input type="hidden" name="id" value={agent.id} />
      <Field label="Name" htmlFor={`name-${id}`} error={fe.full_name}>
        <input id={`name-${id}`} name="full_name" defaultValue={agent.full_name} className={inputStyles} />
      </Field>
      <Field label="Phone" htmlFor={`phone-${id}`}>
        <input id={`phone-${id}`} name="phone" defaultValue={agent.phone ?? ""} className={inputStyles} />
      </Field>
      <Field label="Rate (%)" htmlFor={`rate-${id}`} error={fe.commission_rate}>
        <input
          id={`rate-${id}`}
          name="commission_rate"
          type="number"
          min="0"
          max="100"
          step="0.1"
          placeholder="Default"
          defaultValue={agent.commission_rate != null ? +(agent.commission_rate * 100).toFixed(2) : ""}
          className={cx(inputStyles, "font-mono")}
        />
      </Field>
      <div className="flex items-center gap-3 pb-2">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={agent.active} className="size-4 accent-[var(--color-foil-dark)]" />
          Active
        </label>
        <button disabled={pending} className={buttonStyles.secondary}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <div className="sm:col-span-4">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function ResetPasswordForm({ agentId }: { agentId: string }) {
  const [state, action, pending] = useActionState(resetAgentPassword, null);
  const [password, setPassword] = useState("");
  const id = `pw-${agentId.slice(0, 8)}`;
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={agentId} />
      <div>
        <label htmlFor={id} className="mb-1 block text-xs text-graphite">
          New temporary password
        </label>
        <input
          id={id}
          name="password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={cx(inputStyles, "w-48 font-mono")}
          autoComplete="off"
        />
      </div>
      <button type="button" className={buttonStyles.ghost} onClick={() => setPassword(randomPassword())}>
        Generate
      </button>
      <button disabled={pending} className={buttonStyles.secondary}>
        {pending ? "Setting…" : "Set password"}
      </button>
      <div className="w-full">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
