import { test, expect } from "@playwright/test";
import { addLink, seedAndSignIn } from "./helpers";

test.describe("Journey 1 — add three links, reorder, publish", () => {
  test("full happy path", async ({ page, request }) => {
    await seedAndSignIn(request, page);
    await page.goto("/dashboard/profile");

    await expect(page.getByRole("heading", { name: /^Your page$/ })).toBeVisible();
    await expect(page.getByText("Not published yet").first()).toBeVisible();

    // Add three links.
    await addLink(page, { label: "Shop", href: "https://shop.example.com", description: "October print drop" });
    await addLink(page, { label: "Newsletter", href: "https://news.example.com" });
    await addLink(page, { label: "Portfolio", href: "https://alex.me" });

    // Reorder: move Portfolio up twice so it becomes first.
    const row = page.locator("li.app-draft-row").filter({ hasText: "Portfolio" });
    await row.getByRole("button", { name: /^move up$/i }).click();
    await page.waitForLoadState("networkidle");
    await row.getByRole("button", { name: /^move up$/i }).click();
    await page.waitForLoadState("networkidle");

    const labels = page.locator(".app-draft-row__title-text strong");
    await expect(labels.nth(0)).toHaveText("Portfolio");
    await expect(labels.nth(1)).toHaveText("Shop");
    await expect(labels.nth(2)).toHaveText("Newsletter");

    // The phone preview mirrors the ordering.
    const phoneLabels = page.locator(".perch-phone .perch-link-card__label");
    await expect(phoneLabels.nth(0)).toHaveText("Portfolio");

    // Publish.
    await page.getByRole("button", { name: /publish your page/i }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/^Published$/).first()).toBeVisible();

    // Visit the public page.
    await page.goto("/alex");
    await expect(page.getByRole("heading", { name: "Alex Perch" })).toBeVisible();
    const publicLabels = page.locator(".public-page__links .perch-link-card__label");
    await expect(publicLabels.nth(0)).toHaveText("Portfolio");
    await expect(publicLabels.nth(1)).toHaveText("Shop");
    await expect(publicLabels.nth(2)).toHaveText("Newsletter");
  });

  test("invalid URL is refused inline", async ({ page, request }) => {
    await seedAndSignIn(request, page);
    await page.goto("/dashboard/profile");
    const addForm = page.locator("form", { has: page.getByRole("heading", { name: /add a link/i }) });
    await addForm.getByLabel("Label").fill("Bad");
    await addForm.getByLabel("Destination URL").fill("javascript:alert(1)");
    await addForm.getByRole("button", { name: /^add link$/i }).click();
    await expect(addForm.getByText(/links must start with https/i).first()).toBeVisible();
    await expect(addForm.getByLabel("Destination URL")).toHaveValue("javascript:alert(1)");
  });
});
