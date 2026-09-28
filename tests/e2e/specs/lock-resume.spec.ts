import { createSampleResumeFromDashboard, openResumeCardMenu } from "../fixtures/resume";
import { expect, test } from "../fixtures/test";

test("locks a resume, blocking renames and Trash until unlocked", async ({ authPage: page }, testInfo) => {
	const resumeName = await createSampleResumeFromDashboard(page, testInfo);

	await openResumeCardMenu(page, resumeName);
	const lockPromise = page.waitForResponse((response) => {
		if (!response.url().includes("/api/rpc")) return false;
		if (!response.ok()) return false;
		return (response.request().postData() ?? "").includes('"isLocked":true');
	});
	// Locking is reversible, so it doesn't ask first.
	await page.getByRole("menuitem", { name: "Lock editing" }).click();
	await lockPromise;

	// Locked: the menu now offers Unlock, and destructive/edit actions are disabled
	await openResumeCardMenu(page, resumeName);
	await expect(page.getByRole("menuitem", { name: "Unlock" })).toBeVisible();
	await expect(page.getByRole("menuitem", { name: "Rename" })).toBeDisabled();
	await expect(page.getByRole("menuitem", { name: "Move to Trash" })).toBeDisabled();

	// Unlock restores the actions — wait for the mutation to land before re-reading the menu
	const unlockPromise = page.waitForResponse((response) => {
		if (!response.url().includes("/api/rpc")) return false;
		if (!response.ok()) return false;
		return (response.request().postData() ?? "").includes('"isLocked":false');
	});
	await page.getByRole("menuitem", { name: "Unlock" }).click();
	await unlockPromise;
	await openResumeCardMenu(page, resumeName);
	await expect(page.getByRole("menuitem", { name: "Lock editing" })).toBeVisible();
	await expect(page.getByRole("menuitem", { name: "Move to Trash" })).toBeEnabled();
});
