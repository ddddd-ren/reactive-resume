import { createSampleResumeFromDashboard } from "../fixtures/resume";
import { expect, test } from "../fixtures/test";

test("clicking a line on the page opens its entry, and focusing a field outlines its block", async ({
	authPage: page,
}, testInfo) => {
	await createSampleResumeFromDashboard(page, testInfo);
	await page.getByRole("tab", { name: "Write", exact: true }).click();

	// The overlay's blocks are a pointer shortcut over the rendered page (hidden from assistive tech).
	const education = page.locator('[data-slot="page-overlay"] [data-kind="item"][data-section-id="education"]').first();
	await education.click();

	// The entry opens in the panel, the Basics card steps aside, and the block carries the "Editing" outline.
	await expect(page.locator("#sidebar-education [data-entry-id] fieldset").first()).toBeVisible();
	await expect(page.getByRole("textbox", { name: "Full name", exact: true })).toHaveCount(0);
	await expect(education).toHaveClass(/outline-accent/);

	// Focusing a Basics field selects the header block instead.
	await page.locator("#sidebar-basics > button").click();
	await page.getByRole("textbox", { name: "Headline", exact: true }).focus();
	await expect(page.locator('[data-slot="page-overlay"] [data-kind="header"]')).toHaveClass(/outline-accent/);
});
