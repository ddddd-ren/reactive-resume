import { createSampleResumeFromDashboard, openSidebarSection } from "../fixtures/resume";
import { expect, test } from "../fixtures/test";

test("previews a template on hover, applies it on click and persists the choice", async ({
	authPage: page,
}, testInfo) => {
	await createSampleResumeFromDashboard(page, testInfo);

	await openSidebarSection(page, "Template");
	// Sample resumes start on Azurill.
	await expect(page.getByRole("button", { name: /^Azurill\b/ })).toHaveAttribute("aria-pressed", "true");

	const bronzor = page.getByRole("button", { name: /^Bronzor\b/ });
	await bronzor.hover();
	await expect(page.getByRole("status").filter({ hasText: "Previewing Bronzor · click to apply" })).toBeVisible();

	const savePromise = page.waitForResponse((response) => {
		if (!response.url().includes("/api/rpc")) return false;
		if (response.request().method() !== "POST") return false;
		if (!response.ok()) return false;
		return (response.request().postData() ?? "").includes("bronzor");
	});
	await bronzor.click();
	await expect(page.getByText("Template changed to Bronzor")).toBeVisible();
	await expect(bronzor).toHaveAttribute("aria-pressed", "true");
	await savePromise;

	// After a reload the gallery still marks the newly selected template.
	await page.reload();
	await openSidebarSection(page, "Template");
	await expect(page.getByRole("button", { name: /^Bronzor\b/ })).toHaveAttribute("aria-pressed", "true");
});

test("undoes a template switch from its toast", async ({ authPage: page }, testInfo) => {
	await createSampleResumeFromDashboard(page, testInfo);
	await openSidebarSection(page, "Template");

	await page.getByRole("button", { name: /^Onyx\b/ }).click();
	await page.getByRole("button", { name: "Undo", exact: true }).last().click();
	await expect(page.getByRole("button", { name: /^Azurill\b/ })).toHaveAttribute("aria-pressed", "true");
});
