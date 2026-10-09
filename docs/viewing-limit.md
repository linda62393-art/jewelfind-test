# Three active viewing requests per customer

The consumer recommendation page and viewing form explain that each customer may have at most three products awaiting viewing arrangements. Staff arrange the actual shop and visit; a submitted preferred time is not a confirmed appointment.

The database counts requests for the existing customer identified by normalized Taiwan mobile number. Active stages are `new`, `checking`, `notified`, `transferring`, `in_transit`, and `arrived`. Cancelling, unavailability, sale, completed viewing, purchased, not purchased, or no-show releases a slot. Archiving or choosing a different requested date does not. A trigger protects both new submissions and administrative reopening. It uses the same phone advisory lock as the original submission transaction, so concurrent requests share the allowance. Existing active requests above the limit remain intact and can be processed; they cannot acquire another slot until below three.

The existing idempotent submission lookup returns the original receipt without consuming another slot. A rejected fourth submission rolls back the complete database transaction. The Edge Function returns HTTP 409 with the `viewing_request_limit` code; the filled form stays visible and links to the customer's requests. Staff receive a clear limit error on reopening.

The deployed submit-viewing handler was synchronized from the live version so its original 42-product catalog and Resend administrator notification remain intact. That live catalog previously differed from the repository's separate generated catalog; this change preserves live behavior rather than removing those products.

Verification: `pnpm test`, `pnpm lint`, Pages build, and `supabase/tests/viewing-limit.sql` executed against Supabase inside a rolled-back transaction. The SQL covers first three acceptance, fourth rejection without an inserted record, idempotent retry at capacity, requested-date and archive bypass attempts, every terminal outcome, reopening at capacity and after release, another customer, and normal active progress updates.
