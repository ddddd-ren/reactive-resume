import type { Page, TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { Pool } from "pg";
import { createSampleResumeFromDashboard, openDownloadDialog, openResumeCardMenu } from "../fixtures/resume";
import { expect, test } from "../fixtures/test";

const summaryMarker = "RECOVERY_SUMMARY_MARKER";
const builtInMarker = "RECOVERY_BUILTIN_MARKER";
const customMarker = "RECOVERY_CUSTOM_MARKER";

type AuthoredLayout = {
	pages: Array<{ fullWidth: boolean; main: string[]; sidebar: string[] }>;
};

async function seedRecoveryResume(resumeId: string): Promise<AuthoredLayout> {
	const pool = new Pool({ connectionString: process.env.DATABASE_URL });

	try {
		const result = await pool.query<{ data: Record<string, unknown> }>('select data from "resume" where id = $1', [
			resumeId,
		]);
		const data = result.rows[0]?.data as {
			summary: { title: string; content: string; hidden: boolean };
			sections: { experience: { title: string; hidden: boolean; items: Array<{ company: string }> } };
			customSections: Array<{
				id: string;
				title: string;
				hidden: boolean;
				items: Array<{ company?: string }>;
			}>;
			metadata: {
				layout: AuthoredLayout;
				typography: { body: { fontFamily: string }; heading: { fontFamily: string } };
			};
		};
		if (!data?.sections.experience.items[0] || !data.customSections[0]?.items[0]) {
			throw new Error("Sample resume lacks recovery fixture sections.");
		}

		data.summary.title = "Recovery Summary";
		data.summary.content = `<p>${summaryMarker}</p>`;
		data.summary.hidden = false;
		data.sections.experience.title = "Recovery Experience";
		data.sections.experience.items[0].company = builtInMarker;
		data.sections.experience.hidden = false;
		data.customSections[0].title = "Recovery Custom";
		data.customSections[0].items[0].company = customMarker;
		data.customSections[0].hidden = false;
		data.metadata.typography.body.fontFamily = "Helvetica";
		data.metadata.typography.heading.fontFamily = "Helvetica";
		const layout = structuredClone(data.metadata.layout);

		await pool.query('update "resume" set data = $2, updated_at = now() where id = $1', [resumeId, data]);
		return layout;
	} finally {
		await pool.end();
	}
}

async function readRecoveryState(resumeId: string) {
	const pool = new Pool({ connectionString: process.env.DATABASE_URL });

	try {
		const result = await pool.query<{
			data: {
				summary: { hidden: boolean };
				sections: { experience: { hidden: boolean } };
				customSections: Array<{ title: string; hidden: boolean }>;
				metadata: { layout: AuthoredLayout };
			};
		}>('select data from "resume" where id = $1', [resumeId]);
		const data = result.rows[0]?.data;
		if (!data) throw new Error(`Resume ${resumeId} was not found.`);
		return data;
	} finally {
		await pool.end();
	}
}

function waitForResumeSave(page: Page) {
	return page.waitForResponse((response) => {
		if (!response.url().includes("/api/rpc") || response.request().method() !== "POST") return false;
		if (!response.ok()) return false;
		return response.request().postData()?.includes('"data"') ?? false;
	});
}

// Hidden sections stay in the outline; the eye on the row hides and shows them.
async function hideSection(page: Page, title: string) {
	const saved = waitForResumeSave(page);
	await page.getByRole("button", { name: `Hide ${title} from the page` }).click();
	await saved;
}

async function showSection(page: Page, title: string) {
	const saved = waitForResumeSave(page);
	await page.getByRole("button", { name: `Show ${title} on the page` }).click();
	await saved;
}

async function downloadPdfText(page: Page, testInfo: TestInfo, name: string) {
	const sheet = await openDownloadDialog(page);
	const pending = page.waitForEvent("download");
	await sheet.getByRole("button", { name: "Download PDF", exact: true }).click();
	const download = await pending;
	const path = testInfo.outputPath(`${name}.pdf`);
	await download.saveAs(path);
	await page.keyboard.press("Escape");

	const loading = getDocument({ data: new Uint8Array(await readFile(path)), useSystemFonts: true });
	try {
		const pdf = await loading.promise;
		const text: string[] = [];
		for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
			const pdfPage = await pdf.getPage(pageNumber);
			text.push(...(await pdfPage.getTextContent()).items.flatMap((item) => ("str" in item ? [item.str] : [])));
		}
		return text.join(" ");
	} finally {
		await loading.destroy();
	}
}

test("recovers hidden printable sections without changing authored placement", async ({ authPage: page }, testInfo) => {
	test.setTimeout(120_000);
	const resumeName = await createSampleResumeFromDashboard(page, testInfo);
	const resumeId = new URL(page.url()).pathname.split("/").at(-1);
	if (!resumeId) throw new Error("Builder URL lacks resume id.");
	const authoredLayout = await seedRecoveryResume(resumeId);
	await page.reload();

	await hideSection(page, "Recovery Summary");
	await hideSection(page, "Recovery Experience");
	await hideSection(page, "Recovery Custom");
	await page.reload();

	for (const title of ["Recovery Summary", "Recovery Experience", "Recovery Custom"]) {
		await expect(page.getByRole("button", { name: `Show ${title} on the page` })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		await expect(page.getByRole("button", { name: title, exact: true })).toBeVisible();
	}

	const hiddenPdf = await downloadPdfText(page, testInfo, "section-recovery-hidden");
	expect(hiddenPdf).not.toContain(summaryMarker);
	expect(hiddenPdf).not.toContain(builtInMarker);
	expect(hiddenPdf).not.toContain(customMarker);

	await showSection(page, "Recovery Summary");
	await showSection(page, "Recovery Experience");
	await showSection(page, "Recovery Custom");
	const shownState = await readRecoveryState(resumeId);
	expect(shownState.metadata.layout).toEqual(authoredLayout);
	expect(shownState.summary.hidden).toBe(false);
	expect(shownState.sections.experience.hidden).toBe(false);
	expect(shownState.customSections.find((section) => section.title === "Recovery Custom")?.hidden).toBe(false);

	const shownPdf = await downloadPdfText(page, testInfo, "section-recovery-shown");
	expect(shownPdf).toContain(summaryMarker);
	expect(shownPdf).toContain(builtInMarker);
	expect(shownPdf).toContain(customMarker);

	await page.getByRole("button", { name: "Undo", exact: true }).click();
	await expect(page.getByRole("button", { name: "Show Recovery Custom on the page" })).toBeVisible();
	// Redo has no button in the editor bar; ⇧⌘Z works while focus is outside fields (here, on Undo).
	await page.keyboard.press("ControlOrMeta+Shift+Z");
	await expect(page.getByRole("button", { name: "Show Recovery Custom on the page" })).toHaveCount(0);

	await page.getByRole("button", { name: "Undo", exact: true }).click();
	await expect
		.poll(
			async () =>
				(await readRecoveryState(resumeId)).customSections.find((section) => section.title === "Recovery Custom")
					?.hidden,
		)
		.toBe(true);
	await openResumeCardMenu(page, resumeName);
	const locked = page.waitForResponse((response) => (response.request().postData() ?? "").includes('"isLocked":true'));
	await page.getByRole("menuitem", { name: "Lock editing" }).click();
	await locked;
	await page.goto(`/builder/${resumeId}`);

	await expect(page.getByRole("button", { name: "Show Recovery Custom on the page" })).toBeDisabled();
	expect((await readRecoveryState(resumeId)).metadata.layout).toEqual(authoredLayout);
});
