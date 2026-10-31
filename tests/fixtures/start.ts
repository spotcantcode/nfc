/** Local test-only Auth/PostgREST stand-in. Never imported by application code.
 * Actual application requests and the real migration run against PGlite here.
 * This does not test Supabase's hosted SMTP or its PKCE verifier implementation.
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
await db.exec(
  "create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);",
);
await db.exec(
  await readFile(
    new URL("../../supabase/migrations/20261031160704_initial_nfc_schema.sql", import.meta.url),
    "utf8",
  ),
);
const userId = "00000000-0000-0000-0000-000000000001",
  sessionId = "00000000-0000-0000-0000-000000000002";
const user = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "owner@example.com",
  email_confirmed_at: new Date().toISOString(),
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: new Date().toISOString(),
};
const token =
  [
    { alg: "HS256", typ: "JWT" },
    {
      sub: userId,
      email: user.email,
      role: "authenticated",
      session_id: sessionId,
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
  ]
    .map((v) => Buffer.from(JSON.stringify(v)).toString("base64url"))
    .join(".") + ".fixture-signature";
const server = createServer(async (req, res) => {
  const url = new URL(req.url!, "http://127.0.0.1:54329");
  let payload: Record<string, unknown> = {};
  const send = (data: unknown, status = 200) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(data));
  };
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      payload = raw ? JSON.parse(raw) : {};
    }
    if (url.pathname === "/health") return send({ ok: true });
    if (url.pathname === "/auth/v1/otp") return send({});
    if (url.pathname === "/auth/v1/token") {
      await db.query(
        "insert into auth.sessions(id,user_id) values ($1,$2) on conflict do nothing",
        [sessionId, userId],
      );
      return send({
        access_token: token,
        refresh_token: "fixture-refresh",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: "bearer",
        user,
      });
    }
    if (url.pathname === "/auth/v1/user")
      return req.headers.authorization === `Bearer ${token}`
        ? send(user)
        : send({ message: "Unauthorized" }, 401);
    if (url.pathname === "/auth/v1/logout") {
      await db.query("delete from auth.sessions where id=$1", [sessionId]);
      return send({});
    }
    if (req.headers.apikey !== "fixture-secret") return send({ message: "Forbidden" }, 403);
    const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/)?.[1];
    const functions: Record<string, string[]> = {
      resolve_nfc: ["p_id"],
      record_scan: ["p_id"],
      tag_stats: [],
      consume_rate_limit: ["p_key", "p_limit", "p_seconds"],
      is_live_session: ["p_session", "p_user"],
      prune_history: [],
    };
    if (rpc && functions[rpc]) {
      const args = functions[rpc];
      const result = await db.query(
        `select * from public.${rpc}(${args.map((_, i) => `$${i + 1}`).join(",")})`,
        args.map((k) => payload[k]),
      );
      return send(
        rpc === "resolve_nfc"
          ? result.rows
          : ((result.rows[0] as Record<string, unknown>)?.[rpc] ?? null),
      );
    }
    const table = url.pathname.replace("/rest/v1/", "");
    if (!["tags", "scan_events"].includes(table)) return send({ message: "Not found" }, 404);
    const id = url.searchParams.get("id")?.replace(/^eq\./, "");
    let result;
    if (req.method === "POST" && table === "tags") {
      result = await db.query(
        "insert into tags(id,name,destination_url,description,active) values ($1,$2,$3,$4,$5) returning *",
        [payload.id, payload.name, payload.destination_url, payload.description, payload.active],
      );
    } else if (req.method === "PATCH" && table === "tags") {
      result = await db.query(
        "update tags set name=$1,destination_url=$2,description=$3,active=$4 where id=$5 returning *",
        [payload.name, payload.destination_url, payload.description, payload.active, id],
      );
    } else if (req.method === "DELETE" && table === "tags") {
      result = await db.query("delete from tags where id=$1 returning id", [id]);
    } else {
      const values: unknown[] = [];
      const where: string[] = [];
      for (const key of table === "tags" ? ["name", "active", "id"] : ["tag_id"]) {
        const filter = url.searchParams.get(key);
        if (!filter) continue;
        const operator = filter.startsWith("ilike.") ? "ilike" : "=";
        values.push(filter.replace(/^(eq|ilike)\./, ""));
        where.push(`t.${key} ${operator} $${values.length}`);
      }
      const condition = where.length ? ` where ${where.join(" and ")}` : "";
      const count = await db.query<{ count: number }>(
        `select count(*) as count from ${table} t${condition}`,
        values,
      );
      const order = (url.searchParams.get("order") ?? "created_at.desc")
        .split(",")
        .map((part) => {
          const [field, direction] = part.split(".");
          if (
            ![
              "created_at",
              "name",
              "scan_count",
              "last_scanned_at",
              "updated_at",
              "id",
              "scanned_at",
            ].includes(field)
          )
            throw new Error("Unexpected sort");
          return `t.${field} ${direction === "asc" ? "asc" : "desc"} nulls last`;
        })
        .join(",");
      const limit = Math.min(100, Number(url.searchParams.get("limit")) || 20),
        offset = Number(url.searchParams.get("offset")) || 0;
      const select = table === "tags" ? "t.*" : "t.*, json_build_object('name',tags.name) as tags";
      const join = table === "scan_events" ? " join tags on tags.id=t.tag_id" : "";
      result = await db.query(
        `select ${select} from ${table} t${join}${condition} order by ${order} limit ${limit} offset ${offset}`,
        values,
      );
      res.setHeader(
        "content-range",
        `${offset}-${offset + result.rows.length - 1}/${count.rows[0].count}`,
      );
    }
    const single = String(req.headers.accept).includes("vnd.pgrst.object");
    return send(single ? (result.rows[0] ?? null) : result.rows, req.method === "POST" ? 201 : 200);
  } catch (error) {
    const e = error as Error & { code?: string };
    send({ message: e.message, code: e.code }, 400);
  }
});
await new Promise<void>((resolve) => server.listen(54329, "127.0.0.1", resolve));
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--port", "3109"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_APP_URL: "http://localhost:3109",
      SUPABASE_URL: "http://127.0.0.1:54329",
      SUPABASE_PUBLISHABLE_KEY: "fixture-publishable",
      SUPABASE_SECRET_KEY: "fixture-secret",
      ADMIN_EMAILS: user.email,
      SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
      CRON_SECRET: "fixture-cron",
    },
  },
);
const shutdown = () => {
  child.kill("SIGTERM");
  server.close();
  void db.close().then(() => process.exit());
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
child.on("exit", () => shutdown());
