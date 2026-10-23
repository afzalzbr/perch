import { test, expect } from "@playwright/test";
import { addLink, seedAndSignIn } from "./helpers";

test.describe("Mobile — publish journey at phone width", () => {
  test("publishes a page on a phone-sized viewport", async ({ page, request }) => {
    await seedAndSignIn(request, page);
    await page.goto("/dashboard/profile");
    await addLink(page, { label: "Shop", href: "https://shop.example.com" });
    await addLink(page, { label: "Newsletter", href: "https://news.example.com" });
    await page.getByRole("button", { name: /publish your page/i }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/^Published$/).first()).toBeVisible();

    await page.goto("/alex");
    await expect(page.getByRole("heading", { name: "Alex Perch" })).toBeVisible();
    const links = page.locator(".public-page__links .perch-link-card");
    await expect(links).toHaveCount(2);
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientW = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollW).toBeLessThanOrEqual(clientW + 1);
  });
});
