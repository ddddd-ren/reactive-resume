import { createSampleResumeFromDashboard } from "../fixtures/resume";
import { expect, test } from "../fixtures/test";

test("switches between grid and list, remembers the choice, and honours the URL", async ({
	authPage: page,
}, testInfo) => {
	test.setTimeout(60_000);
	await page.setViewportSize({ width: 1440, height: 1000 });
	const name = await createSampleResumeFromDashboard(page, testInfo);
	await page.goto("/dashboard");
	const card = page.getByRole("link", { name, exact: true });
	await expect(card).toBeVisible();
	// The card shows the resume's real first page once it renders.
	await expect(card.locator('[style*="background-image: url("]')).toBeVisible({ timeout: 30_000 });

	const list = page.getByRole("radio", { name: "List" });
	const grid = page.getByRole("radio", { name: "Grid" });
	await list.click();
	await expect(list).toHaveAttribute("aria-checked", "true");
	await expect(page.getByRole("columnheader", { name: "Application" })).toBeVisible();

	// The last view picked is remembered on this device.
	await card.click();
	await page.waitForURL(/\/builder\/.+/);
	await page.goto("/dashboard");
	await expect(list).toHaveAttribute("aria-checked", "true");

	// The URL wins, and an unknown view falls back.
	await page.goto("/dashboard?view=grid");
	await expect(grid).toHaveAttribute("aria-checked", "true");
	await page.goto("/dashboard?view=invalid");
	await expect(list).toHaveAttribute("aria-checked", "true");

	await page.setViewportSize({ width: 390, height: 844 });
	await grid.click();
	await expect(card).toBeVisible();
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
	await page.screenshot({ path: testInfo.outputPath("documents-mobile.png"), animations: "disabled" });
});
