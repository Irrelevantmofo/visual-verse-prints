"use client";

import { useActionState } from "react";
import { addPayment, updateOrderStatus } from "@/lib/actions/admin";
import { buttonStyles, cx, Field, FormMessage, inputStyles } from "@/components/ui";
import { DELIVERY_STATUS, ORDER_STATUS, PAYMENT_METHOD } from "@/lib/labels";
import type { DeliveryStatus, OrderStatus } from "@/types/db";

export function StatusForm({ id, orderStatus, deliveryStatus }: { id: string; orderStatus: OrderStatus; deliveryStatus: DeliveryStatus }) {
  const [state, action, pending] = useActionState(updateOrderStatus, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <Field label="Order status" htmlFor="order_status">
        <select id="order_status" name="order_status" defaultValue={orderStatus} className={inputStyles}>
          {Object.entries(ORDER_STATUS).map(([k, m]) => (
            <option key={k} value={k}>
              {m.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Delivery status" htmlFor="delivery_status">
        <select id="delivery_status" name="delivery_status" defaultValue={deliveryStatus} className={inputStyles}>
          {Object.entries(DELIVERY_STATUS).map(([k, m]) => (
            <option key={k} value={k}>
              {m.label}
            </option>
          ))}
        </select>
      </Field>
      <FormMessage state={state} />
      <button disabled={pending} className={buttonStyles.secondary}>
        {pending ? "Updating…" : "Update status"}
      </button>
    </form>
  );
}

export function PaymentForm({ orderId, balance, today }: { orderId: string; balance: number; today: string }) {
  const [state, action, pending] = useActionState(addPayment, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="order_id" value={orderId} />
      <Field label="Amount (₱)" htmlFor="amount" error={fe.amount}>
        <input
          id="amount"
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          max={balance.toFixed(2)}
          defaultValue={balance > 0 ? balance.toFixed(2) : ""}
          required
          className={cx(inputStyles, "font-mono")}
        />
      </Field>
      <Field label="Date received" htmlFor="paid_on" error={fe.paid_on}>
        <input id="paid_on" name="paid_on" type="date" defaultValue={today} required className={inputStyles} />
      </Field>
      <Field label="Method" htmlFor="method">
        <select id="method" name="method" defaultValue="gcash" className={inputStyles}>
          {Object.entries(PAYMENT_METHOD).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Reference" htmlFor="reference" hint="GCash ref no., receipt no., etc.">
        <input id="reference" name="reference" className={inputStyles} />
      </Field>
      <div className="space-y-3 sm:col-span-2">
        <FormMessage state={state} />
        <button disabled={pending || balance <= 0} className={buttonStyles.gold}>
          {pending ? "Recording…" : "Record payment"}
        </button>
      </div>
    </form>
  );
}
