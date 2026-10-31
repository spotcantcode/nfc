import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { localAddress, prepareEnvironment, isNfcRunning } from "../scripts/start-local.mjs";

const directories: string[] = [];
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "NFC launcher with spaces "));
  directories.push(root);
  await writeFile(
    join(root, ".env.example"),
    "ADMIN_APP_URL=http://localhost:3187\nNEXT_PUBLIC_APP_URL=https://nfc.example.com\nSUPABASE_URL=https://test.supabase.co\nSUPABASE_PUBLISHABLE_KEY=\nSUPABASE_SECRET_KEY=\nADMIN_EMAILS=owner@example.com\n",
  );
  return root;
}
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("double-click local launcher", () => {
  it("prepares private first-run settings and one stable random session secret", async () => {
    const root = await fixture();
    const first = await prepareEnvironment(root);
    expect(first.address).toEqual({ origin: "http://localhost:3187", port: 3187 });
    expect(first.missing).toEqual(["SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"]);
    expect(first.values.SESSION_SECRET).toMatch(/^[a-f0-9]{64}$/);
    expect((await stat(first.path)).mode & 0o777).toBe(0o600);
    const second = await prepareEnvironment(root);
    expect(second.values.SESSION_SECRET).toBe(first.values.SESSION_SECRET);
    expect((await readFile(first.path, "utf8")).match(/SESSION_SECRET=/g)).toHaveLength(1);
  });
  it("preserves existing credentials, quoted values, comments, and a valid session secret", async () => {
    const root = await fixture();
    const source =
      '# My settings\nADMIN_APP_URL=http://127.0.0.1:4555\nSUPABASE_SECRET_KEY="literal $() # not shell code"\nSESSION_SECRET=' +
      "x".repeat(64) +
      "\n";
    await writeFile(join(root, ".env.local"), source);
    const result = await prepareEnvironment(root);
    expect(await readFile(result.path, "utf8")).toBe(source);
    expect(result.values.SUPABASE_SECRET_KEY).toBe("literal $() # not shell code");
    expect(result.address.port).toBe(4555);
  });
  it("fills an empty session secret without overwriting any user settings", async () => {
    const root = await fixture();
    await writeFile(
      join(root, ".env.local"),
      '# Keep this comment\nSUPABASE_SECRET_KEY="test-only"\nSESSION_SECRET=\n',
    );
    const result = await prepareEnvironment(root);
    const saved = await readFile(result.path, "utf8");
    expect(saved).toContain("# Keep this comment");
    expect(parseEnv(saved).SUPABASE_SECRET_KEY).toBe("test-only");
    expect(parseEnv(saved).SESSION_SECRET).toMatch(/^[a-f0-9]{64}$/);
  });
  it.each([
    "http://0.0.0.0:3187",
    "http://192.168.1.2:3187",
    "https://example.com",
    "http://localhost:80",
    "http://user@localhost:3187",
    "http://localhost:3187/path",
    "http://localhost:3187/?mode=public",
  ])("rejects an unsafe launcher address: %s", (value) => {
    expect(() => localAddress(value)).toThrow();
  });
  it("distinguishes an existing NFC server from another app on the same port", async () => {
    let nfc = false;
    const server = createServer((_req, res) => {
      if (nfc) res.setHeader("X-NFC-Local-App", "tapspace");
      res.end("Login");
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("No test port");
      const origin = `http://127.0.0.1:${address.port}`;
      expect(await isNfcRunning(origin)).toBe(false);
      nfc = true;
      expect(await isNfcRunning(origin)).toBe(true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
