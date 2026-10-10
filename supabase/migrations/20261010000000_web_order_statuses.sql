-- Website orders start before production: the shop prices them, then the customer pays.
-- (New enum values must be committed before anything can use them, so this is its own migration.)
alter type public.order_status add value if not exists 'pending_review' before 'in_progress';
alter type public.order_status add value if not exists 'awaiting_payment' before 'in_progress';
