import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createSampleResumeFromDashboard } from "../fixtures/resume";
import { expect, test } from "../fixtures/test";

test("starts a blank resume on the name field and names it after the headline", async ({ authPage: page }) => {
	await page.goto("/dashboard");
	await page.getByRole("button", { name: "New", exact: true }).click();
	await page.getByRole("button", { name: /^Start blank/ }).click();
	await page.waitForURL(/\/builder\/.+/);

	const fullName = page.getByRole("textbox", { name: "Full name", exact: true });
	await expect(fullName).toBeFocused();
	await fullName.fill("Jordan Reyes");
	await page.getByRole("textbox", { name: "Headline", exact: true }).fill("Product Designer");
	// Until someone renames it, the document is called by its headline.
	await expect(page.getByRole("banner").getByText("Product Designer", { exact: true })).toBeVisible();

	await page.goto("/dashboard");
	await expect(page.getByRole("link", { name: "Product Designer", exact: true })).toBeVisible();
});

test("copies a resume for a job and links the copy to the application", async ({
	authPage: page,
	account,
}, testInfo) => {
	const pool = new Pool({ connectionString: process.env.DATABASE_URL });
	try {
		const resumeName = await createSampleResumeFromDashboard(page, testInfo);
		await pool.query(
			'insert into application (id, user_id, company, role) select $1, id, $2, $3 from "user" where email = $4',
			[randomUUID(), "Orbital", "Product Designer", account.email],
		);

		await page.goto("/dashboard");
		await page.getByRole("button", { name: "New", exact: true }).click();
		await page.getByRole("button", { name: /^Copy a resume for a job/ }).click();
		const dialog = page.getByRole("dialog", { name: "Copy a resume for a job" });
		await dialog.getByText(resumeName, { exact: true }).click();
		await dialog.getByRole("button", { name: "Orbital", exact: true }).click();
		await expect(dialog.getByRole("textbox", { name: "Name", exact: true })).toHaveValue(`${resumeName} — Orbital`);
		await dialog.getByRole("button", { name: "Create and open" }).click();
		await page.waitForURL(/\/builder\/.+/);

		await page.goto("/dashboard");
		const copy = page.getByRole("article").filter({ has: page.getByRole("link", { name: `${resumeName} — Orbital` }) });
		await expect(copy.getByText("Orbital", { exact: true })).toBeVisible();
		// Search covers linked applications.
		await page.getByRole("searchbox", { name: "Search documents" }).fill("orbital");
		await expect(page.getByRole("link", { name: resumeName, exact: true })).toBeHidden();
		await expect(page.getByRole("link", { name: `${resumeName} — Orbital`, exact: true })).toBeVisible();
	} finally {
		await pool.end();
	}
});
