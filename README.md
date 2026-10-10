# Visual Verse Prints

Customer website plus admin and agent dashboards for Visual Verse Prints (Caloocan). This app replaces the
`visual_verse_daily_orders_pipeline` spreadsheet.

**Stack:** Next.js 16 (App Router) · Tailwind CSS 4 · Supabase (Postgres, Auth, RLS) · Vercel

## What's inside

| Area | Path | Who |
| --- | --- | --- |
| Landing page | `/` | Public. The services grid comes from the `products` table |
| Staff sign-in | `/login` | Admins and agents |
| Admin | `/admin` | Daily dashboard (mirrors the sheet's Dashboard tab), referral review, quotations, orders + payments, performance (WTD/MTD, top seller), agents, commissions and payouts, catalog, settings |
| Agent | `/agent` | Overview, my referrals with progress, refer a client, leaderboard, earnings |

### How the pipeline works

1. An **agent refers a client** (`/agent/referrals/new`). The referral starts as *Submitted*.
2. The **admin reviews** it (`/admin/referrals`) and approves it, or rejects it with a note the agent can see.
3. The admin creates **quotations** and **orders** linked to the referral. Each order is credited to the referring agent.
4. Commission is set **per order line**, because each product has a different margin. For example, an order with
   stickers at 12% and flyers at 5%. Each line's rate is pre-filled from the product's rate in the Catalog, then the
   agent's fallback rate, then the shop default (Settings), and the admin can change any line.
5. The admin records **payments**. The agent earns the order's commission as the client pays. For example, 25% paid
   means 25% of the commission is earned. Cancelled orders earn nothing, and saved orders keep their rates when
   defaults change later.
6. Agents follow each referral: Submitted → Approved → Quoted → In production → Ready → Delivered.
7. The **leaderboard** shows every agent's commission for the period. It uses a `security definer` function
   that returns totals only, so agents never see each other's clients.

### Online ordering (foundation, off by default)

Switch it on in **Admin → Settings → Accept orders on the website**, after adding at least one payment channel there.

1. A customer fills in the order form at `/order` (no account). They get a private order page at `/order/<code>`.
   That link is their session: it shows the order, and on a computer it shows a QR to open the same page on a phone.
2. The order arrives as **Needs pricing**. The admin sets line prices (Edit order) and clicks **Confirm price**.
3. The customer's page then shows the total, the shop's payment channels (QR, account name and number) and a
   receipt upload. Receipts go to private storage.
4. The admin checks each receipt under **Payments to verify** and verifies it (which records the payment and moves
   the order into production) or rejects it with a note the customer sees.

Customer actions run on the server with the secret key after checking the order code; nothing is opened to anonymous
database access. Website orders are left out of sales totals until they reach production. Not built yet, pending the
client's answers: artwork uploads, delivery options, agent order links, instant checkout for fixed-price items.

## Setup

1. **Env vars:** copy `.env.example` to `.env.local` and fill in the values from Supabase → Project Settings → API.
2. **Database:** apply the files in `supabase/migrations/` in order, using either the Supabase MCP or the SQL editor.
3. **Auth settings (Supabase dashboard → Authentication):**
   - Turn off **Allow new users to sign up**. Admins create agent accounts from `/admin/agents`.
   - Set **Site URL** to the production URL.
4. **First admin:**
   ```bash
   npx tsx scripts/create-admin.ts owner@example.com "Owner Name" "a-strong-password"
   ```
5. **Agents:** sign in as admin and add Bary, Mil, Nicko and Romeline at `/admin/agents`.
6. **Import the spreadsheet** (optional, one-time). Run it with `--dry-run` first:
   ```bash
   npx tsx scripts/import-xlsx.ts "path/to/visual_verse_daily_orders_pipeline.xlsx" --dry-run
   ```
7. `npm run dev`, then open http://localhost:3000.

## Deploying to Vercel

Import the repo in Vercel and set these environment variables: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_FACEBOOK_URL` and
`NEXT_PUBLIC_MESSENGER_URL`. `SUPABASE_SECRET_KEY` is server-only and is used to create agent accounts.

## Notes

- All dates are in Asia/Manila. Weeks start on Monday, matching the spreadsheet's `WEEKDAY(x,2)`.
- "Open quote pipeline" counts quotes that are *Sent / Pending* or *Follow-Up Scheduled* and not yet expired.
  The spreadsheet counted only *Pending*.
- Cancelled orders are left out of sales totals.
- Online ordering comes later. The schema already supports it: `orders.source = 'website'`, orders without an agent,
  `order_items.product_id`, and `payments` rows that a payment gateway webhook can insert.
- `src/components/logo.tsx` holds an SVG approximation of the shop's logo. Replace it with the official file when you have it.
