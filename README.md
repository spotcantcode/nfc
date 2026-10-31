# Tapspace · NFC Tag Manager

A private, single-owner Next.js dashboard for permanent NFC links with editable destinations. Uses TypeScript, Tailwind, shadcn/ui, Supabase Auth/PostgreSQL, and Vercel. No custom domain required.

## Run locally

Use Node.js 22 or newer.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Without configuration, the sign-in page shows setup guidance; it does not enable a demo account. Fill in `.env.local` using your own project:

| Variable                   | Value                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`      | Fixed origin, e.g. `http://localhost:3000` locally; `https://your-project.vercel.app` in production. No path. |
| `SUPABASE_URL`             | Project API URL from Supabase → Connect                                                                       |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key (legacy anon key also works)                                                                  |
| `SUPABASE_SECRET_KEY`      | Server secret key (legacy service_role also works). Never prefix with `NEXT_PUBLIC_`.                         |
| `ADMIN_EMAILS`             | Comma-separated exact approved email addresses; case insensitive                                              |
| `SESSION_SECRET`           | Random secret of at least 32 characters; generate with `openssl rand -hex 32`                                 |
| `CRON_SECRET`              | Separate random secret for the daily retention job; generate with `openssl rand -hex 32`                      |

Keep `.env.local` and all keys out of Git. Only the app origin is public. Restart development/redeploy production after changing environment variables.

## Configure Supabase

Use a dedicated project. No external project, credentials, or SMTP service is automatically created by this repository.

1. Apply `supabase/migrations/20261031160704_initial_nfc_schema.sql` through the Supabase SQL editor, or use the CLI migration workflow below. Keep `public` in the Data API's exposed schemas. The migration explicitly grants access to `service_role`; both browser roles are denied.
2. In Authentication → Sign In / Providers, enable email auth and **disable new user signups**. Disable anonymous sign-ins and unused providers. `supabase/config.toml` applies these settings to local Supabase only; hosted settings must be changed in the dashboard.
3. Provision each approved owner once (this does not send an email):

   ```sh
   npm run admin:add -- you@example.com
   ```

   The script reads `.env.local` and requires the email to already appear in `ADMIN_EMAILS`. Alternatively, create a confirmed user using Supabase's admin dashboard. There is no signup screen; login always uses `shouldCreateUser: false`.

4. Set Authentication → URL Configuration → Site URL to the app's fixed origin. Allow the exact `https://your-project.vercel.app/auth/callback`; for development also allow `http://localhost:3000/auth/callback`. Avoid wildcard production redirect URLs. Preview deployments need their own explicit origin and callback or a separate project.
5. Keep the Magic Link email template linked to **`{{ .ConfirmationURL }}`**, for example:

   ```html
   <a href="{{ .ConfirmationURL }}">Sign in to Tapspace</a>
   ```

   The server starts Supabase's supported PKCE flow; the confirmation URL verifies the email and returns a one-use `code` to `/auth/callback`, where it is exchanged using the HTTP-only verifier cookie. Open the link in the **same browser** that requested it. A different browser, an expired/used link, or an aggressive email scanner may require a fresh link. Do not replace the template with a token-hash/implicit-flow URL; this app intentionally uses the code exchange.

6. Configure custom SMTP in Supabase for real delivery (host, port, username/password, verified sender). Supabase's built-in sender has restricted recipients and low limits. Disable click tracking/link rewriting in your SMTP provider. SMTP credentials belong in Supabase, not in this app. Check delivery logs when no email arrives; the app deliberately gives the same login response for allowed, unknown, and unprovisioned emails.
7. Set the Supabase JWT lifetime to 15 minutes. If your Supabase plan supports session timeboxing/inactivity limits, configure these too. The app independently enforces an absolute **12-hour** sign-in lifetime, regardless of refresh, and checks the live `auth.sessions` record on every management request. Logout revokes the current Supabase session immediately.
8. Run Supabase Security Advisor after applying the migration. No browser role should have access to any app table or RPC. `is_live_session` is the sole security-definer helper: service-only, empty search path, and boolean-only access to the Auth session table. All other functions use invoker permissions.

CLI alternative (Supabase CLI installed and authenticated):

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run
supabase db push
supabase db advisors --linked
```

For a Docker-backed local Supabase, use `supabase start` and its local project values. The checked-in config disables signup; provision the owner with the script above. The application itself does not require Docker.

## Deploy to Vercel

1. Import this GitHub repository as a Next.js project. Use Node 22+, default build (`npm run build`), and no custom output directory.
2. Set all environment variables above in Vercel's Production environment. Set `NEXT_PUBLIC_APP_URL` to the chosen free production `.vercel.app` origin. Add that exact callback to Supabase and update its Site URL.
3. Deploy or redeploy. Requests under `/nfc/*` are public; `/dashboard/*` and all tag APIs require an approved live session. Vercel deployment protection must allow public access to the production NFC routes.
4. `vercel.json` schedules one daily retention job, compatible with Vercel Hobby's daily schedule. Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically. It removes event details older than 90 days and old rate-limit buckets; lifetime scan counters and reserved IDs remain. If deploying elsewhere, schedule the same authenticated GET `/api/cron/retention` daily. Never put the secret in the URL.
5. Smoke-test the real email flow, then create a tag, open its public URL while signed out, edit the destination, and open the same URL again. Test with the physical sticker before placing it.

**Keep the production hostname stable.** The sticker contains the full URL. A redeployment preserves all tags in Supabase, but renaming the Vercel project/domain or replacing the database requires keeping the old URL and data working. This app never stores tags in Vercel's ephemeral filesystem.

## Using a sticker

Create a tag, then copy its **NFC URL** from the dashboard. In a third-party iPhone NFC writer (e.g. NFC Tools), choose Write → Add a record → URL / URI, paste the NFC URL, and write to a compatible NDEF sticker. Later destination edits happen entirely in the dashboard; the sticker's URL and random ID stay unchanged. QR codes encode the same URL and are generated locally, without a third-party QR service.

## Security and data behavior

- Every page that loads private data and every management endpoint independently verifies Supabase identity, the current server email allowlist, the signed absolute session expiry, and the live session. Removing an email takes effect on the next server request after your env change/redeployment.
- Authentication runs only on the server: PKCE, HTTP-only, SameSite=Lax cookies; Secure cookies in production; refresh in Next.js Proxy. No browser Supabase SDK or privileged keys. State-changing requests require the exact configured Origin and bounded, validated JSON. Security headers block framing, object embedding, and referrer leakage. CSP permits Next.js inline scripts; it is defense in depth, not a replacement for escaping and input validation.
- All app tables have RLS and explicit deny policies for `anon`/`authenticated`, plus revoked privileges. The server secret bypasses RLS only after application authorization. The public route calls a narrow lookup RPC returning only the destination of one active tag. Anonymous clients cannot enumerate tags or call RPCs directly.
- IDs use 24 cryptographically random bytes (192 bits), generated on the server. Database triggers reserve every ID permanently and reject identity changes/reuse, including after deletion. Deletion removes the tag and its scan details; the reserved identifier remains. Lifetime totals shown on the dashboard cover currently existing tags.
- Public GETs return **307** with browser/CDN `no-store` headers. Missing and disabled tags show the same generic page. Analytics runs after the response and cannot prevent redirects. HEAD requests do not count as scans. Network failures can lose an analytics event; counts include link previews/bots and are not unique human visitors.
- Destinations must use HTTPS, no credentials, no custom ports, and no local/reserved addresses. DNS records are checked at save and redirect time, including mixed public/private records. The server never fetches the destination. DNS failure returns a temporary unavailable page. DNS rebinding and destination-controlled redirect chains cannot be fully prevented by a link manager: only use domains you trust. Random URLs are **not authentication** and the destination is visible to every visitor; protect sensitive resources at their source.
- Scan events contain only a timestamp and tag ID. No IP addresses, user agents, geolocation, or fingerprints are recorded by the app. Login rate keys use an HMAC of the submitted email; no IP is stored. Vercel/Supabase may retain their own infrastructure logs under your account settings.
- PostgreSQL provides shared, atomic rate limiting across deployments/instances: 3 login attempts per email per 15-minute window plus a global 60/minute cap, 60 mutations/minute per owner, and 120 API reads/minute. It fails closed when storage is unavailable. Retention secrets and service keys are never returned to clients.

## Verify

```sh
npm run check             # lint, TypeScript, unit/API/PostgreSQL tests, production build
npx playwright install chromium
npm run test:e2e          # desktop + iPhone-sized Chromium browser journeys
```

Tests cover ID uniqueness/entropy, email allowlisting, session expiry/revocation, unauthenticated access and mutations, CSRF, URL and DNS validation, creation/editing, immutable IDs, retirement, redirects, no-store headers, analytics failure, retention, and persistence after a PostgreSQL restart. The database tests execute the actual migration in PGlite (PostgreSQL in WebAssembly), without credentials. Browser tests run the real app with a **test-only** local Auth/PostgREST stand-in backed by that migration; they verify the full create → redirect → edit → scan history → disable → delete → logout flow. They do not verify Supabase's own hosted PKCE implementation, real SMTP delivery, a live Vercel redeployment, or physical NFC hardware. Complete the production smoke test above after configuration.

GitHub Actions runs all checks and both browser journeys. Test screenshots are written to ignored `output/playwright/`.

Sources: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [PKCE details](https://supabase.com/docs/guides/auth/server-side/advanced-guide), [passwordless auth](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Next.js setup](https://nextjs.org/docs/app/getting-started/installation).
