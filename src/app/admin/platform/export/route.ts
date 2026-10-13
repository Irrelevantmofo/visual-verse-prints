import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { getPlatformFees, isDeveloper } from "@/lib/platform";

/** CSV of the platform fee ledger (optionally one month), for invoicing. Developer accounts only. */
export async function GET(request: NextRequest) {
  const me = await getCurrentProfile();
  if (!me || !me.active || me.role !== "admin" || !(await isDeveloper(me.id))) {
    return new NextResponse("Not found", { status: 404 });
  }

  const month = request.nextUrl.searchParams.get("month");
  const valid = month && /^\d{4}-\d{2}$/.test(month) ? month : null;
  const fees = (await getPlatformFees()).filter((f) => !valid || f.paid_on.startsWith(valid));

  const cell = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    // Quote everything and neutralise formula-leading characters so spreadsheets treat names as text
    return `"${(/^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  const rows = [
    ["Paid on", "Order no", "Client", "Entry", "Payment amount", "Fee rate", "Fee", "Note", "Recorded at"],
    ...fees.map((f) => [f.paid_on, f.order_no, f.client_name, f.kind, f.payment_amount.toFixed(2), f.fee_rate, f.fee.toFixed(2), f.note, f.created_at]),
    [],
    ["", "", "", "Total", fees.reduce((s, f) => s + f.payment_amount, 0).toFixed(2), "", fees.reduce((s, f) => s + f.fee, 0).toFixed(2), "", ""],
  ];
  const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="platform-fee-${valid ?? "all"}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
