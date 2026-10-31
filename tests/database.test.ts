import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateId } from "@/lib/ids";
let db: PGlite;
let dir: string;
const migration = await readFile(
  new URL("../supabase/migrations/20261031160704_initial_nfc_schema.sql", import.meta.url),
  "utf8",
);
const insert = (id: string, name = "Studio") =>
  db.query(
    "insert into public.tags(id,name,destination_url) values ($1,$2,'https://example.com') returning *",
    [id, name],
  );
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "nfc-db-"));
  db = new PGlite(dir);
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);",
  );
  await db.exec(migration);
}, 30000);
afterAll(async () => {
  await db.close();
  await rm(dir, { recursive: true, force: true });
});
describe("actual PostgreSQL migration and persistence", () => {
  it("creates and edits tags without changing their permanent ID", async () => {
    const id = generateId();
    await insert(id);
    await db.query(
      "update public.tags set name='Renamed',destination_url='https://wikipedia.org',active=false where id=$1",
      [id],
    );
    const { rows } = await db.query<{
      id: string;
      name: string;
      active: boolean;
      destination_url: string;
    }>("select * from public.tags where id=$1", [id]);
    expect(rows[0]).toMatchObject({
      id,
      name: "Renamed",
      active: false,
      destination_url: "https://wikipedia.org",
    });
    await expect(
      db.query("update public.tags set id=$1 where id=$2", [generateId(), id]),
    ).rejects.toThrow(/immutable/);
  });
  it("reserves IDs forever, even after deleting tags", async () => {
    const id = generateId();
    await insert(id);
    await db.query("delete from public.tags where id=$1", [id]);
    await expect(insert(id)).rejects.toThrow(/duplicate key/);
    const reserved = await db.query("select id from public.reserved_tag_ids where id=$1", [id]);
    expect(reserved.rows).toHaveLength(1);
  });
  it("resolves active tags with only the destination column", async () => {
    const id = generateId();
    await insert(id);
    const result = await db.query("select * from public.resolve_nfc($1)", [id]);
    expect(result.rows).toEqual([{ destination_url: "https://example.com" }]);
    await db.query("update public.tags set active=false where id=$1", [id]);
    expect((await db.query("select * from public.resolve_nfc($1)", [id])).rows).toEqual([]);
    expect((await db.query("select * from public.resolve_nfc($1)", [generateId()])).rows).toEqual(
      [],
    );
  });
  it("atomically records scans while retaining configuration modification date", async () => {
    const id = generateId();
    await insert(id);
    const before = await db.query<{ updated_at: Date }>("select updated_at from tags where id=$1", [
      id,
    ]);
    await Promise.all(
      Array.from({ length: 10 }, () => db.query("select public.record_scan($1)", [id])),
    );
    const { rows } = await db.query<{
      scan_count: number;
      last_scanned_at: Date;
      updated_at: Date;
    }>("select * from tags where id=$1", [id]);
    expect(Number(rows[0].scan_count)).toBe(10);
    expect(rows[0].last_scanned_at).toBeTruthy();
    expect(rows[0].updated_at).toEqual(before.rows[0].updated_at);
    expect((await db.query("select * from scan_events where tag_id=$1", [id])).rows).toHaveLength(
      10,
    );
    await db.query("update tags set active=false where id=$1", [id]);
    await db.query("select public.record_scan($1)", [id]);
    expect(
      Number(
        (await db.query<{ scan_count: number }>("select scan_count from tags where id=$1", [id]))
          .rows[0].scan_count,
      ),
    ).toBe(10);
  });
  it("enforces durable rate limits", async () => {
    const key = generateId();
    const results = await Promise.all(
      Array.from({ length: 7 }, () =>
        db.query<{ ok: boolean }>("select public.consume_rate_limit($1,3,3600) as ok", [key]),
      ),
    );
    expect(results.map((r) => r.rows[0].ok)).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
  });
  it("denies anon and authenticated roles both tables and privileged functions", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      for (const table of ["tags", "scan_events", "reserved_tag_ids", "rate_limits"]) {
        await expect(db.query(`select * from public.${table}`)).rejects.toThrow(
          /permission denied/,
        );
        await expect(db.query(`delete from public.${table}`)).rejects.toThrow(/permission denied/);
      }
      await expect(db.query("select * from public.resolve_nfc('x')")).rejects.toThrow(
        /permission denied/,
      );
      await expect(db.query("select public.consume_rate_limit('x',10,60)")).rejects.toThrow(
        /permission denied/,
      );
      await expect(db.query("select public.is_live_session(null,null)")).rejects.toThrow(
        /permission denied/,
      );
      await db.exec("reset role");
    }
    const rls = await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where relname in ('tags','scan_events','reserved_tag_ids','rate_limits')",
    );
    expect(rls.rows).toHaveLength(4);
    expect(rls.rows.every((r) => r.relrowsecurity)).toBe(true);
  });
  it("RLS still denies reads and writes if a browser role accidentally receives table grants", async () => {
    await db.exec(
      "grant select, insert, update, delete on public.tags to anon, authenticated; grant insert on public.reserved_tag_ids to anon, authenticated",
    );
    try {
      for (const role of ["anon", "authenticated"]) {
        await db.exec(`set role ${role}`);
        expect((await db.query("select * from public.tags")).rows).toEqual([]);
        await expect(insert(generateId())).rejects.toThrow(/row-level security/);
        expect((await db.query("delete from public.tags returning id")).rows).toEqual([]);
        await db.exec("reset role");
      }
    } finally {
      await db.exec(
        "reset role; revoke all on public.tags, public.reserved_tag_ids from anon, authenticated",
      );
    }
  });
  it("service role can create and delete tags but cannot remove reservations", async () => {
    await db.exec("set role service_role");
    const id = generateId();
    await insert(id);
    await db.query("select public.record_scan($1)", [id]);
    await db.query("delete from tags where id=$1", [id]);
    await expect(db.query("delete from reserved_tag_ids where id=$1", [id])).rejects.toThrow(
      /permission denied/,
    );
    await db.exec("reset role");
  });
  it("removes 90-day events while preserving lifetime counters and retired IDs", async () => {
    const id = generateId();
    await insert(id);
    await db.query("select public.record_scan($1)", [id]);
    await db.query("update scan_events set scanned_at=now()-interval '91 days' where tag_id=$1", [
      id,
    ]);
    await db.exec("select public.prune_history()");
    expect((await db.query("select * from scan_events where tag_id=$1", [id])).rows).toHaveLength(
      0,
    );
    expect(
      Number(
        (await db.query<{ scan_count: number }>("select scan_count from tags where id=$1", [id]))
          .rows[0].scan_count,
      ),
    ).toBe(1);
  });
  it("rejects revoked/expired Auth sessions immediately", async () => {
    const user = "00000000-0000-0000-0000-000000000001",
      session = "00000000-0000-0000-0000-000000000002";
    await db.query("insert into auth.sessions(id,user_id) values ($1,$2)", [session, user]);
    expect(
      (
        await db.query<{ ok: boolean }>("select public.is_live_session($1,$2) as ok", [
          session,
          user,
        ])
      ).rows[0].ok,
    ).toBe(true);
    await db.query("delete from auth.sessions where id=$1", [session]);
    expect(
      (
        await db.query<{ ok: boolean }>("select public.is_live_session($1,$2) as ok", [
          session,
          user,
        ])
      ).rows[0].ok,
    ).toBe(false);
  });
  it("keeps tag destinations and reservations across application/database restart", async () => {
    const id = generateId();
    await insert(id, "Persistent");
    await db.query("update tags set destination_url='https://wikipedia.org' where id=$1", [id]);
    await db.close();
    db = new PGlite(dir);
    expect((await db.query("select * from public.resolve_nfc($1)", [id])).rows).toEqual([
      { destination_url: "https://wikipedia.org" },
    ]);
    expect((await db.query("select id from reserved_tag_ids where id=$1", [id])).rows).toHaveLength(
      1,
    );
  });
});
