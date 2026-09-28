import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/test";

async function openApplications(page: Page) {
	await page.goto("/dashboard/applications");
	await expect(page.getByRole("heading", { name: "Applications", exact: true })).toBeVisible();
}

test("adds an application from a posting, moves it, notes it and closes it with a reason", async ({
	authPage: page,
}) => {
	const company = `E2E Company ${Date.now().toString(36)}`;
	const role = "Frontend Platform Engineer";
	const note = "Follow up with the hiring manager after the screen.";

	await openApplications(page);
	await page.getByRole("button", { name: "Add application" }).first().click();

	const add = page.getByRole("dialog", { name: "Add an application" });
	await add
		.getByLabel("Job link or posting text")
		.fill("We're hiring a Frontend Platform Engineer to own our design system.");
	await add.getByLabel("Role").fill(role);
	await add.getByLabel("Company").fill(company);
	await add.getByRole("button", { name: "Add", exact: true }).click();

	// The new application opens; its stage is Applied, and the stepper moves it on.
	const detail = page.getByRole("dialog", { name: role });
	await expect(detail.getByText(company)).toBeVisible();
	await detail.getByRole("button", { name: "Move to Screening" }).click();
	// The move is logged in the activity.
	await expect(detail.getByRole("listitem").filter({ hasText: "Moved to Screening" })).toBeVisible();
	await expect(detail.getByRole("button", { name: "Move to Interview" })).toBeVisible();

	await detail.getByRole("textbox", { name: "Add a note" }).fill(note);
	await detail.getByRole("button", { name: "Add", exact: true }).click();
	await expect(detail.getByText(note)).toBeVisible();

	await detail.getByRole("button", { name: "Close application…" }).click();
	const closing = page.getByRole("dialog", { name: "Close this application" });
	await closing.getByRole("radio", { name: "I withdrew" }).click();
	await closing.getByRole("button", { name: "Close application" }).click();
	await expect(detail.getByText("I withdrew").first()).toBeVisible();
	await expect(detail.getByRole("button", { name: "Reopen" })).toBeVisible();

	// Closed applications stay out of the list until asked for.
	await page.keyboard.press("Escape");
	const row = page.getByRole("button", { name: new RegExp(role) }).filter({ hasText: company });
	await expect(row).toHaveCount(0);
	await page.getByRole("button", { name: "Show closed" }).click();
	await expect(row).toBeVisible();
});

test("imports from CSV with a confirmed column match, then closes them in bulk", async ({ authPage: page }) => {
	const company = `E2E Import ${Date.now().toString(36)}`;
	const role = "Imported Product Engineer";
	const csv = [
		"Employer,Job Title,Status,Location",
		`${company},${role},applied,Remote`,
		",No company,saved,Remote",
	].join("\n");

	await openApplications(page);
	await page.getByRole("button", { name: "Import or export CSV" }).click();
	await page.getByRole("menuitem", { name: "Import from CSV…" }).click();

	const sheet = page.getByRole("dialog", { name: "Import from CSV" });
	await sheet.getByLabel("CSV data").fill(csv);
	// Headers are matched automatically, and the match can be changed before importing.
	await expect(sheet.getByRole("combobox", { name: "Column Employer goes to" })).toHaveValue("company");
	await expect(sheet.getByRole("combobox", { name: "Column Job Title goes to" })).toHaveValue("role");
	await expect(sheet.getByText("1 application ready to import")).toBeVisible();
	await expect(sheet.getByText("1 row has no company or role and will be skipped.")).toBeVisible();
	await sheet.getByRole("button", { name: "Import 1 application" }).click();

	const row = page.getByRole("button", { name: new RegExp(role) }).filter({ hasText: company });
	await expect(row).toBeVisible();

	await page.getByRole("tab", { name: "Insights" }).click();
	await expect(page.getByText("How far applications get")).toBeVisible();
	await expect(page.getByText("Where your applications went")).toBeVisible();

	await page.getByRole("tab", { name: "List" }).click();
	await page.getByRole("checkbox", { name: `Select ${role} at ${company}` }).check();
	await expect(page.getByText("1 selected")).toBeVisible();
	await page.getByRole("button", { name: "Close…" }).click();
	await page.getByRole("menuitem", { name: "Not selected" }).click();

	await expect(row).toHaveCount(0);
	await page.getByRole("button", { name: "Show closed" }).click();
	await expect(row).toBeVisible();
});
