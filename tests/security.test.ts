import { describe, expect, it, vi } from "vitest";
import { generateId } from "@/lib/ids";
import { destinationUrl, isAdmin, publicId, tagInput } from "@/lib/validation";
import { signSession, validSession, sessionSeconds } from "@/lib/session";
import { body, checkOrigin, HttpError } from "@/lib/http";
import { publicDestination } from "@/lib/destination";
vi.mock("node:dns/promises", () => ({
  Resolver: class {
    resolve4 = vi.fn(async (host: string) =>
      host === "private.example.com"
        ? ["127.0.0.1"]
        : host === "mixed.example.com"
          ? ["8.8.8.8", "192.168.1.2"]
          : host === "missing.example.com"
            ? []
            : ["8.8.8.8"],
    );
    resolve6 = vi.fn(async () => []);
    cancel = vi.fn();
  },
}));
describe("secure public identifiers", () => {
  it("generates 10,000 distinct 192-bit identifiers with exact URL-safe format", () => {
    const ids = Array.from({ length: 10000 }, generateId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(publicId.safeParse(id).success).toBe(true);
      expect(Buffer.from(id, "base64url")).toHaveLength(24);
    }
  });
  it.each(["", "sequential-1", "a".repeat(31), "a".repeat(33), "../".repeat(11)])(
    "rejects malformed identifier %s",
    (id) => expect(publicId.safeParse(id).success).toBe(false),
  );
});
describe("email authorization", () => {
  it("matches only explicit, case-insensitive full addresses", () => {
    expect(isAdmin("OWNER@example.com")).toBe(true);
    expect(isAdmin("owner+other@example.com")).toBe(false);
    expect(isAdmin("other@example.com")).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
    expect(isAdmin("owner@example.com", "")).toBe(false);
    expect(isAdmin("other@example.com", " owner@example.com, OTHER@example.com ")).toBe(true);
  });
});
describe("HTTPS destination validation", () => {
  it.each([
    "https://example.com/path?a=1#part",
    "https://www.wikipedia.org",
    "https://8.8.8.8/path",
  ])("accepts public URL %s", (url) => expect(destinationUrl(url)).toMatch(/^https:/));
  it.each([
    "http://example.com",
    "javascript:alert(1)",
    "data:text/html,hi",
    "//example.com",
    "https://user:password@example.com",
    "https://localhost",
    "https://sub.localhost",
    "https://127.0.0.1",
    "https://2130706433",
    "https://0x7f000001",
    "https://10.0.0.1",
    "https://192.168.1.1",
    "https://172.16.0.1",
    "https://169.254.169.254",
    "https://100.64.0.1",
    "https://0.0.0.0",
    "https://224.0.0.1",
    "https://[::1]",
    "https://[::ffff:127.0.0.1]",
    "https://foo.internal",
    "https://foo.local",
    "https://example.com:8080",
    "https://example.com\\@evil.com",
    "https://example.com\n",
    "https://example.com/has space",
    "not a url",
  ])("rejects unsafe URL %s", (url) => expect(() => destinationUrl(url)).toThrow());
  it("rejects private DNS records, mixed records, and loops", async () => {
    await expect(publicDestination("https://private.example.com")).rejects.toThrow(/private/);
    await expect(publicDestination("https://mixed.example.com")).rejects.toThrow(/private/);
    await expect(publicDestination("https://missing.example.com")).rejects.toThrow(/found/);
    await expect(
      publicDestination("https://nfc.example.com/nfc/" + "a".repeat(32)),
    ).rejects.toThrow(/outside/);
    await expect(publicDestination("https://public.example.com/path")).resolves.toBe(
      "https://public.example.com/path",
    );
  });
  it("rejects injected identity fields and oversized notes", () => {
    const good = { name: " Test ", destination_url: "https://example.com", active: true };
    expect(tagInput.parse(good).name).toBe("Test");
    expect(tagInput.safeParse({ ...good, id: "a".repeat(32) }).success).toBe(false);
    expect(tagInput.safeParse({ ...good, description: "a".repeat(1001) }).success).toBe(false);
  });
});
describe("absolute session expiration", () => {
  it("binds the session to its owner and expires after 12 hours", () => {
    const now = 100000;
    const proof = signSession("owner", now);
    expect(validSession(proof, "owner", now + 1)).toBe(true);
    expect(validSession(proof, "another", now + 1)).toBe(false);
    expect(validSession(proof, "owner", now + sessionSeconds * 1000)).toBe(false);
    expect(validSession(proof + "x", "owner", now)).toBe(false);
    expect(validSession(undefined, "owner")).toBe(false);
  });
});
describe("request boundaries", () => {
  it("requires the fixed configured origin for mutation requests", () => {
    expect(() =>
      checkOrigin(
        new Request("https://nfc.example.com", { headers: { origin: "https://evil.com" } }),
      ),
    ).toThrow(HttpError);
    expect(() => checkOrigin(new Request("https://nfc.example.com"))).toThrow(HttpError);
    expect(() =>
      checkOrigin(
        new Request("https://nfc.example.com", { headers: { origin: "https://nfc.example.com" } }),
      ),
    ).not.toThrow();
  });
  it("rejects invalid JSON, oversized bodies, and non-JSON content", async () => {
    await expect(
      body(
        new Request("https://nfc.example.com", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{",
        }),
      ),
    ).rejects.toThrow(/Invalid JSON/);
    await expect(
      body(
        new Request("https://nfc.example.com", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ data: "x".repeat(9000) }),
        }),
      ),
    ).rejects.toThrow(/large/);
    await expect(
      body(new Request("https://nfc.example.com", { method: "POST", body: "hi" })),
    ).rejects.toThrow(/JSON/);
  });
});
