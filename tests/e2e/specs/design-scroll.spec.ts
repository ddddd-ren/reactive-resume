import { createSampleResumeFromDashboard } from "../fixtures/resume";
import { expect, test } from "../fixtures/test";

// Scrolling the Design panel over the template cards used to yank it back (scroll anchoring), and Design opened at
// Write's scroll position (one scroller shared by every mode).
test("the Design panel opens at its top and scrolls without jumping back", async ({ authPage: page }, testInfo) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await createSampleResumeFromDashboard(page, testInfo);

	const panel = page.getByRole("tabpanel");
	const box = (await panel.boundingBox()) as NonNullable<Awaited<ReturnType<typeof panel.boundingBox>>>;
	await page.mouse.move(box.x + 150, box.y + 300);
	await page.mouse.wheel(0, 600);

	await page.getByRole("tab", { name: "Design" }).click();
	await expect(page.getByRole("heading", { name: "Template" })).toBeVisible();

	const tops: number[] = [];
	for (let step = 0; step < 20; step++) {
		// Crossing the cards previews templates, as a real pointer would.
		await page.mouse.move(box.x + 100 + (step % 2) * 150, box.y + 300, { steps: 2 });
		await page.mouse.wheel(0, 120);
		await page.waitForTimeout(120);
		tops.push(await panel.evaluate((element) => element.scrollTop));
	}

	expect(tops[0], tops.join(",")).toBeLessThan(300);
	for (let step = 1; step < tops.length; step++)
		expect(tops[step], tops.join(",")).toBeGreaterThanOrEqual((tops[step - 1] ?? 0) - 5);
});
