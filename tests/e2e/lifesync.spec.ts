import { expect, test } from "@playwright/test";

test("habit logging, water tracking and calendar data persist through browser actions", async ({ page }) => {
  test.setTimeout(120000);
  const email = `wellbeing-${Date.now()}@example.test`;
  const password = "Browser-test-password-long-42";
  const origin = { Origin: "http://localhost:3000" };
  await page.addInitScript(() => localStorage.setItem("lifesync.locale", "en"));
  const signup = await page.request.post("/api/auth/sign-up/email", {
    headers: origin,
    data: { name: "Wellbeing User", email, password, termsAccepted: true },
  });
  expect(signup.ok()).toBe(true);
  const mailbox = (await (await page.request.get("http://127.0.0.1:8787/__test/mailbox")).json()) as {
    to: string;
    text: string;
  }[];
  const link = mailbox.find((mail) => mail.to === email)?.text.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error("Verification email URL missing");
  expect((await page.request.get(link)).ok()).toBe(true);
  expect(
    (await page.request.post("/api/auth/sign-in/email", { headers: origin, data: { email, password } })).ok(),
  ).toBe(true);
  expect(
    (
      await page.request.patch("/api/v1/preferences", {
        headers: origin,
        data: { locale: "en", timezone: "Europe/Kyiv" },
      })
    ).ok(),
  ).toBe(true);
  expect((await page.request.post("/api/v1/onboarding", { headers: origin, data: { completed: true } })).ok()).toBe(
    true,
  );
  await page.goto("/habits");
  await page.getByRole("button", { name: "Create", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: /^Name(?:\s*\*)?$/ }).fill("Daily walk from browser");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Daily walk from browser", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Log today", exact: true }).click();
  await expect(page.getByRole("button", { name: "Completed", exact: true })).toBeDisabled();
  const entries = await (await page.request.get("/api/v1/habits/entries")).json();
  expect(entries.data).toHaveLength(1);
  await page.goto("/health");
  const waterSaved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/health/water") && response.request().method() === "POST" && response.ok(),
  );
  await page.getByRole("button", { name: "+ 250 ml", exact: true }).click();
  await waterSaved;
  const water = await (await page.request.get("/api/v1/health/water")).json();
  expect(water.data).toHaveLength(1);
  expect(water.data[0].amountMl).toBe(250);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const end = new Date(`${date}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  expect(
    (
      await page.request.post("/api/v1/calendar/events", {
        headers: { ...origin, "Idempotency-Key": crypto.randomUUID() },
        data: {
          title: "Verified all-day event",
          allDay: true,
          startDate: date,
          endDate: end.toISOString().slice(0, 10),
          timezone: "Europe/Kyiv",
        },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/calendar");
  await expect(page.getByRole("button", { name: "Verified all-day event", exact: true })).toBeVisible();
});

test("register, verify, login, onboarding, real project/task CRUD and session lifecycle", async ({ page, request }) => {
  test.setTimeout(300000);
  const runtimeErrors: string[] = [];
  const failedApi: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("response", (response) => {
    const path = new URL(response.url()).pathname;
    if (path.startsWith("/api/") && (response.status() === 429 || response.status() >= 500))
      failedApi.push(`${response.status()} ${path}`);
  });
  const email = `browser-${Date.now()}@example.test`;
  const password = "Browser-test-password-long-42";
  await page.addInitScript(() => localStorage.setItem("lifesync.locale", "en"));
  await page.goto("/register");
  await page.getByLabel("Name", { exact: true }).fill("Browser User");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Get started", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Check your inbox");
  const mailbox = (await (await request.get("http://127.0.0.1:8787/__test/mailbox")).json()) as {
    to: string;
    text: string;
  }[];
  const mail = mailbox.find((message) => message.to === email);
  expect(mail).toBeDefined();
  const verification = mail?.text.match(/https?:\/\/\S+/)?.[0];
  if (!verification) throw new Error("Verification email URL missing");
  await page.goto(verification);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/onboarding|dashboard/);
  if (page.url().includes("onboarding")) await page.getByRole("button", { name: "Skip for now", exact: true }).click();
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "A fresh start", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("textbox", { name: /^Name(?:\s*\*)?$/ })
    .fill("A real browser project");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("A real browser project", { exact: true })).toBeVisible();
  await page.goto("/tasks");
  await expect(page.getByRole("heading", { name: "A fresh start", exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("textbox", { name: /^Title(?:\s*\*)?$/ })
    .fill("Finish browser verification");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Finish browser verification", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Complete Finish browser verification", exact: true }).click();
  await page.goto("/settings");
  await expect(page.getByText("Active sessions", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Browser/ })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: ".local/dashboard-preview.png", fullPage: true });
  for (const width of [360, 390, 768, 1024, 1440, 1920, 3840]) {
    expect((await request.post("http://127.0.0.1:8787/__test/reset-layout-rate-window")).status()).toBe(204);
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/dashboard",
      "/tasks",
      "/habits",
      "/calendar",
      "/inbox",
      "/finance",
      "/health",
      "/ai",
      "/integrations",
      "/notifications",
      "/trash",
      "/settings",
    ]) {
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.getByRole("status", { name: "Loading your space…", exact: true })).toHaveCount(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        `${route} overflow at ${width}px`,
      ).toBe(false);
    }
  }
  expect(runtimeErrors).toEqual([]);
  expect(failedApi).toEqual([]);
});

test("public pages and auth layout fit all required widths without overflow", async ({ page }) => {
  test.setTimeout(180000);
  for (const width of [360, 390, 768, 1024, 1440, 1920, 3840]) {
    await page.setViewportSize({ width, height: width < 768 ? 800 : 1080 });
    for (const route of ["/", "/pricing", "/login", "/register", "/privacy", "/security"]) {
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      expect(overflow, `${route} overflow at ${width}px`).toBe(false);
    }
  }
});
