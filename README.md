# Tapspace · NFC Tag Manager

Manage NFC tags **only on your computer**. Vercel serves the public sticker URLs and records scans, using a Supabase publishable key with two narrow database capabilities. Your Mac holds the management credential. Tags keep working while your Mac is off.

## Two modes

| Runtime                                 | Behavior                                                                                                 | Credentials                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Public Vercel deployment                | `/nfc/[id]` redirects and scan recording; dashboard, login, callback, and management APIs return **404** | Supabase URL + publishable/anon key only                                |
| Local computer (`APP_MODE=local-admin`) | Authenticated dashboard, tag editing, QR codes, scan history                                             | Local-only Supabase secret key, owner allowlist, session signing secret |

Unset or unrecognized `APP_MODE` means redirects only. Management is **always disabled on Vercel**, even if `APP_MODE=local-admin` is accidentally copied there. The local start commands bind to `127.0.0.1`; Host and Origin checks provide additional protection. Never expose or tunnel the local dashboard to the internet.

The app uses Next.js App Router, TypeScript, Tailwind, shadcn/ui, and Supabase PostgreSQL/Auth.

## Existing deployment: switch safely

The public sticker origin is **https://nfc-gamma-nine.vercel.app**. Keep this hostname and the same database so existing stickers remain valid.

1. Apply the new `supabase/migrations/20261031164151_split_public_redirect_capabilities.sql` migration **before deploying this change**. For a fresh database, apply both migration files in filename order. They preserve existing tags, identifiers, destinations, and scans.
2. Configure Vercel using only the values in `.env.public.example`:

   ```dotenv
   APP_MODE=redirects
   NEXT_PUBLIC_APP_URL=https://nfc-gamma-nine.vercel.app
   SUPABASE_URL=<your Supabase project URL>
   SUPABASE_PUBLISHABLE_KEY=<your publishable key or legacy anon key>
   ```

   Remove `SUPABASE_SECRET_KEY`, `SESSION_SECRET`, `ADMIN_EMAILS`, `ADMIN_APP_URL`, and the obsolete `CRON_SECRET` from Vercel. Do not copy `.env.local` to Vercel. A secret/service-role key in the publishable-key setting is rejected.

3. Redeploy. Signed-out and signed-in requests to `/`, `/login`, `/auth/callback`, `/dashboard/*`, and `/api/*` should return 404. Known active `/nfc/[id]` links should still return 307 with `no-store` headers.
4. Remove older deployments that still serve the hosted dashboard. If a management key was stored in an older deployment, rotate that key and update the local copy; removing an environment variable from new deployments does not remove it from old ones.
5. Set up database-side retention below. The former Vercel cron route and schedule have been removed.

CLI migration alternative (Supabase CLI installed and authenticated):

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run
supabase db push
supabase db advisors --linked
```

Use a dedicated Supabase project. Keep `public` in the Data API's exposed schemas, and **do not expose `nfc_private`**. The migration enables only the two public lookup/scan wrappers for the anonymous role. RLS and revoked table privileges still prevent reading the tag table, private names/notes/history, and all tag mutations. Statistics, session lookup, rate limiting, and retention RPCs remain service-only. Anonymous callers who know a tag URL can resolve it and record scans; these operations are intentionally public.

## Run the dashboard on your Mac

Use Node.js 22 or newer:

```sh
npm ci
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable                   | Local value                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `APP_MODE`                 | `local-admin` (also explicitly selected by the local start commands)               |
| `ADMIN_APP_URL`            | `http://localhost:3000` — loopback origins only                                    |
| `NEXT_PUBLIC_APP_URL`      | `https://nfc-gamma-nine.vercel.app` — the **public sticker origin**, not localhost |
| `SUPABASE_URL`             | Same Supabase project as the public server                                         |
| `SUPABASE_PUBLISHABLE_KEY` | Same publishable key or legacy anon key                                            |
| `SUPABASE_SECRET_KEY`      | Local-only secret key or legacy service_role key                                   |
| `ADMIN_EMAILS`             | Comma-separated exact approved email addresses                                     |
| `SESSION_SECRET`           | At least 32 random characters; generate with `openssl rand -hex 32`                |

Then:

```sh
npm run dev
```

Open **http://localhost:3000** on this computer. If you change ports, update `ADMIN_APP_URL` and the Supabase callback allowlist to match. The public sticker URL never changes.

To use an optimized local build instead:

```sh
npm run build
npm run start:local
```

`npm start` runs the default redirect-only mode, bound to loopback. For the local dashboard use `start:local`. Local HTTP cookies are HTTP-only and SameSite=Lax; they use Secure when the configured loopback origin uses HTTPS.

Keep `.env.local` out of Git and cloud hosting. No Supabase project or credentials are invented by this repository. Without the required configuration the local login page shows setup guidance.

## Local email sign-in

Email sign-in remains an extra safeguard for the local dashboard. No public signup is provided.

1. In Supabase Authentication, enable email auth, **disable new-user signup**, and disable anonymous sign-ins and unused providers. Checked-in `supabase/config.toml` settings apply only to Docker-backed local Supabase; change hosted settings in the dashboard.
2. Add your email to local `ADMIN_EMAILS`, then provision it once:

   ```sh
   npm run admin:add -- you@example.com
   ```

   This reads `.env.local`, creates a confirmed owner, and sends no email. Alternatively use Supabase's admin UI to create a confirmed user. Login uses `shouldCreateUser: false`.

3. Set Supabase Auth Site URL to `http://localhost:3000`. Allow the exact callback **`http://localhost:3000/auth/callback`**. Remove the old Vercel callback from the allowlist. Use your chosen local port consistently.
4. Keep the Magic Link email template linked to `{{ .ConfirmationURL }}`:

   ```html
   <a href="{{ .ConfirmationURL }}">Sign in to Tapspace</a>
   ```

   The server uses PKCE and exchanges the one-use code at the local callback. Open the link in the **same browser on your Mac** that requested it. Opening it on your phone will not work. Expired/used links, a different browser, or email link scanners may require a fresh link.

5. Configure custom SMTP in Supabase for real delivery: host, port, username/password, verified sender. Disable email click tracking/link rewriting. Supabase's default sender has recipient restrictions and low limits. SMTP secrets belong in Supabase. Login responses deliberately do not reveal whether an email is allowed/provisioned; use Supabase delivery logs to troubleshoot.
6. Set JWT lifetime to 15 minutes. The app additionally enforces an absolute 12-hour session, checks the live Auth session on every management request, and revokes the current session on logout.

## Retention while your Mac is off

Enable **Supabase Cron** in the Supabase dashboard, then run `supabase/retention.sql` in its SQL editor as the project owner. It schedules `public.prune_history()` daily at 03:00 UTC. The named schedule is updated if run again. Check the job's run history in Supabase.

The function removes event details older than 90 days and expired rate-limit buckets. Lifetime scan counters and reserved identifiers remain. This runs in the database with no public HTTP cleanup endpoint or management key on Vercel. If Cron is not enabled, cleanup is not automatic; run `select public.prune_history();` manually until scheduled.

## Write and use a sticker

Create a tag locally and copy its **public NFC URL**. In an iPhone NFC writer such as NFC Tools, choose Write → Add a record → URL / URI, paste that URL, and write a compatible NDEF sticker. QR codes encode the same URL and are generated locally. Later edits happen in the local dashboard; the sticker never needs rewriting.

Public links return 307 temporary redirects with browser/CDN `no-store` headers. Missing/disabled tags share a generic unavailable page. DNS/storage outages can temporarily prevent resolution; failed scan analytics never prevent an otherwise valid redirect. HEAD requests do not count as scans. Counts include bots and link previews, and are not unique people.

Destinations allow public HTTPS URLs only: no embedded credentials, custom ports, or local/reserved IPs. DNS is checked at save and redirect time. The server never fetches the destination. Destination-controlled redirects and DNS rebinding cannot be fully prevented: use domains you trust. Random NFC URLs are **not authentication**, and every visitor can see the destination; protect sensitive resources at their source.

Scan events store only tag ID and timestamp. No IP addresses, location, user agents, or fingerprints are collected by the app. Provider infrastructure logs follow your Supabase/Vercel settings. Local management uses server authorization, bounded validated JSON, exact-origin CSRF checks, HTTP-only cookies, and PostgreSQL-backed rate limits. IDs use 192 random bits and remain permanently reserved after deletion.

## Verify

```sh
npm run check              # lint, TypeScript, unit/API/PostgreSQL tests, production build
npx playwright install chromium
npm run test:e2e           # builds, then tests separate local-admin and production public servers
npm run format:check
```

PGlite tests execute **all real migrations**, verify anonymous capability restrictions and RLS, and check ID reservation, scans, retention, and persistence across database restart. Browser tests use the real app, local-only mock Auth/PostgREST backed by PostgreSQL, and a separate **production** server with no management secrets and `VERCEL=1` (even with a deliberately wrong local-admin setting). They check public 404s, local login, creation, public redirects, destination edits without URL changes, scans, disable/delete, logout, and themes. The existing responsive layout is also regression-tested at an iPhone-sized viewport; it does not enable remote phone management.

Tests do not verify real SMTP, hosted Supabase PKCE internals, physical NFC hardware, or your live Vercel environment. After applying migrations/configuration, smoke-test a real email link on the Mac and the same physical sticker before and after a destination edit.

GitHub Actions runs the checks and browser tests. Dependencies are pinned, with the compatible patched `minimatch` override for the lint tooling. Screenshots go to ignored `output/playwright/`.

Sources: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [database function privileges](https://supabase.com/docs/guides/database/functions), [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart), [Next.js CLI](https://nextjs.org/docs/app/api-reference/cli/next).
