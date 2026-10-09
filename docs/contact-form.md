# Partnership contact form

The homepage card opens `/contact` (`/#/contact` on GitHub Pages). The form has Chinese and English labels. It submits to the `submit-contact` Supabase Edge Function using the existing public anon JWT. Deploy this function before publishing the frontend.

Mail goes only to the confirmed administrator mailbox `linda62393@gmail.com`. The visitor's email is used as `reply_to`, never as the sending address. The endpoint sends plain text and does not change viewing requests, customers or order records.

Server settings:

- `RESEND_API_KEY`: existing Resend API key, stored only in Supabase secrets.
- `ALLOWED_ORIGINS`: existing comma-separated list of allowed website origins.
- `CONTACT_FROM_EMAIL`: optional verified sending address. Existing `RESEND_FROM_EMAIL`, `EMAIL_FROM`, or `MAIL_FROM` are also accepted. Otherwise `JEWELFIND <onboarding@resend.dev>` is used, which Resend restricts to the account owner's email.

The existing service-role-only `allow_viewing_submission` RPC limits submissions. Contact keys are hashed with a separate `contact` namespace; the shared global request budget also applies. Validation, consent, a honeypot, a 24 KB body limit, provider timeout and fixed recipient prevent arbitrary email relay. Identical uncertain retries retain a submission UUID, passed as Resend's idempotency key (within Resend's retention period). Provider failure preserves the filled form and never shows success.

Run `pnpm test`, `pnpm lint`, and `pnpm build:pages`. Validate a real test email to the administrator mailbox. An API acceptance response confirms Resend accepted the email; final inbox arrival can be checked in Resend delivery logs or the recipient inbox.
