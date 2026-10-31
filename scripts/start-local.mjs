/* global AbortSignal, console, fetch */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { access, chmod, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { URL, fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv } from "node:util";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export function localAddress(value = "http://localhost:3187") {
  const url = new URL(value);
  const port = Number(url.port || 80);
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    port < 1024 ||
    port > 65535
  ) {
    throw new Error(
      "ADMIN_APP_URL must be http://localhost:PORT or http://127.0.0.1:PORT, with a port above 1023.",
    );
  }
  return { origin: url.origin, port };
}

export async function prepareEnvironment(root) {
  const path = join(root, ".env.local");
  let source;
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    source = await readFile(join(root, ".env.example"), "utf8");
    await writeFile(path, source, { mode: 0o600, flag: "wx" });
    console.log("Created .env.local for this computer.");
  }
  const values = parseEnv(source);
  if (!values.SESSION_SECRET) {
    // A later assignment overrides an existing empty assignment, preserving all
    // user comments/values and never evaluating .env as shell code.
    values.SESSION_SECRET = randomBytes(32).toString("hex");
    await writeFile(path, `${source.trimEnd()}\nSESSION_SECRET=${values.SESSION_SECRET}\n`, {
      mode: 0o600,
    });
  }
  await chmod(path, 0o600);
  if (values.SESSION_SECRET.length < 32)
    throw new Error(
      "SESSION_SECRET in .env.local must contain at least 32 characters. Remove an old blank/short value to let the launcher generate one.",
    );
  const address = localAddress(values.ADMIN_APP_URL);
  const missing = [
    "NEXT_PUBLIC_APP_URL",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "ADMIN_EMAILS",
  ].filter((name) => !values[name]?.trim());
  return { path, values, address, missing };
}

export async function isNfcRunning(origin) {
  try {
    const response = await fetch(`${origin}/login`, {
      redirect: "manual",
      signal: AbortSignal.timeout(1500),
    });
    // Do not mistake a different local app's login page for this dashboard.
    await response.body?.cancel();
    return response.ok && response.headers.get("x-nfc-local-app") === "tapspace";
  } catch {
    return false;
  }
}

async function availablePort(port) {
  await new Promise((ok, fail) => {
    const probe = createServer();
    probe.once("error", () =>
      fail(
        new Error(
          `Port ${port} is used by another app. Change ADMIN_APP_URL in .env.local to a free port, then update your Supabase callback URL to match.`,
        ),
      ),
    );
    probe.listen(port, "127.0.0.1", () => probe.close(ok));
  });
}

async function openOnMac(target, edit = false) {
  if (process.platform !== "darwin" || process.argv.includes("--no-open")) return;
  await new Promise((ok, fail) => {
    const child = spawn("/usr/bin/open", edit ? ["-e", target] : [target], { stdio: "ignore" });
    child.once("error", fail);
    child.once("exit", (code) =>
      code === 0
        ? ok()
        : fail(
            new Error(
              "macOS could not open the browser/editor. Open the address or file shown in this window manually.",
            ),
          ),
    );
  });
}

export async function launch(root = projectRoot) {
  if (Number(process.versions.node.split(".")[0]) < 22)
    throw new Error("Install Node.js 22 or newer, then double-click Start NFC.command again.");
  if (process.env.VERCEL) throw new Error("This launcher is only for your local computer.");
  const env = await prepareEnvironment(root);
  if (env.missing.length) {
    console.log(
      `One-time setup: fill in ${env.missing.join(", ")} in .env.local, save, then double-click Start NFC.command again.`,
    );
    console.log(`Settings file: ${env.path}`);
    await openOnMac(env.path, true);
    return;
  }
  if (await isNfcRunning(env.address.origin)) {
    console.log(`NFC is already running at ${env.address.origin}`);
    await openOnMac(env.address.origin);
    return;
  }
  await availablePort(env.address.port);
  try {
    await access(join(root, "node_modules", "next", "dist", "bin", "next"));
  } catch {
    console.log("Installing the app's dependencies. This is only needed the first time.");
    await new Promise((ok, fail) => {
      const install = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["ci"], {
        cwd: root,
        stdio: "inherit",
      });
      install.once("error", fail);
      install.once("exit", (code) =>
        code === 0
          ? ok()
          : fail(
              new Error(
                "Dependency installation failed. Check your internet connection and try again.",
              ),
            ),
      );
    });
  }

  console.log(`Starting NFC at ${env.address.origin}`);
  console.log("Keep this Terminal window open. Press Control+C to stop NFC.");
  const server = spawn(
    process.execPath,
    [
      join(root, "node_modules", "next", "dist", "bin", "next"),
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(env.address.port),
    ],
    {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        ...env.values,
        ADMIN_APP_URL: env.address.origin,
        APP_MODE: "local-admin",
      },
    },
  );
  let exited = false;
  const completed = new Promise((ok, fail) => {
    server.once("error", (error) => {
      exited = true;
      fail(error);
    });
    server.once("exit", (code, signal) => {
      exited = true;
      if (code === 0 || signal === "SIGINT" || signal === "SIGTERM") ok();
      else fail(new Error("NFC stopped unexpectedly. Check the messages above."));
    });
  });
  // Attach a handler immediately while waiting for readiness, avoiding unhandled rejections.
  completed.catch(() => {});
  const stop = () => server.kill("SIGTERM");
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    const deadline = Date.now() + 60000;
    let ready = false;
    while (!exited && Date.now() < deadline) {
      if (await isNfcRunning(env.address.origin)) {
        ready = true;
        break;
      }
      await delay(400);
    }
    if (!ready && !exited) {
      stop();
      throw new Error("NFC took too long to start. Check the messages above and try again.");
    }
    if (ready) {
      console.log(`Ready: ${env.address.origin}`);
      await openOnMac(env.address.origin);
    }
    await completed;
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    if (!exited) stop();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  launch().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
