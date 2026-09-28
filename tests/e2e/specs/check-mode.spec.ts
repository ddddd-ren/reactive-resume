import { createSampleResumeFromDashboard } from "../fixtures/resume";
import { expect, test } from "../fixtures/test";

const POSTING =
	"Senior Gameplay Engineer. Requirements: 5+ years with Unity and C#. Experience with multiplayer networking, " +
	"Perforce and HLSL. Familiarity with Kubernetes for game servers. Strong mentoring skills.";

test("fixes, ignores and restores issues pinned to the page", async ({ authPage: page }, testInfo) => {
	await createSampleResumeFromDashboard(page, testInfo);
	await page.getByRole("tab", { name: /^Check/ }).click();

	const issues = page.getByRole("list", { name: "Issues" });
	const photo = issues.getByRole("listitem").filter({ hasText: "Your resume has a photo" });
	await expect(page.getByText(/\d+ of \d+ checks pass\./)).toBeVisible();
	// Each open issue has a numbered pin on its line of the page.
	await expect(page.getByRole("button", { name: /^Issue \d+: Your resume has a photo$/ })).toBeVisible();

	// A one-step fix applies with undo, and the issue goes.
	await photo.getByRole("button", { name: "Hide the photo" }).click();
	await expect(photo).toHaveCount(0);
	await page.getByRole("button", { name: "Undo", exact: true }).last().click();
	await expect(photo).toHaveCount(1);

	// Ignoring sets it aside, stored with the resume, until it's asked for again.
	await photo.getByRole("button", { name: "Ignore" }).click();
	await expect(photo).toHaveCount(0);
	await expect(page.getByText("1 issue is ignored.")).toBeVisible();
	await expect(page.getByText("Saved", { exact: true })).toBeVisible();
	await page.reload();
	await expect(page.getByText("1 issue is ignored.")).toBeVisible();
	await page.getByRole("button", { name: "Show them again" }).click();
	await expect(photo).toHaveCount(1);

	// The parser view shows the text extracted from the PDF on the page.
	await page.getByRole("button", { name: "What a parser reads" }).click();
	await expect(page.getByText("Extracted from the PDF on the page · reading order")).toBeVisible();
	await page.getByRole("button", { name: "What a person sees" }).click();
});

test("matches a pasted posting and hides a term that isn't true", async ({ authPage: page }, testInfo) => {
	await createSampleResumeFromDashboard(page, testInfo);
	await page.getByRole("tab", { name: /^Check/ }).click();
	await page.getByRole("tab", { name: /^Job match/ }).click();

	await expect(page.getByText("This resume isn't linked to an application yet.")).toBeVisible();
	await page.getByRole("textbox", { name: "Job posting" }).fill(POSTING);
	await page.getByRole("button", { name: "Match this posting" }).click();

	await expect(page.getByText(/^\d+ of \d+ posting terms appear$/)).toBeVisible();
	await expect(page.getByText("not scored")).toBeVisible();

	// A missing term is never added on its own: it asks, and can be hidden instead.
	await page.getByRole("button", { name: "Kubernetes", exact: true }).click();
	await page.getByRole("button", { name: "Not true for me, hide it" }).click();
	await expect(page.getByRole("button", { name: "Kubernetes", exact: true })).toHaveCount(0);
	await expect(page.getByText(/^Hidden: kubernetes/)).toBeVisible();

	// Writing needs an AI provider; without one it says so and leaves the rest working.
	await page.getByRole("tab", { name: "Writing" }).click();
	await expect(page.getByRole("link", { name: "Open AI settings" })).toBeVisible();
});
