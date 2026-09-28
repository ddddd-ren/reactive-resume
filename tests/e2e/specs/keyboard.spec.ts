import type { Page } from "@playwright/test";
import { createSampleResumeFromDashboard } from "../fixtures/resume";
import { expect, test } from "../fixtures/test";

const focusedName = (page: Page) =>
	page.evaluate(() => {
		const element = document.activeElement as HTMLElement | null;
		return element?.getAttribute("aria-label") ?? element?.textContent?.trim() ?? "";
	});

test("sheets, panels and dialogs return focus to what opened them", async ({ authPage: page }, testInfo) => {
	test.setTimeout(60_000);
	await createSampleResumeFromDashboard(page, testInfo);

	// Share & export, opened and closed from the keyboard.
	const share = page.getByRole("button", { name: "Share", exact: true });
	await share.focus();
	await page.keyboard.press("Enter");
	await expect(page.getByRole("dialog", { name: "Share & export" })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("dialog", { name: "Share & export" })).toBeHidden();
	await expect(share).toBeFocused();

	// The assistant: closing it returns to the ✦ button.
	const assistant = page.getByRole("button", { name: "Assistant", exact: true });
	await assistant.focus();
	await page.keyboard.press("Enter");
	const close = page.getByRole("button", { name: "Close the assistant" });
	await close.focus();
	await page.keyboard.press("Enter");
	await expect(assistant).toBeFocused();

	// New, from Documents.
	await page.goto("/dashboard");
	const create = page.getByRole("button", { name: "New", exact: true });
	await create.focus();
	await page.keyboard.press("Enter");
	await expect(page.getByRole("dialog")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(create).toBeFocused();

	// The command palette, from the search button.
	const search = page.getByRole("button", { name: /Search or run/ });
	await search.focus();
	await page.keyboard.press("Enter");
	await expect(page.getByRole("dialog")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect.poll(() => focusedName(page)).toMatch(/Search or run/);
});
