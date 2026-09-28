import { readFile } from "node:fs/promises";
import { createSampleResumeFromDashboard, openDownloadDialog, openSidebarSection } from "../fixtures/resume";
import { expect, test } from "../fixtures/test";

test("exports and imports a resume JSON backup", async ({ authPage: page }, testInfo) => {
	await createSampleResumeFromDashboard(page, testInfo);

	const sheet = await openDownloadDialog(page);
	await sheet.getByRole("radio", { name: /^JSON/ }).click();
	const downloadPromise = page.waitForEvent("download");
	await sheet.getByRole("button", { name: "Download JSON" }).click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toMatch(/\.json$/);

	const downloadPath = testInfo.outputPath(download.suggestedFilename());
	await download.saveAs(downloadPath);
	const exportedData = JSON.parse(await readFile(downloadPath, "utf-8")) as { basics: { name: string } };

	// New → Import a resume: picking the file detects the format and imports it in three steps.
	await page.goto("/dashboard");
	await page.getByRole("button", { name: "New", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "New document" });
	await dialog.getByLabel("Choose a file to import").setInputFiles(downloadPath);
	await page.getByRole("button", { name: "Open in editor" }).click();

	await page.waitForURL(/\/builder\/.+/);
	await openSidebarSection(page, "Basics");
	await expect(page.getByRole("textbox", { name: "Full name", exact: true })).toHaveValue(exportedData.basics.name);
});
