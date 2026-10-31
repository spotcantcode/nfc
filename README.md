# Tapspace · NFC Tag Manager

Manage NFC tags **only on your computer**. Vercel serves the public sticker URLs and records scans, using a Supabase publishable key with two narrow database capabilities. Your Mac holds the management credential. Tags keep working while your Mac is off.

## Two modes

| Runtime                                 | Behavior                                                                                                 | Credentials                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Public Vercel deployment                | `/nfc/[id]` redirects and scan recording; dashboard, login, callback, and management APIs return **404** | Supabase URL + publishable/anon key only                                |
| Local computer (`APP_MODE=local-admin`) | Authenticated dashboard, tag editing, QR codes, scan history                                             | Local-only Supabase secret key, owner allowlist, session signing secret |

Unset or unrecognized `APP_MODE` means redirects only. Management is **always disabled on Vercel**, even if `APP_MODE=local-admin` is accidentally copied there. The local start commands bind to `127.0.0.1`; Host and Origin checks provide additional protection. Never expose or tunnel the local dashboard to the internet.

The app uses Next.js App Router, TypeScript, Tailwind, shadcn/ui, and Supabase PostgreSQL/Auth.

## Database and deployment

Target: **cspotrn@gmail.com's Org → Coaches and Consultants**, project `buoueqgtrfbimncyrsss` ([table editor](https://supabase.com/dashboard/project/buoueqgtrfbimncyrsss/editor)). The main table is **`public.nfc`**. Supporting tables are `nfc_scan_events`, `nfc_reserved_ids`, and `nfc_rate_limits`; app RPCs are prefixed `nfc_`. Other applications' tables and functions are left unchanged.

The public sticker origin is **https://nfc-gamma-nine.vercel.app**. Keep this hostname and the same database so stickers remain valid.

1. The NFC schema is installed in the selected project, with migration `20261031165538` recorded. Source: `supabase/migrations/20261031165538_create_namespaced_nfc_tables.sql`. For another empty installation, apply only this file through the SQL editor or a targeted migration tool. Do not rerun it on the existing tables, reset the shared database, or reconcile its unrelated migration history with this NFC-only repository. The earlier, unapplied drafts with generic table names have been replaced.
2. Configure Vercel using only `.env.public.example`:

   ```dotenv
   APP_MODE=redirects
   NEXT_PUBLIC_APP_URL=https://nfc-gamma-nine.vercel.app
   SUPABASE_URL=https://buoueqgtrfbimncyrsss.supabase.co
   SUPABASE_PUBLISHABLE_KEY=<your publishable key or legacy anon key>
   ```

   Remove `SUPABASE_SECRET_KEY`, `SESSION_SECRET`, `ADMIN_EMAILS`, `ADMIN_APP_URL`, and the obsolete `CRON_SECRET` from Vercel. Keep management credentials only in the local `.env.local`. A secret/service-role key in the publishable-key setting is rejected.

3. Redeploy. Signed-out and signed-in requests to `/`, `/login`, `/auth/callback`, `/dashboard/*`, and `/api/*` should return 404. Known active `/nfc/[id]` links return 307 with `no-store` headers.
4. Remove older deployments that still serve the hosted dashboard. If an older deployment contained a management key, rotate that key and update the local copy; removing a new deployment's environment variable does not remove it from old deployments.
5. Set up database-side retention below; no Vercel cron or privileged cloud credential is needed.

Keep `public` exposed in the Data API and **do not expose `nfc_private`**. Only the two public wrappers (`nfc_resolve` and `nfc_record_scan`) are enabled for anonymous callers. RLS and revoked table privileges prevent reading the `nfc` table, names/notes/history, and all tag mutations. Statistics, session lookup, rate limiting, and retention remain service-only. A person who knows a tag URL can resolve it and record scans; these capabilities are deliberately public. Existing project policies for other apps are unchanged.

## Start the dashboard on your Mac

**Double-click `Start NFC.command` in the repository folder.** It opens Terminal, starts NFC on this computer only, and opens your browser when ready. Keep that Terminal window open; press **Control+C** to stop the app. Double-clicking again reopens an already-running NFC app.

The launcher requires Node.js 22+ (install from [nodejs.org](https://nodejs.org) if needed). It installs dependencies on the first run if they are missing, creates `.env.local` from `.env.example` if needed, and generates a private session secret. If a key is missing, it opens `.env.local` in TextEdit for one-time setup. Save the file and double-click the launcher again.

NFC's assigned local port is **3187**, bound to loopback IP **127.0.0.1**. Open **http://localhost:3187**. The double-click launcher, `npm run local`, `npm run dev`, and `npm run start:local` all use this port by default and report an error if it is occupied. Your stickers always use **https://nfc-gamma-nine.vercel.app**.

Only these settings belong in the local env template:

| Variable                   | Value                                                           |
| -------------------------- | --------------------------------------------------------------- |
| `ADMIN_APP_URL`            | `http://localhost:3187` — local dashboard address               |
| `NEXT_PUBLIC_APP_URL`      | `https://nfc-gamma-nine.vercel.app` — permanent sticker address |
| `SUPABASE_URL`             | `https://buoueqgtrfbimncyrsss.supabase.co`                      |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key or legacy anon key                     |
| `SUPABASE_SECRET_KEY`      | Secret key or legacy service_role key; keep only on this Mac    |
| `ADMIN_EMAILS`             | `cspotrn@gmail.com`, or your exact approved email addresses     |

The launcher supplies `APP_MODE=local-admin` and generates `SESSION_SECRET` automatically; you do not need to configure those in the template. Existing `.env.local` settings and an existing session secret are preserved. The file is restricted to your macOS user.

Terminal alternative: `npm run local`. For direct development, `npm run dev` also works after the launcher has prepared `.env.local`. For an optimized local build, run `npm run build` then `npm run start:local`.

If you change the local port in `.env.local`, update the Supabase callback allowlist to match. The launcher refuses to open a different app that is already using the chosen port. `npm start` selects the public redirect-only mode; use the launcher or `npm run local` for management.

Keep `.env.local` out of Git and Vercel. The separate `.env.public.example` lists the public deployment’s settings.

## Local email sign-in

Email sign-in remains an extra safeguard for the local dashboard. No public signup is provided.

1. This is a shared Supabase project: **do not change project-wide signup/provider/SMTP settings for NFC without checking the other apps**. NFC never creates accounts during login and checks its local `ADMIN_EMAILS` on every management operation. The deny policies on NFC tables also reject other apps’ authenticated users. Checked-in `supabase/config.toml` settings apply only to an isolated Docker-backed development project.
2. Add your email to local `ADMIN_EMAILS`, then provision it once:

   ```sh
   npm run admin:add -- you@example.com
   ```

   This reads `.env.local`, creates a confirmed owner, and sends no email. Alternatively use Supabase's admin UI to create a confirmed user. Login uses `shouldCreateUser: false`.

3. Add the exact callback **`http://localhost:3187/auth/callback`** to Supabase Auth’s redirect allowlist, preserving other apps’ URLs and the existing Site URL. NFC passes this local callback explicitly. Use your chosen local port consistently.
4. Keep the Magic Link email template linked to `{{ .ConfirmationURL }}`:

   ```html
   <a href="{{ .ConfirmationURL }}">Sign in to Tapspace</a>
   ```

   The server uses PKCE and exchanges the one-use code at the local callback. Open the link in the **same browser on your Mac** that requested it. Opening it on your phone will not work. Expired/used links, a different browser, or email link scanners may require a fresh link.

5. Reuse the project’s existing email provider/SMTP configuration. If delivery is unavailable, assess changes with the other apps before changing shared SMTP settings. The default sender has recipient restrictions and low limits. Login responses do not reveal whether an email is allowed/provisioned; use Supabase delivery logs to troubleshoot.
6. NFC enforces an absolute 12-hour session, checks the live Auth session on every management request, and revokes only its current session on logout. Preserve the shared project’s existing JWT/session configuration.

## Retention while your Mac is off

The selected project already has an active **Supabase Cron** job named `nfc-retention`, running `public.nfc_prune_history()` daily at 03:00 UTC. Check its run history in Supabase. For a separate installation, enable Supabase Cron and run `supabase/retention.sql` as the project owner; running that script again updates the named schedule.

The function removes event details older than 90 days and expired rate-limit buckets. Lifetime scan counters and reserved identifiers remain. This runs in the database with no public HTTP cleanup endpoint or management key on Vercel. If Cron is not enabled, cleanup is not automatic; run `select public.nfc_prune_history();` manually until scheduled.

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
