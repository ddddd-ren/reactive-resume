import type { Page, TestInfo } from "@playwright/test";
import { expect } from "@playwright/test";
import { createResumeName } from "./data";

/**
 * Creates a sample resume named after the test and opens it in the editor. It goes through the API: the New
 * dialog has its own spec (documents), and every other spec just needs a resume.
 */
export async function createSampleResumeFromDashboard(page: Page, testInfo: TestInfo) {
	const resumeName = createResumeName(testInfo);

	const response = await page.request.post("/api/openapi/resumes", {
		data: { name: resumeName, tags: [], withSampleData: true },
	});
	expect(response.ok()).toBe(true);
	const resumeId = (await response.json()) as string;

	await page.goto(`/builder/${resumeId}`);
	await page.waitForURL(/\/builder\/.+/);

	return resumeName;
}

// Design groups, each under its own heading, and the exact-value sections inside Design → Advanced.
const designGroups = new Set(["Template", "Type", "Color", "Page"]);
const advancedSections = new Set(["Layout", "Typography", "Design", "Custom CSS"]);
// Sections the Share & export sheet hosts, without headings of their own.
const shareSections = new Set(["Sharing", "Statistics"]);

export async function openSidebarSection(page: Page, title: string) {
	if (shareSections.has(title)) {
		// "Share (link is live)" once the resume is public.
		await page.getByRole("button", { name: /^Share\b/ }).click();
		await expect(page.getByRole("dialog", { name: "Share & export" })).toBeVisible();
		return;
	}

	if (designGroups.has(title) || advancedSections.has(title)) {
		await page.getByRole("tab", { name: "Design", exact: true }).click();
		const panel = page.getByRole("tabpanel", { name: "Design" });
		if (advancedSections.has(title)) {
			const advanced = panel.locator("#design-advanced");
			if ((await advanced.getAttribute("open")) === null) await advanced.locator("summary").click();
		}
		// Groups are level 2; the exact-value sections inside Advanced are level 3 (both have a "Page").
		const level = advancedSections.has(title) ? 3 : 2;
		const heading = panel.getByRole("heading", { name: title, exact: true, level });
		await heading.scrollIntoViewIfNeeded();
		await expect(heading).toBeVisible();
		return;
	}

	// Write: the Basics card is open by default; every other section is an outline row that opens on click.
	await page.getByRole("tab", { name: "Write", exact: true }).click();
	if (title === "Basics") {
		await expect(page.getByRole("textbox", { name: "Full name", exact: true })).toBeVisible();
		return;
	}
	// A custom section can share a built-in's title (the sample has two "Experience" sections); prefer the built-in.
	const builtIn = page.locator(`#sidebar-${title.toLowerCase()}`).getByRole("button", { name: title, exact: true });
	const row = (await builtIn.count()) > 0 ? builtIn : page.getByRole("button", { name: title, exact: true }).first();
	await row.scrollIntoViewIfNeeded();
	if ((await row.getAttribute("aria-expanded")) !== "true") await row.click();
	await expect(row).toHaveAttribute("aria-expanded", "true");
}

/** Opens Share & export on its Download tab, from the ▾ next to Download PDF. */
export async function openDownloadDialog(page: Page) {
	await page.getByRole("button", { name: "More download formats", exact: true }).click();
	const sheet = page.getByRole("dialog", { name: "Share & export" });
	await expect(sheet.getByRole("tab", { name: "Download", exact: true })).toHaveAttribute("aria-selected", "true");
	return sheet;
}

/** Turns the public link on in Share → Link and returns the public address. */
export async function makeResumePublic(page: Page) {
	await openSidebarSection(page, "Sharing");
	const sheet = page.getByRole("dialog", { name: "Share & export" });
	await sheet.getByRole("switch", { name: "Public link" }).click();
	return getPublicUrl(page);
}

/** The public address, from Share → Link's "Open public page" (it fills in once the session has loaded). */
export async function getPublicUrl(page: Page) {
	const link = page.getByRole("dialog", { name: "Share & export" }).getByRole("link", { name: "Open public page" });
	await expect(link).toHaveAttribute("href", /\/e2e_/);
	return (await link.getAttribute("href")) as string;
}

/** Opens a document's card menu in Documents (right-click, the same menu as ⋯). */
export async function openResumeCardMenu(page: Page, resumeName: string, { reload = true } = {}) {
	if (reload) await page.goto("/dashboard");
	const card = page.getByRole("link", { name: resumeName, exact: true });
	await expect(card).toBeVisible();
	await card.click({ button: "right" });
	await expect(page.getByRole("menuitem", { name: "Open" })).toBeVisible();
}
