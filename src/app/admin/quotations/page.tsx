import Link from "next/link";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { Tabs } from "@/components/staff/tabs";
import { diffDays, fmtDateShort, php, todayISO } from "@/lib/format";
import { FOLLOW_UP_FLAG, QUOTE_STATUS, followUpFlag, isOpenQuote } from "@/lib/labels";
import { getQuotations, getSettings } from "@/lib/queries";

export const metadata = { title: "Quotations" };

const FILTERS = ["open", "won", "lost", "all"] as const;
type Filter = (typeof FILTERS)[number];

export default async function QuotationsPage({ searchParams }: PageProps<"/admin/quotations">) {
  const { status: s } = await searchParams;
  const filter: Filter = FILTERS.includes(s as Filter) ? (s as Filter) : "open";
  const [all, settings] = await Promise.all([getQuotations(), getSettings()]);
  const today = todayISO();

  const match = (f: Filter) => (q: (typeof all)[number]) =>
    f === "all" ? true : f === "open" ? isOpenQuote(q.status) : q.status === f;
  const quotes = all.filter(match(filter));
  const openValue = all.filter(match("open")).reduce((sum, q) => sum + q.quoted_amount, 0);

  return (
    <>
      <PageHeader
        title="Quotations"
        description={`${php(openValue)} in open quotes`}
        actions={<ButtonLink href="/admin/quotations/new">New quotation</ButtonLink>}
      />
      <Tabs
        active={filter}
        items={[
          { key: "open", label: "Open", href: "/admin/quotations", count: all.filter(match("open")).length },
          { key: "won", label: "Won", href: "/admin/quotations?status=won", count: all.filter(match("won")).length },
          { key: "lost", label: "Lost", href: "/admin/quotations?status=lost", count: all.filter(match("lost")).length },
          { key: "all", label: "All", href: "/admin/quotations?status=all", count: all.length },
        ]}
      />
      <Card>
        {quotes.length === 0 ? (
          <EmptyState title="No quotations here">Create a quotation when you send a client a price.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Sent</Th>
                <Th>Client</Th>
                <Th>Agent</Th>
                <Th className="text-right">Amount</Th>
                <Th>Expires</Th>
                <Th>Status</Th>
                <Th>Follow-up</Th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const flag = followUpFlag(q.status, q.expires_on, today, settings.due_soon_days, diffDays);
                const days = diffDays(q.expires_on, today);
                return (
                  <tr key={q.id} className="hover:bg-paper">
                    <Td className="whitespace-nowrap">{fmtDateShort(q.date_sent)}</Td>
                    <Td>
                      <Link href={`/admin/quotations/${q.id}`} className="font-medium hover:underline">
                        {q.client_name}
                      </Link>
                      {q.description && <p className="text-xs text-graphite">{q.description}</p>}
                    </Td>
                    <Td>{q.agent_name ?? <span className="text-graphite">—</span>}</Td>
                    <Td className="text-right font-mono tabular">{php(q.quoted_amount)}</Td>
                    <Td className="whitespace-nowrap">
                      {fmtDateShort(q.expires_on)}
                      {flag && (
                        <p className="text-xs text-graphite">
                          {days < 0 ? `${-days}d ago` : days === 0 ? "today" : `in ${days}d`}
                        </p>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={QUOTE_STATUS[q.status].tone}>{QUOTE_STATUS[q.status].label}</Badge>
                    </Td>
                    <Td>{flag ? <Badge tone={FOLLOW_UP_FLAG[flag].tone}>{FOLLOW_UP_FLAG[flag].label}</Badge> : "—"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
