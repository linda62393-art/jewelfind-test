# GitHub Pages deployment

Publish `main` through `.github/workflows/pages.yml`. In repository Settings → Pages,
set Source to **GitHub Actions** (the old `gh-pages` branch is no longer the source).
The workflow checks the locked dependencies, tests, lint and TypeScript before publishing only `dist`.

Repository Actions secrets required: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
Use the existing JEWELFIND legacy **anon** JWT because the Edge Function gateway verifies JWTs.
These are public browser configuration, even when stored in Actions secrets. Never supply
a service role key, password or private credential. Never commit local `.env*` files.

In Supabase Edge Function secrets, retain existing `ALLOWED_ORIGINS` entries and add
`https://linda62393-art.github.io` (no trailing slash or repository path).
Do not change RLS, JWT verification or database permissions for deployment.

Production build: `pnpm build:pages`. Preview: `pnpm preview --mode pages`.
Root development continues using BrowserRouter. Pages uses HashRouter, so reloadable URLs are:

- `https://linda62393-art.github.io/jewelfind-test/`
- `https://linda62393-art.github.io/jewelfind-test/#/admin`
- `https://linda62393-art.github.io/jewelfind-test/#/my-requests`

Customer capability links retain their key in the fragment, never the server query/path.
Browser storage is origin-specific: localhost request receipts and admin sessions do not
automatically move to the public site. Test a new public-site submission and sign in there.
Verify questionnaire, recommendations, images, viewing submission, admin handling, customer
notifications/replies and refresh before declaring production acceptance complete.
