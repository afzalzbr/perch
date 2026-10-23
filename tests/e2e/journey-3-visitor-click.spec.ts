import { test, expect } from "@playwright/test";
import { addLink, seedAndSignIn } from "./helpers";

test.describe("Journey 3 — visitor click lands in analytics", () => {
  test("one click reaches the owner's totals", async ({ page, request, browser }) => {
    await seedAndSignIn(request, page);
    await page.goto("/dashboard/profile");
    await addLink(page, { label: "Shop", href: "https://shop.example.com" });
    await page.getByRole("button", { name: /publish your page/i }).click();
    await page.waitForLoadState("networkidle");

    // Visitor hits the public page from a FRESH browser context (no owner cookie).
    const visitor = await browser.newContext();
    const vpage = await visitor.newPage();
    await vpage.goto("http://localhost:3100/alex");
    const linkHref = await vpage.locator(".public-page__links a.perch-link-card").first().getAttribute("href");
    expect(linkHref).toMatch(/^\/go\//);

    // Follow the redirect manually.
    const resp = await visitor.request.get(linkHref!, { maxRedirects: 0, failOnStatusCode: false });
    expect(resp.status()).toBe(302);
    expect(resp.headers()["location"]).toBe("https://shop.example.com/");
    await visitor.close();

    // Owner opens analytics and sees the click.
    await page.goto("/dashboard/analytics");
    const metric = page
      .locator(".app-metric-card")
      .filter({ hasText: /7-day clicks/i })
      .locator(".app-metric")
      .first();
    await expect(metric).toHaveText(/^1$/);

    const ranking = page.locator(".app-ranking .app-ranking__count").first();
    await expect(ranking).toHaveText(/^1$/);
  });
});
