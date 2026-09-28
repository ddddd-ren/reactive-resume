import type { Page } from "@playwright/test";
import { Pool } from "pg";
import { expect, test } from "../fixtures/test";

// The page is centered in the canvas beside the panel, not in the viewport. The canvas's scrollbar sits on the
// left in right-to-left layouts, so the center comes from its content box.
async function expectCenteredPreview(page: Page) {
	const canvas = page.locator('[aria-hidden="false"] canvas').first();
	await expect(canvas).toBeVisible();
	await expect
		.poll(() =>
			canvas.evaluate((element) => {
				let scroller = element.parentElement;
				while (scroller && getComputedStyle(scroller).overflowY !== "auto") scroller = scroller.parentElement;
				if (!scroller) return Number.POSITIVE_INFINITY;
				const bounds = element.getBoundingClientRect();
				const center = scroller.getBoundingClientRect().left + scroller.clientLeft + scroller.clientWidth / 2;
				return Math.abs(bounds.left + bounds.width / 2 - center);
			}),
		)
		.toBeLessThan(1);
}

for (const uiLanguage of ["English", "Arabic"]) {
	for (const resumeLocale of ["en-US", "ar-SA"]) {
		test(`centers preview with ${uiLanguage} UI and ${resumeLocale} resume`, async ({ authPage: page }, info) => {
			test.setTimeout(60_000);
			await page.setViewportSize({ width: 1920, height: 950 });
			await page.goto("/dashboard/resumes");
			await page.getByText("Create a new resume", { exact: true }).click();
			const dialog = page.getByRole("dialog", { name: "Create a new resume" });
			await dialog.getByLabel("Name", { exact: true }).fill("Preview direction fixture");
			await dialog.getByRole("button", { name: "Create", exact: true }).click();
			await page.waitForURL(/\/builder\/.+/);
			const builderUrl = page.url();
			const resumeId = builderUrl.split("/").at(-1);
			await page.goto("/dashboard/resumes");
			const pool = new Pool({ connectionString: process.env.DATABASE_URL });
			try {
				await pool.query(
					`update resume set data = jsonb_set(jsonb_set(data, '{metadata,page,locale}', $2::jsonb), '{basics,name}', '"Preview direction fixture"'::jsonb) where id = $1`,
					[resumeId, JSON.stringify(resumeLocale)],
				);
			} finally {
				await pool.end();
			}
			// The editor has no account menu; the UI language comes from the same cookie the language picker sets.
			if (uiLanguage === "Arabic") {
				await page.context().addCookies([{ name: "locale", value: "ar-SA", url: new URL(builderUrl).origin }]);
			}
			await page.goto(builderUrl);
			await expect(page.locator("html")).toHaveAttribute("dir", uiLanguage === "Arabic" ? "rtl" : "ltr");
			await expectCenteredPreview(page);
			// The zoom bar's middle button shows "Fit" or the zoom level; its name isn't translated yet.
			const zoom = page.getByRole("button", { name: "Fit page to width", exact: true });
			await expect(zoom).toHaveCSS("direction", uiLanguage === "Arabic" ? "rtl" : "ltr");
			await expect(zoom).not.toHaveText(/%/);
			await page.getByRole("button", { name: uiLanguage === "Arabic" ? "تصغير" : "Zoom out", exact: true }).click();
			await expect(zoom).toHaveText(/^\d+%$/);
			await expectCenteredPreview(page);
			await zoom.click();
			await expect(zoom).not.toHaveText(/%/);
			await expectCenteredPreview(page);
			const direction = await page
				.locator('[aria-hidden="false"] canvas')
				.first()
				.evaluate((canvas) => canvas.closest("[dir]")?.getAttribute("dir"));
			expect(direction).toBe(resumeLocale === "ar-SA" ? "rtl" : "ltr");
			await page.screenshot({ path: info.outputPath("centered-preview.png") });
		});
	}
}
