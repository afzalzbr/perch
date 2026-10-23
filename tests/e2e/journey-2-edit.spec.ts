import { test, expect } from "@playwright/test";
import { addLink, seedAndSignIn } from "./helpers";

test.describe("Journey 2 — edit a published link, preview shows draft, public page unchanged until re-publish", () => {
  test("public URL remains and only re-publish applies the change", async ({ page, request }) => {
    await seedAndSignIn(request, page);
    await page.goto("/dashboard/profile");
    await addLink(page, { label: "Shop", href: "https://shop.example.com" });
    await page.getByRole("button", { name: /publish your page/i }).click();
    await page.waitForLoadState("networkidle");

    await page.goto("/alex");
    const publicHref = await page.locator(".public-page__links a.perch-link-card").getAttribute("href");
    expect(publicHref).toMatch(/\/go\//);

    await page.goto("/dashboard/profile");
    const row = page.locator("li.app-draft-row").filter({ hasText: "Shop" });
    await row.getByRole("button", { name: "Edit" }).click();
    await row.getByLabel("Label").fill("Updated shop");
    await row.getByRole("button", { name: /save link/i }).click();
    await page.waitForLoadState("networkidle");

    await expect(page.locator(".perch-phone .perch-link-card__label").first()).toHaveText("Updated shop");
    await expect(page.getByText("Draft ahead").first()).toBeVisible();

    await page.goto("/alex");
    await expect(page.getByText("Shop")).toBeVisible();
    await expect(page.locator(".public-page__links").getByText("Updated shop")).toHaveCount(0);

    await page.goto("/dashboard/profile");
    await page.getByRole("button", { name: /publish version 2/i }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/^Published$/).first()).toBeVisible();

    await page.goto("/alex");
    await expect(page.locator(".public-page__links").getByText("Updated shop")).toBeVisible();
  });
});
