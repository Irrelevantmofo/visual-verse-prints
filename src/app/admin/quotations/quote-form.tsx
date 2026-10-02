"use client";

import { useActionState, useState } from "react";
import { saveQuotation } from "@/lib/actions/admin";
import { addDays } from "@/lib/format";
import { buttonStyles, Field, FormMessage, inputStyles } from "@/components/ui";
import { QUOTE_STATUS } from "@/lib/labels";
import type { Quotation } from "@/types/db";

type Option = { id: string; label: string; agentId?: string; clientName?: string; clientContact?: string };

export function QuoteForm({
  quote,
  agents,
  referrals,
  defaults,
  validityDays,
}: {
  quote?: Quotation;
  agents: Option[];
  referrals: Option[];
  defaults: Partial<Quotation>;
  validityDays: number;
}) {
  const [state, action, pending] = useActionState(saveQuotation, null);
  const v = { ...defaults, ...quote };
  const [referralId, setReferralId] = useState(v.referral_id ?? "");
  const [agentId, setAgentId] = useState(v.agent_id ?? "");
  const [clientName, setClientName] = useState(v.client_name ?? "");
  const [clientContact, setClientContact] = useState(v.client_contact ?? "");
  const [dateSent, setDateSent] = useState(v.date_sent ?? "");
  const fe = state?.fieldErrors ?? {};

  const onReferral = (id: string) => {
    setReferralId(id);
    const r = referrals.find((x) => x.id === id);
    if (r) {
      if (r.agentId) setAgentId(r.agentId);
      if (r.clientName) setClientName(r.clientName);
      if (r.clientContact) setClientContact(r.clientContact);
    }
  };

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {quote && <input type="hidden" name="id" value={quote.id} />}

      <Field label="Referral" htmlFor="referral_id" hint="Links the quote to an agent's referral." className="sm:col-span-2">
        <select id="referral_id" name="referral_id" value={referralId} onChange={(e) => onReferral(e.target.value)} className={inputStyles}>
          <option value="">No referral (walk-in / direct)</option>
          {referrals.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Client name" htmlFor="client_name" error={fe.client_name}>
        <input id="client_name" name="client_name" required value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputStyles} />
      </Field>
      <Field label="Client contact" htmlFor="client_contact">
        <input id="client_contact" name="client_contact" value={clientContact} onChange={(e) => setClientContact(e.target.value)} className={inputStyles} />
      </Field>

      <Field label="Agent" htmlFor="agent_id" hint={referralId ? "Set by the referral." : undefined}>
        <select
          id="agent_id"
          name="agent_id"
          value={agentId}
          disabled={!!referralId}
          onChange={(e) => setAgentId(e.target.value)}
          className={inputStyles}
        >
          <option value="">No agent</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        {referralId && <input type="hidden" name="agent_id" value={agentId} />}
      </Field>
      <Field label="Quoted amount (₱)" htmlFor="quoted_amount" error={fe.quoted_amount}>
        <input
          id="quoted_amount"
          name="quoted_amount"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={v.quoted_amount ?? ""}
          className={`${inputStyles} font-mono`}
        />
      </Field>

      <Field label="Description" htmlFor="description" className="sm:col-span-2">
        <input id="description" name="description" placeholder="e.g. 500 cup sleeves, 2-color" defaultValue={v.description ?? ""} className={inputStyles} />
      </Field>

      <Field label="Date sent" htmlFor="date_sent" error={fe.date_sent}>
        <input id="date_sent" name="date_sent" type="date" required value={dateSent} onChange={(e) => setDateSent(e.target.value)} className={inputStyles} />
      </Field>
      <Field
        label="Expires on"
        htmlFor="expires_on"
        hint={quote ? undefined : dateSent ? `Leave blank for ${validityDays} days after sending (${addDays(dateSent, validityDays)}).` : undefined}
      >
        <input id="expires_on" name="expires_on" type="date" defaultValue={quote?.expires_on ?? ""} className={inputStyles} />
      </Field>

      <Field label="Status" htmlFor="status">
        <select id="status" name="status" defaultValue={v.status ?? "pending"} className={inputStyles}>
          {Object.entries(QUOTE_STATUS).map(([k, m]) => (
            <option key={k} value={k}>
              {m.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Follow up on" htmlFor="follow_up_on">
        <input id="follow_up_on" name="follow_up_on" type="date" defaultValue={v.follow_up_on ?? ""} className={inputStyles} />
      </Field>

      <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
        <textarea id="notes" name="notes" rows={3} defaultValue={v.notes ?? ""} className={inputStyles} />
      </Field>

      <div className="space-y-3 sm:col-span-2">
        <FormMessage state={state} />
        <button disabled={pending} className={buttonStyles.primary}>
          {pending ? "Saving…" : quote ? "Save quotation" : "Create quotation"}
        </button>
      </div>
    </form>
  );
}
