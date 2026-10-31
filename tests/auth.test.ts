import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getSession: vi.fn(),
  cookie: vi.fn(),
  rpc: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.cookie }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({
  authClient: async () => ({ auth: { getUser: mocks.getUser, getSession: mocks.getSession } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ adminDb: () => ({ rpc: mocks.rpc }) }));
import { requireAdmin, requirePageAdmin } from "@/lib/auth";
import { signSession } from "@/lib/session";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "owner", email: "owner@example.com" } },
    error: null,
  });
  mocks.getSession.mockResolvedValue({
    data: {
      session: {
        access_token: `header.${Buffer.from(JSON.stringify({ session_id: "session-uuid" })).toString("base64url")}.signature`,
      },
    },
  });
  mocks.cookie.mockReturnValue({ value: signSession("owner") });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
});
describe("server dashboard authorization", () => {
  it("rejects unauthenticated dashboard rendering", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requirePageAdmin()).rejects.toThrow("REDIRECT:/login");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects valid Supabase users outside the server allowlist", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "stranger", email: "stranger@example.com" } },
      error: null,
    });
    await expect(requireAdmin()).rejects.toMatchObject({ status: 401 });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects missing, forged, and expired HTTP-only session proofs", async () => {
    for (const value of [undefined, "fake", signSession("owner", Date.now() - 13 * 3600000)]) {
      mocks.cookie.mockReturnValue(value ? { value } : undefined);
      await expect(requireAdmin()).rejects.toMatchObject({ status: 401 });
    }
  });
  it("allows an owner only with a live Auth session", async () => {
    expect(await requireAdmin()).toMatchObject({ id: "owner" });
    expect(mocks.rpc).toHaveBeenCalledWith("is_live_session", {
      p_session: "session-uuid",
      p_user: "owner",
    });
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    await expect(requireAdmin()).rejects.toMatchObject({ status: 401 });
  });
  it("fails closed if live session verification is unavailable", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
    await expect(requireAdmin()).rejects.toMatchObject({ status: 503 });
  });
});
