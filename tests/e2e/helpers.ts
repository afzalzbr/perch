import type { Page } from "@playwright/test";

export const CRED = { email: "owner@example.com", password: "superSecret1" };

/**
 * Resets the DB and signs the test session in as the owner.
 * Uses the test-only POST /api/test/seed route (enabled by PERCH_TEST_MODE=1).
 *
 * Important: this uses page.request so the Set-Cookie from the seed call
 * lands in the same cookie jar the page then navigates with.
 */
export async function seedAndSignIn(
  _unusedRequest: unknown,
  page: Page,
  { withProfile = true }: { withProfile?: boolean } = {}
): Promise<{ profileId: string | null }> {
  const resp = await page.request.post("/api/test/seed", {
    data: { email: CRED.email, password: CRED.password, withProfile },
  });
  if (!resp.ok()) throw new Error(`seed failed: ${resp.status()} ${await resp.text()}`);
  return (await resp.json()) as { profileId: string | null };
}

export async function addLink(
  page: Page,
  { label, href, description }: { label: string; href: string; description?: string }
): Promise<void> {
  // The "Add a link" sub-form.
  const addForm = page.locator("form", { has: page.getByRole("heading", { name: /add a link/i }) });
  await addForm.getByLabel("Label").fill(label);
  await addForm.getByLabel("Destination URL").fill(href);
  if (description) await addForm.getByLabel("Description").fill(description);
  await addForm.getByRole("button", { name: /^add link$/i }).click();
  await page.waitForLoadState("networkidle");
}
