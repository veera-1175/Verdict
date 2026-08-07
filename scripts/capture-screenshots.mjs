/**
 * Retake README screenshots with tour dismissed (org/dev) or never shown (platform).
 * Run with web+api up: node scripts/capture-screenshots.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "docs", "screenshots");
const BASE = process.env.VERDICT_WEB_URL || "http://localhost:5173";
const API = process.env.VERDICT_API_URL || "http://localhost:3001";

mkdirSync(OUT, { recursive: true });

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  // Role cards or email form — fill credentials
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  if (await emailInput.count()) {
    await emailInput.fill(email);
    await page.locator('input[type="password"]').first().fill(password);
    await page.locator('button[type="submit"]').first().click();
  } else {
    // Click matching demo account card if present
    const card = page.getByText(email, { exact: false }).first();
    if (await card.count()) await card.click();
    else {
      // fallback buttons by role labels on Login
      await page.locator("button, a, [role='button']").filter({ hasText: /sign in|log in|continue/i }).first().click();
    }
  }
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20000 });
  await page.waitForTimeout(800);
}

async function dismissTourIfAny(page) {
  const skip = page.getByRole("button", { name: /^Skip$/i });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await page.waitForTimeout(400);
  }
  // Ensure no tour modal remains
  await page.evaluate(() => {
    const raw = localStorage.getItem("verdict-auth-user");
    if (!raw) return;
    try {
      const u = JSON.parse(raw);
      if (u?.id) {
        localStorage.setItem(`verdict-onboarding-${u.id}`, "true");
        u.onboarding_completed = true;
        localStorage.setItem("verdict-auth-user", JSON.stringify(u));
      }
    } catch {
      /* ignore */
    }
  });
  // Persist to API if possible
  await page.evaluate(async (api) => {
    const raw = localStorage.getItem("verdict-auth-user");
    if (!raw) return;
    const u = JSON.parse(raw);
    await fetch(`${api}/api/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Verdict-User-Id": u.id || "",
        "X-Verdict-Role": u.role || "",
        "X-Verdict-Org-Id": u.org_id || "",
        "X-Verdict-Github-Username": u.github_username || "",
      },
      body: JSON.stringify({ complete_onboarding: true }),
    }).catch(() => {});
  }, API);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  // Skip again if still open
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

async function shot(page, name) {
  const path = join(OUT, name);
  await page.screenshot({ path, fullPage: false });
  console.log("wrote", path);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // 01 Login
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await shot(page, "01-login.png");

  // Platform admin pages (no tour)
  await login(page, "platform@verdict.local", "platform123");
  await dismissTourIfAny(page);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await shot(page, "02-platform-admin.png");
  await page.goto(`${BASE}/organizations`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await shot(page, "03-organizations.png");

  // Org admin pages
  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());
  await login(page, "admin@verdict.local", "admin123");
  await dismissTourIfAny(page);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot(page, "04-org-dashboard.png");
  await page.goto(`${BASE}/agents`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot(page, "05-agents.png");
  await page.goto(`${BASE}/analytics`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot(page, "06-analytics.png");
  await page.goto(`${BASE}/team`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot(page, "07-team.png");
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot(page, "08-settings.png");

  // PR report — open first PR link if any
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const prLink = page.locator('a[href*="/prs/"]').first();
  if (await prLink.count()) {
    await prLink.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    await shot(page, "09-pr-report.png");
  } else {
    console.warn("No PR link found — leaving 09-pr-report.png unchanged");
  }

  await browser.close();
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
