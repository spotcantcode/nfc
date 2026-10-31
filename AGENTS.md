<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Assigned local address

- NFC uses port `3187`, bound to `127.0.0.1`, with dashboard origin `http://localhost:3187`.
- Keep all local start commands on this port by default. Fail on conflicts rather than switching ports automatically.
- Keep the dashboard local-only; the public Vercel hostname is for NFC sticker redirects.
