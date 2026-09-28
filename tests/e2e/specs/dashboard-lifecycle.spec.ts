import { createSampleResumeFromDashboard, openResumeCardMenu } from "../fixtures/resume";
import { expect, test } from "../fixtures/test";

test("renames, duplicates, moves to Trash, restores and deletes a resume", async ({ authPage: page }, testInfo) => {
	const resumeName = await createSampleResumeFromDashboard(page, testInfo);

	// Rename inline from the card menu: Enter commits.
	const renamedTo = `E2E Renamed ${Date.now().toString(36)}`;
	await openResumeCardMenu(page, resumeName);
	await page.getByRole("menuitem", { name: "Rename" }).click();
	const nameField = page.getByRole("textbox", { name: "Name", exact: true });
	await nameField.fill(renamedTo);
	await nameField.press("Enter");
	await expect(page.getByRole("link", { name: renamedTo, exact: true })).toBeVisible();

	// Duplicate at once: "<name> (copy)".
	await openResumeCardMenu(page, renamedTo, { reload: false });
	await page.getByRole("menuitem", { name: "Duplicate" }).click();
	const copyName = `${renamedTo} (copy)`;
	await expect(page.getByRole("link", { name: copyName, exact: true })).toBeVisible();

	// Move the copy to Trash, undo, then move it again.
	await openResumeCardMenu(page, copyName, { reload: false });
	await page.getByRole("menuitem", { name: "Move to Trash" }).click();
	await expect(page.getByRole("link", { name: copyName, exact: true })).toBeHidden();
	await page.getByRole("button", { name: "Undo", exact: true }).click();
	await expect(page.getByRole("link", { name: copyName, exact: true })).toBeVisible();
	await openResumeCardMenu(page, copyName, { reload: false });
	await page.getByRole("menuitem", { name: "Move to Trash" }).click();
	await expect(page.getByRole("link", { name: copyName, exact: true })).toBeHidden();

	// Trash: restore it, trash it again, then delete it now.
	await page.getByRole("link", { name: /^Trash/ }).click();
	await expect(page.getByRole("heading", { name: "Trash", level: 1 })).toBeVisible();
	await expect(page.getByText("30 days left")).toBeVisible();
	await page.getByRole("button", { name: `Options for ${copyName}` }).click();
	await page.getByRole("menuitem", { name: "Restore" }).click();
	await expect(page.getByText("Trash is empty")).toBeVisible();

	await openResumeCardMenu(page, copyName);
	await page.getByRole("menuitem", { name: "Move to Trash" }).click();
	await page.goto("/dashboard/trash");
	await page.getByRole("button", { name: `Options for ${copyName}` }).click();
	await page.getByRole("menuitem", { name: "Delete now…" }).click();
	await page.getByRole("alertdialog").getByRole("button", { name: "Delete now" }).click();
	await expect(page.getByText("Trash is empty")).toBeVisible();

	await page.goto("/dashboard");
	await expect(page.getByRole("link", { name: renamedTo, exact: true })).toBeVisible();
	await expect(page.getByRole("link", { name: copyName, exact: true })).toBeHidden();
});
