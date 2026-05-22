/**
 * Capture Verdict README screenshots from the live Render demo.
 * Usage: node scripts/capture-screenshots.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "docs", "screenshots");
const WEB = process.env.VERDICT_WEB_URL ?? "https://verdict-web.onrender.com";
const API = process.env.VERDICT_API_URL ?? "https://verdict-api-x75u.onrender.com";

mkdirSync(OUT, { recursive: true });

async function wakeApi() {
  for (let i = 0; i < 8; i++) {
    try {
      const r = await fetch(`${API}/health`);
      if (r.ok) {
        console.log("API awake");
        return;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  console.warn("API wake timed out — continuing anyway");
}

async function login(page, email, password) {
  await page.goto(`${WEB}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector('input[type="email"]', { timeout: 60000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !location.pathname.includes("/login"), { timeout: 90000 });
  await page.waitForTimeout(800);
  for (let i = 0; i < 6; i++) {
    const skip = page.getByRole("button", { name: "Skip" });
    if (await skip.count()) {
      await skip.first().click();
      break;
    }
    const next = page.getByRole("button", { name: "Next" });
    if (await next.count()) {
      await next.first().click();
      await page.waitForTimeout(300);
    } else break;
  }
  await page.waitForTimeout(500);
}

async function shot(page, name) {
  const path = join(OUT, name);
  await page.screenshot({ path, fullPage: false });
  console.log("saved", name);
}

async function main() {
  await wakeApi();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  await page.goto(`${WEB}/login`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(2500);
  await shot(page, "01-login.png");

  await login(page, "platform@verdict.local", "platform123");
  await shot(page, "02-platform-admin.png");
  await page.goto(`${WEB}/organizations`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1500);
  await shot(page, "03-organizations.png");

  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());

  await login(page, "admin@verdict.local", "admin123");
  await shot(page, "04-org-dashboard.png");

  for (const [path, file] of [
    ["/agents", "05-agents.png"],
    ["/analytics", "06-analytics.png"],
    ["/team", "07-team.png"],
    ["/settings", "08-settings.png"],
  ]) {
    await page.goto(`${WEB}${path}`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(1500);
    await shot(page, file);
  }

  await page.goto(`${WEB}/`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1000);
  const prLink = page.locator('a[href*="/prs/"]').first();
  if ((await prLink.count()) > 0) {
    await prLink.click();
    await page.waitForTimeout(2500);
    await shot(page, "09-pr-report.png");
  } else {
    console.log("No PR link found — skipping 09-pr-report.png");
  }

  await browser.close();
  console.log("Done →", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
