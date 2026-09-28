import { createSampleResumeFromDashboard, makeResumePublic } from "../fixtures/resume";
import { expect, test } from "../fixtures/test";

test("reflows the shared resume on phones and says nothing about links that aren't shared", async ({
	browser,
	authPage: page,
}, testInfo) => {
	test.setTimeout(60_000);
	await createSampleResumeFromDashboard(page, testInfo);
	const publicUrl = await makeResumePublic(page);

	const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
	try {
		await phone.goto(publicUrl);
		// Readable text in print order, contact details as tap targets, Download and Share pinned.
		await expect(phone.getByRole("heading", { level: 2, name: "Experience" }).first()).toBeVisible();
		await expect(phone.getByRole("link", { name: /@/ }).first()).toHaveAttribute("href", /^mailto:/);
		await expect(phone.getByRole("button", { name: "Download PDF" })).toBeInViewport();
		await expect(phone.getByRole("button", { name: "Share" })).toBeInViewport();

		await phone.goto(`${new URL(publicUrl).origin}/nobody-here/nothing-shared`);
		await expect(phone.getByRole("heading", { name: "This resume isn't shared right now." })).toBeVisible();
	} finally {
		await phone.close();
	}
});
