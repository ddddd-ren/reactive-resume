import type { Page, TestInfo } from "@playwright/test";
import { expect } from "@playwright/test";
import { createResumeName } from "./data";

export async function createSampleResumeFromDashboard(page: Page, testInfo: TestInfo) {
	const resumeName = createResumeName(testInfo);

	await page.goto("/dashboard/resumes");
	await page.getByText("Create a new resume").click();

	const dialog = page.getByRole("dialog", { name: "Create a new resume" });
	await dialog.getByLabel("Name").fill(resumeName);

	const createGroup = dialog.getByRole("group", { name: "Create resume with options" });
	await createGroup.getByRole("button").last().click();
	await page.getByRole("menuitem", { name: "Create a Sample Resume" }).click();

	// Creating a resume now navigates straight into the builder.
	await page.waitForURL(/\/builder\/.+/);

	return resumeName;
}

// Sections the Design mode hosts; every other section title lives in Write.
const designSections = new Set(["Template", "Layout", "Typography", "Design", "Page"]);
// Sections the Share & export sheet hosts, without headings of their own.
const shareSections = new Set(["Sharing", "Statistics"]);

export async function openSidebarSection(page: Page, title: string) {
	if (shareSections.has(title)) {
		// "Share (link is live)" once the resume is public.
		await page.getByRole("button", { name: /^Share\b/ }).click();
		await expect(page.getByRole("dialog", { name: "Share & export" })).toBeVisible();
		return;
	}

	if (designSections.has(title)) {
		await page.getByRole("tab", { name: "Design", exact: true }).click();
		// The visible section heading is exactly the title. Filter to visible because the screen-reader-only
		// resume mirror in the preview also renders <h2> section headings with the same name.
		const heading = page.getByRole("heading", { name: title, exact: true }).filter({ visible: true }).first();
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

/** Opens the Download dialog with every format from the ▾ next to Download PDF. */
export async function openDownloadDialog(page: Page) {
	await page.getByRole("button", { name: "More download formats", exact: true }).click();
	await expect(page.getByRole("dialog", { name: "Download" })).toBeVisible();
}

export async function openResumeCardMenu(page: Page, resumeName: string, { reload = true } = {}) {
	if (reload) await page.goto("/dashboard/resumes");
	const resumeLink = page.getByRole("link", { name: new RegExp(resumeName) });
	await expect(resumeLink).toBeVisible();
	await resumeLink.click({ button: "right" });
	await expect(page.getByRole("menuitem", { name: "Open" })).toBeVisible();
}
