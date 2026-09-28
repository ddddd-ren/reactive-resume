import { expect, test } from "../fixtures/test";

test("checks a file in the browser, then signs up and opens it in Check", async ({ page, account }) => {
	test.setTimeout(90_000);

	// A visitor sees the score, the issues and the text as software reads it.
	await page.goto("/ats-checker");
	await page.getByRole("button", { name: "Check a sample file" }).click();
	await expect(page.getByRole("img", { name: /Readability score: \d+ out of 100/ })).toBeVisible({ timeout: 30_000 });
	await page.getByRole("tab", { name: "As software reads it" }).click();
	await expect(page.locator("pre")).not.toBeEmpty();

	// Fixing asks them to sign up, then imports the same file and opens it in Check.
	await page.getByRole("button", { name: "Fix these in the editor" }).click();
	await page.waitForURL(/\/auth\/register\?callbackURL=/);
	await page.getByRole("textbox", { name: "Name", exact: true }).fill(account.name);
	await page.getByLabel("Username").fill(account.username);
	await page.getByLabel("Email Address", { exact: true }).fill(account.email);
	await page.getByLabel("Password", { exact: true }).fill(account.password);
	await page.getByRole("button", { name: "Sign up" }).click();
	await page.getByRole("button", { name: "Continue" }).click();
	await page.waitForURL(/\/builder\/[^/]+\?mode=check/, { timeout: 30_000 });
	await expect(page.getByRole("img", { name: /Readability score/ })).toBeVisible();
});
