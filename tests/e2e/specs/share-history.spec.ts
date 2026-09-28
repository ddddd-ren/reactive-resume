import { createSampleResumeFromDashboard, getPublicUrl, makeResumePublic } from "../fixtures/resume";
import { expect, test } from "../fixtures/test";

test("renames the public address and keeps the old one redirecting", async ({ browser, authPage: page }, testInfo) => {
	await createSampleResumeFromDashboard(page, testInfo);
	const oldUrl = await makeResumePublic(page);
	const sheet = page.getByRole("dialog", { name: "Share & export" });
	const address = sheet.getByRole("textbox", { name: "Address" });

	await address.fill("not_valid!");
	await expect(sheet.getByText("Use lowercase letters, numbers and single dashes.")).toBeVisible();

	await address.fill("renamed-address");
	await expect(sheet.getByText(/^Live at .*\/renamed-address$/)).toBeVisible();
	expect(await getPublicUrl(page)).toMatch(/\/renamed-address$/);

	const visitor = await browser.newPage();
	try {
		await visitor.goto(oldUrl);
		await visitor.waitForURL(/\/renamed-address$/);
		await expect(visitor.getByRole("heading", { level: 1 })).toBeVisible();
	} finally {
		await visitor.close();
	}
});

test("names a version, previews an older one read-only and restores it", async ({ authPage: page }, testInfo) => {
	await createSampleResumeFromDashboard(page, testInfo);
	await page.getByRole("button", { name: "History", exact: true }).click();
	const sheet = page.getByRole("dialog", { name: "Share & export" });
	const versions = sheet.getByRole("list", { name: "Versions" });
	// A new document's history starts with where it came from.
	await expect(versions.getByRole("button", { name: /^Created/ })).toBeVisible();

	await sheet.getByRole("textbox", { name: "Name this version" }).fill("Sent to Lumen");
	await sheet.getByRole("button", { name: "Save", exact: true }).click();
	await expect(versions.getByRole("button", { name: /^Sent to Lumen/ })).toBeVisible();

	await versions.getByRole("button", { name: /^Created/ }).click();
	// The sheet announces it; the page (outside the modal sheet) shows the same banner above the version.
	await expect(sheet.getByRole("status").filter({ hasText: /Viewing .* · Created · read-only/ })).toBeVisible();
	await expect(page.getByText(/^Viewing .* · Created · read-only$/).first()).toBeVisible();

	await sheet.getByRole("button", { name: "Restore this version" }).click();
	await expect(versions.getByRole("button", { name: /^Before restore/ })).toBeVisible();
	await expect(versions.getByRole("button", { name: /^Now/ })).toHaveAttribute("aria-pressed", "true");
});
