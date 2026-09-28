import { expect, test } from "../fixtures/test";

test("three settings pages that save as you go; keys shown once and revoked with undo", async ({ authPage: page }) => {
	test.setTimeout(60_000);

	// Old addresses land on the new pages.
	await page.goto("/dashboard/settings/profile");
	await page.waitForURL(/\/dashboard\/settings\/account$/);
	await page.goto("/dashboard/settings/api-keys");
	await page.waitForURL(/\/dashboard\/settings\/ai$/);
	await page.goto("/dashboard/settings");
	await page.waitForURL(/\/dashboard\/settings\/account$/);

	// Name saves on blur.
	const name = page.getByLabel("Name", { exact: true });
	await name.fill("Dana Reyes");
	await name.blur();
	await expect
		.poll(async () => (await page.request.get("/api/auth/get-session")).json())
		.toMatchObject({
			user: { name: "Dana Reyes" },
		});

	// Export everything downloads one zip.
	const download = page.waitForEvent("download");
	await page.getByRole("button", { name: "Export", exact: true }).click();
	expect((await download).suggestedFilename()).toMatch(/^reactive-resume-\d{4}-\d{2}-\d{2}\.zip$/);

	// Appearance applies at once.
	await page.getByRole("link", { name: "Preferences" }).click();
	// The tiles are labels around visually hidden radios.
	await page.locator("label", { hasText: "Dark" }).click();
	await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked();
	await expect(page.locator("html")).toHaveClass(/dark/);
	await page.locator("label", { hasText: "Light" }).click();

	// A new key is shown once; revoking it offers Undo.
	await page.getByRole("link", { name: "AI & developer" }).click();
	await page.getByRole("button", { name: "New key" }).click();
	const dialog = page.getByRole("dialog", { name: "New API key" });
	await dialog.getByLabel("What's it for?").fill("E2E script");
	await dialog.locator("label", { hasText: "Never" }).click();
	await expect(dialog.getByRole("radio", { name: "Never" })).toBeChecked();
	await dialog.getByRole("button", { name: "Create key" }).click();
	await expect(dialog.getByText("Copy it now. For your security, it won't be shown again.")).toBeVisible();
	await dialog.getByRole("button", { name: "Done" }).click();

	const row = page.getByRole("row", { name: /E2E script/ });
	await expect(row).toBeVisible();
	await row.getByRole("button", { name: "Revoke E2E script" }).click();
	await expect(row).toBeHidden();
	await page.getByRole("button", { name: "Undo" }).click();
	await expect(page.getByRole("row", { name: /E2E script/ })).toBeVisible();
});
