import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { managementEnabled, publicConfig, config } from "@/lib/config";
import { proxy } from "@/proxy";
import { requireAdmin } from "@/lib/auth";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as callback } from "@/app/auth/callback/route";
import { GET as list, POST as create } from "@/app/api/tags/route";
import { PATCH as update, DELETE as remove } from "@/app/api/tags/[id]/route";
import { GET as scans } from "@/app/api/tags/[id]/scans/route";
import { adminDb } from "@/lib/supabase/admin";
const createClient = vi.hoisted(() => vi.fn(() => ({ rpc: vi.fn() })));
vi.mock("@supabase/supabase-js", () => ({ createClient }));
import { redirectDb } from "@/lib/supabase/public";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("local-only management boundary", () => {
  it.each([undefined, "redirects", "unknown", "LOCAL-ADMIN"])(
    "defaults to redirect-only for APP_MODE=%s",
    (mode) => {
      vi.stubEnv("APP_MODE", mode);
      expect(managementEnabled()).toBe(false);
      expect(() => config()).toThrow(/disabled/);
    },
  );
  it("cannot enable management on Vercel, even with local credentials and a spoofed localhost host", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("APP_MODE", "local-admin");
    expect(managementEnabled()).toBe(false);
    const res = await proxy(
      new NextRequest("http://localhost:3000/dashboard", { headers: { host: "localhost:3000" } }),
    );
    expect(res.status).toBe(404);
    await expect(requireAdmin()).rejects.toMatchObject({ status: 404 });
    expect(() => adminDb()).toThrow(/disabled/);
  });
  it("returns no-store 404s for all private paths before checking credentials", async () => {
    vi.stubEnv("APP_MODE", "redirects");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SESSION_SECRET", "");
    for (const path of [
      "/",
      "/login",
      "/dashboard",
      "/dashboard/activity",
      "/dashboard/guide",
      "/auth/callback?code=test",
      "/api/auth/login",
      "/api/auth/logout",
      "/api/tags",
      "/api/tags/id/scans",
      "/api/cron/retention",
    ]) {
      const response = await proxy(new NextRequest(`https://nfc.example.com${path}`));
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toContain("no-store");
    }
    expect(createClient).not.toHaveBeenCalled();
  });
  it("blocks direct management handler calls independently of Proxy", async () => {
    vi.stubEnv("APP_MODE", "redirects");
    const request = () => new Request("https://nfc.example.com/api/tags", { method: "POST" });
    const ctx = { params: Promise.resolve({ id: "a".repeat(32) }) };
    const responses = await Promise.all([
      login(request()),
      logout(request()),
      callback(request()),
      create(request()),
      list(request()),
      update(request(), ctx),
      remove(request(), ctx),
      scans(request(), ctx),
    ]);
    expect(responses.every((res) => res.status === 404)).toBe(true);
    expect(createClient).not.toHaveBeenCalled();
  });
  it("allows only loopback admin origins and matching Host headers", async () => {
    vi.stubEnv("ADMIN_APP_URL", "https://public.example.com");
    expect(() => config()).toThrow(/loopback/);
    vi.stubEnv("ADMIN_APP_URL", "http://localhost:3000");
    expect(
      (
        await proxy(
          new NextRequest("http://localhost:3000/dashboard", {
            headers: { host: "evil.example.com" },
          }),
        )
      ).status,
    ).toBe(404);
  });
  it("uses the public key without requiring local management secrets", () => {
    vi.stubEnv("APP_MODE", "redirects");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("ADMIN_EMAILS", "");
    vi.stubEnv("ADMIN_APP_URL", "");
    expect(publicConfig().appUrl).toBe("https://nfc.example.com");
    redirectDb();
    expect(createClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-publishable",
      expect.any(Object),
    );
  });
  it("rejects privileged credentials accidentally placed in the public key setting", () => {
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_secret_never-deploy");
    expect(() => publicConfig()).toThrow(/publishable/);
    const jwt = `header.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.sig`;
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", jwt);
    expect(() => publicConfig()).toThrow(/anon/);
  });
  it("keeps the public sticker origin separate from the local callback and CSRF origin", () => {
    expect(config()).toMatchObject({
      appUrl: "https://nfc.example.com",
      adminUrl: "http://localhost:3000",
    });
  });
});
