# JEWELFIND Phase 6

Phase 6 adds administrator fulfillment handling and private, per-request customer notifications. Existing Phase 5 customer deduplication remains unchanged. No external messaging, payment, final quote, or Phase 7 functionality is enabled.

## Entry points

- `/admin`: Supabase email/password sign-in, authorized through `admin_users.user_id` on the backend. No sign-up, invitation, email sending or password-reset flow is exposed by the app.
- `/my-requests`: requests saved in this browser.
- `/my-requests/:id`: status, App notices and viewing reply. Each new successful submission receives a random 256-bit capability, stored in the browser. Its share link uses a URL fragment; only the SHA-256 hash is stored in Supabase. Possession grants access to that request only, never customer contact data or another request from the same phone number. Customers should save the private link and not publish it. No phone-only lookup is permitted.
- Phase 5 historical requests remain in the admin list. They have no previously issued customer access capability and cannot be recovered by entering a phone number. A future verified recovery/login process is outside this MVP.

## Database

Apply `supabase/migrations/202609160001_phase6.sql` once after the Phase 5 migration. It creates:

| Table | Purpose |
| --- | --- |
| service_regions | Enabled service areas, initially 台北市 and 新北市 |
| admin_users | Authorized Supabase Auth user UUIDs |
| request_fulfillments | Current fulfillment stage, partner, arrival, destination, deadline and optimistic version |
| request_activity | Internal notes and state-change history |
| request_notifications | Customer-safe App messages, arrival snapshots, published/read timestamps and channel |
| viewing_responses | Reply, proposed date and note, keyed to each arrival notification |
| request_access | Per-request token hash |

All tables have RLS. Private tables have no direct anon/authenticated grants. Only active service regions are publicly readable. Admin RPCs require `auth.uid()` membership, not a frontend email comparison. Admin storage SELECT is restricted to the private `reference-photos` bucket and authorized admins; signed image links expire in five minutes. No service role key is placed in the frontend.

The existing `customers` and `match_requests` columns are not repurposed. A new before-insert trigger rejects unsupported viewing regions, and an after-insert trigger initializes fulfillment. Previously submitted non-Taipei requests remain readable. Consumer residence is saved independently from viewing region. Add future regions through `service_regions` and update the form choices when expanding the pilot.

`submit_viewing_request_v6` wraps the existing transactional, idempotent Phase 5 RPC and saves the capability hash in the same transaction. The deployed `submit-viewing` Edge Function accepts `accessToken` and `viewingRegion`; legacy clients remain compatible with the original RPC but are subject to the new area restriction for new requests. JWT verification remains enabled and the current frontend uses the existing legacy anon JWT.

## Workflow

New → checking → transferring → in transit → arrived. Checking/transferring/in-transit can report unavailable. Unavailable/arrived can return to checking with an internal explanation; old notices and responses remain intact. Arrived plus a current “yes” reply displays as awaiting viewing.

Arrival day is day 1. Default deadline is arrival + 6 calendar days, ending at 23:59 Asia/Taipei. The backend rejects later deadlines, future arrival dates, stale administrator versions, stale arrival replies and “yes” responses after expiry. Original requested viewing time is immutable through admin APIs.

In-transit, unavailable, arrival and rearrangement notices are published transactionally with state updates. Customers fetch current notices on opening the request, browser focus, manual refresh and every 30 seconds while visible. Opening the request records notice read timestamps. These are App records, not OS push or external message delivery receipts.

Customer replies: yes, reschedule (optional proposed date/note), declined. Customers may update a current reply. Replies from prior arrival arrangements remain separate. No sale price is collected.

## Administrator setup

Create the administrator manually in Supabase Authentication → Users → Add user → Create new user with Auto confirm enabled. Set the password personally; do not paste it into source code or chat. An authorized project owner grants membership using the exact Auth UUID:

```sql
insert into public.admin_users(user_id) values ('AUTH_USER_UUID') on conflict do nothing;
```

`linda62393@gmail.com` was verified as confirmed Auth user `9d82b3ff-d63c-4124-9286-9d032e9bfbbe` and granted membership on 2026-09-17. Email alone never grants permissions. No public signup can become an admin.

## Validation

Run `node --test tests/*.test.mjs`, TypeScript compilation, ESLint, and the Vite production build. `supabase/tests/phase6.sql` runs transactional fixtures then rolls back, testing authorization, transitions, concurrency, safe failure messages, deadlines, all reply choices, immutable originals, historical replies and stale/expired rejection.

Live submission checks used phone `0991662601`: request IDs `d7073166-95cc-4de3-baaa-e4873f70454e` and `48587d47-dc2e-4195-a61d-2be7cb1d2d07`. SQL verified 1 Customer + 2 Match Requests. Public API checks verified idempotent retries, wrong-request token denial, anonymous admin/table denial and non-service-region rejection. These are labeled test data, not real viewing arrangements.

The browser-flow test request is `6a9131e4-73e2-433c-863a-d60ce5a32e65`, customer name `Phase6畫面驗收`, phone `0991662600`. The complete browser flow passed on 2026-09-17: real submission, authorized admin processing, transit and arrival notices, reschedule reply with date/note, admin readback, then a yes reply and awaiting-viewing status. Final acceptance completed on 2026-09-18 with real API isolation checks, private photo rendering and public/anonymous denial, safe unavailability notice, existing recommendation batch/style regression, all nine unit tests, frontend/Edge type checks, ESLint and production build. The photo/unavailability test request is `3e7b0dff-925d-4b8c-8de0-f0681f271ec9`. Existing Fast Refresh and bundle-size warnings are non-blocking. No Phase 7 work or paid integrations were enabled.

## Manual acceptance

1. Complete all five questions and submit a product viewing request, selecting Taipei or New Taipei separately from residence. Open the success page’s progress link; save its private link.
2. Sign into `/admin`, search the test name/phone, open its independent request, verify original answers, product and time.
3. Move to checking then transferring (source partner required), then in transit. Refresh the customer request and confirm the safe in-transit notice.
4. Move to arrived and enter the store, address and arrival date. Confirm the default seven-day deadline and App arrival notice.
5. Customer chooses each supported reply as needed. Refresh admin and verify saved reply/date/note and read status. Original requested time must be unchanged.
6. Use a separate test request for unavailable; enter a truthful private reason, verify only the safe public text appears, and re-arrange when needed.
7. Verify a signed-out admin cannot load client data. Another request’s token must fail. A cleared browser cannot recover requests by phone.
