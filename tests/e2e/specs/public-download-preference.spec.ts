import {
	createSampleResumeFromDashboard,
	getPublicUrl,
	makeResumePublic,
	openSidebarSection,
} from "../fixtures/resume";
import { expect, test } from "../fixtures/test";

test("persists public download-button visibility", async ({ browser, authPage: page }, testInfo) => {
	await createSampleResumeFromDashboard(page, testInfo);
	await makeResumePublic(page);
	const downloadPreference = page.getByRole("switch", { name: "Visitors can download the PDF" });
	await expect(downloadPreference).toBeChecked();
	await downloadPreference.click();
	await expect(downloadPreference).not.toBeChecked();
	await page.reload();
	await openSidebarSection(page, "Sharing");
	await expect(downloadPreference).not.toBeChecked();
	const publicUrl = await getPublicUrl(page);

	const anonymous = await browser.newPage();
	try {
		await anonymous.goto(publicUrl);
		await expect(anonymous.getByRole("heading", { level: 1 })).toBeVisible();
		await expect(anonymous.getByRole("button", { name: "Download PDF" })).toHaveCount(0);
		await downloadPreference.click();
		await expect(downloadPreference).toBeChecked();
		await anonymous.reload();
		await expect(anonymous.getByRole("button", { name: "Download PDF" })).toHaveCount(2);
	} finally {
		await anonymous.close();
	}
});
