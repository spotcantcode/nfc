import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  rpc: vi.fn(),
  rate: vi.fn(),
  destination: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  list: vi.fn(),
  scans: vi.fn(),
  otp: vi.fn(),
  after: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.auth }));
vi.mock("@/lib/supabase/admin", () => ({ adminDb: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mocks.rate,
  privateKey: (s: string) => `hashed:${s}`,
}));
vi.mock("@/lib/destination", () => ({ publicDestination: mocks.destination }));
vi.mock("@/lib/tags", () => ({
  createTag: mocks.create,
  updateTag: mocks.update,
  deleteTag: mocks.remove,
  listTags: mocks.list,
  scanHistory: mocks.scans,
}));
vi.mock("@/lib/supabase/server", () => ({
  authClient: async () => ({ auth: { signInWithOtp: mocks.otp } }),
}));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: mocks.after,
}));
import { HttpError } from "@/lib/http";
import { POST as create, GET as list } from "@/app/api/tags/route";
import { PATCH as update, DELETE as remove } from "@/app/api/tags/[id]/route";
import { GET as scans } from "@/app/api/tags/[id]/scans/route";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as redirect, HEAD as head } from "@/app/nfc/[id]/route";
const id = "a".repeat(32);
const ctx = { params: Promise.resolve({ id }) };
const input = {
  name: "Studio",
  destination_url: "https://example.com/",
  description: "",
  active: true,
};
function request(
  path = "/api/tags",
  method = "POST",
  data: unknown = input,
  origin = "https://nfc.example.com",
) {
  return new Request(`https://nfc.example.com${path}`, {
    method,
    headers: { origin, "content-type": "application/json" },
    ...(method === "GET" || method === "HEAD" ? {} : { body: JSON.stringify(data) }),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ id: "owner", email: "owner@example.com" });
  mocks.destination.mockImplementation(async (url) => url);
  mocks.rpc.mockResolvedValue({ data: [{ destination_url: "https://example.com" }], error: null });
});
describe("management routes authorize every request", () => {
  it("rejects all anonymous reads and mutations before touching storage", async () => {
    mocks.auth.mockRejectedValue(new HttpError(401, "Sign in"));
    const results = await Promise.all([
      create(request()),
      update(request("/api/tags/" + id, "PATCH"), ctx),
      remove(request("/api/tags/" + id, "DELETE"), ctx),
      list(request("/api/tags", "GET")),
      scans(request(`/api/tags/${id}/scans`, "GET"), ctx),
    ]);
    for (const response of results) {
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toContain("no-store");
    }
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.scans).not.toHaveBeenCalled();
  });
  it("rejects cross-origin mutations", async () => {
    const res = await create(request("/api/tags", "POST", input, "https://evil.com"));
    expect(res.status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("creates and edits validated tags without accepting a caller-provided ID", async () => {
    mocks.create.mockResolvedValue({ ...input, id });
    mocks.update.mockResolvedValue({ ...input, id, name: "New" });
    expect((await create(request())).status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(input);
    expect(
      (await update(request("/api/tags/" + id, "PATCH", { ...input, name: "New" }), ctx)).status,
    ).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(id, { ...input, name: "New" });
    expect((await create(request("/api/tags", "POST", { ...input, id }))).status).toBe(400);
    expect(mocks.rate).toHaveBeenCalledWith("write:owner", 60, 60);
  });
  it("rejects unsafe destinations and rate-limited writes", async () => {
    expect(
      (
        await create(
          request("/api/tags", "POST", { ...input, destination_url: "javascript:alert(1)" }),
        )
      ).status,
    ).toBe(400);
    mocks.rate.mockRejectedValue(new HttpError(429, "Wait"));
    expect((await create(request())).status).toBe(429);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("does not expose provider errors", async () => {
    mocks.create.mockRejectedValue(new Error("database password=secret"));
    const res = await create(request());
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain("password");
  });
});
describe("login allowlist and enumeration protection", () => {
  it("only sends links for approved emails, without creating accounts", async () => {
    const allowed = await login(request("/api/auth/login", "POST", { email: "owner@example.com" }));
    expect(mocks.otp).toHaveBeenCalledWith({
      email: "owner@example.com",
      options: {
        shouldCreateUser: false,
        emailRedirectTo: "https://nfc.example.com/auth/callback",
      },
    });
    mocks.otp.mockClear();
    const denied = await login(
      request("/api/auth/login", "POST", { email: "stranger@example.com" }),
    );
    expect(mocks.otp).not.toHaveBeenCalled();
    expect(allowed.status).toBe(denied.status);
    expect(await allowed.json()).toEqual(await denied.json());
  });
  it("returns the same response for provider failures", async () => {
    mocks.otp.mockResolvedValue({ error: { message: "No account" } });
    const res = await login(request("/api/auth/login", "POST", { email: "owner@example.com" }));
    expect(res.status).toBe(200);
    expect(await res.text()).not.toContain("No account");
  });
});
describe("public redirect routes", () => {
  it("uses 307 and disables all browser and CDN caching without authentication", async () => {
    const res = await redirect(request("/nfc/" + id, "GET"), ctx);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://example.com/");
    for (const header of ["cache-control", "cdn-cache-control", "vercel-cdn-cache-control"])
      expect(res.headers.get(header)).toContain("no-store");
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("resolve_nfc", { p_id: id });
    expect(mocks.after).toHaveBeenCalledOnce();
  });
  it("shows the same private error page for disabled and missing tags", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    const res = await redirect(request("/nfc/" + id, "GET"), ctx);
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain("Studio");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(mocks.after).not.toHaveBeenCalled();
  });
  it("rejects malformed IDs without querying storage", async () => {
    expect(
      (await redirect(request("/nfc/bad", "GET"), { params: Promise.resolve({ id: "bad" }) }))
        .status,
    ).toBe(404);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("continues redirecting when analytics fails", async () => {
    const res = await redirect(request("/nfc/" + id, "GET"), ctx);
    mocks.rpc.mockRejectedValue(new Error("storage down"));
    await expect(mocks.after.mock.calls[0][0]()).resolves.toBeUndefined();
    expect(res.status).toBe(307);
  });
  it("HEAD resolves without creating a scan", async () => {
    const res = await head(request("/nfc/" + id, "HEAD"), ctx);
    expect(res.status).toBe(307);
    expect(await res.text()).toBe("");
    expect(mocks.after).not.toHaveBeenCalled();
  });
  it("returns a no-store 503 if destination lookup fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "db error" } });
    const res = await redirect(request("/nfc/" + id, "GET"), ctx);
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});
