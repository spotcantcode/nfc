import { test, expect } from "@playwright/test";
test("private dashboard, public redirects, and the complete tag lifecycle", async ({
  page,
  request,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  expect((await request.post("/api/tags", { data: {} })).status()).toBe(401);
  const missing = await request.get("/nfc/" + "Z".repeat(32));
  expect(missing.status()).toBe(404);
  expect(missing.headers()["cache-control"]).toContain("no-store");
  await page.getByLabel("Email address").fill("owner@example.com");
  await page.getByRole("button", { name: "Send sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  // Fixture emulates Supabase's successful code exchange. The app still issues and checks real signed cookies.
  await page.goto("/auth/callback?code=fixture-auth-code");
  await expect(page).toHaveURL(/\/dashboard$/);
  const authCookies = await page.context().cookies();
  expect(
    authCookies
      .filter((c) => c.name.includes("auth-token") || c.name === "nfc-session")
      .every((c) => c.httpOnly && c.sameSite === "Lax"),
  ).toBe(true);
  await expect(page.getByRole("heading", { name: "Your tags, at a glance." })).toBeVisible();
  const name = `Studio ${testInfo.project.name}`;
  await page.getByRole("button", { name: "Create tag", exact: true }).click();
  await page.getByLabel("Tag name", { exact: true }).fill(name);
  await page.getByLabel("Destination URL", { exact: true }).fill("https://example.com/first");
  await page.getByLabel("Notes (optional)").fill("Front desk sticker");
  await page.getByRole("dialog").getByRole("button", { name: "Create tag", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name })).toBeVisible();
  const url = await page.getByRole("textbox", { name: "Public NFC URL" }).inputValue();
  expect(url).toMatch(/\/nfc\/[A-Za-z0-9_-]{32}$/);
  await expect(
    page
      .getByRole("dialog")
      .locator("svg")
      .filter({ has: page.locator("title") }),
  ).toHaveCount(1);
  const first = await request.get(url, { maxRedirects: 0 });
  expect(first.status()).toBe(307);
  expect(first.headers().location).toBe("https://example.com/first");
  expect(first.headers()["cache-control"]).toContain("no-store");
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: `Edit ${name}`, exact: true }).click();
  await page.getByLabel("Destination URL", { exact: true }).fill("https://example.com/second");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const second = await request.get(url, { maxRedirects: 0 });
  expect(second.status()).toBe(307);
  expect(second.headers().location).toBe("https://example.com/second");
  await page.reload();
  await page.getByRole("button", { name: `Show QR code for ${name}` }).click();
  expect(await page.getByRole("textbox", { name: "Public NFC URL" }).inputValue()).toBe(url);
  await page.getByRole("button", { name: "Scan history" }).click();
  await expect(page.getByText("Tag opened").first()).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  if (testInfo.project.name === "iphone")
    await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "Scan activity", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Moments of connection." })).toBeVisible();
  await page.goto("/dashboard");
  await page.getByLabel("Search tags").fill(name);
  await page.getByLabel("Search tags").press("Enter");
  await expect(page).toHaveURL(/q=Studio/);
  await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  await page.screenshot({
    path: `output/playwright/dashboard-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Toggle light and dark mode" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.screenshot({
    path: `output/playwright/dashboard-dark-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Toggle light and dark mode" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole("button", { name: `Edit ${name}`, exact: true }).click();
  await page.getByRole("checkbox", { name: "Enable tag" }).uncheck();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Disable and save" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await request.get(url, { maxRedirects: 0 })).status()).toBe(404);
  await page.getByRole("button", { name: `Delete ${name}`, exact: true }).click();
  await expect(page.getByRole("alertdialog")).toContainText("Its URL stays reserved forever");
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect((await request.get(url, { maxRedirects: 0 })).status()).toBe(404);
  if (testInfo.project.name === "iphone")
    await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});
