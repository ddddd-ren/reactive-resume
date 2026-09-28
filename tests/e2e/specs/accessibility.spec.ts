import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createSampleResumeFromDashboard, makeResumePublic, openDownloadDialog } from "../fixtures/resume";
import { expect, test } from "../fixtures/test";

// WCAG 2.1 A and AA, which the design's contrast and target rules are written against.
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function audit(page: Page, name: string) {
	const { violations } = await new AxeBuilder({ page })
		.withTags(TAGS)
		// The PDF.js text layer is transparent text over the canvas; its contrast isn't what anyone reads.
		.exclude(".textLayer")
		.analyze();
	const summary = violations.map(
		(violation) =>
			`${name}: ${violation.id} (${violation.impact}) × ${violation.nodes.length}: ${violation.nodes
				.slice(0, 3)
				.map(
					(node) =>
						`${node.target.join(" ")} ${node.html.slice(0, 160)} ${node.failureSummary?.split("\n").slice(1, 2).join("") ?? ""}`,
				)
				.join(" | ")}`,
	);
	expect(summary, summary.join("\n")).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
	test(`the main screens pass axe in ${scheme} mode`, async ({ authPage: page, browser }, testInfo) => {
		test.setTimeout(120_000);
		await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });

		await createSampleResumeFromDashboard(page, testInfo);
		await expect(page.getByRole("button", { name: "Download PDF", exact: true })).toBeVisible();
		await audit(page, "editor · write");

		await page.getByRole("tab", { name: /^Design/ }).click();
		await audit(page, "editor · design");
		await page.getByRole("tab", { name: /^Check/ }).click();
		await audit(page, "editor · check");

		await page.getByRole("button", { name: "Assistant", exact: true }).click();
		await expect(page.getByRole("region", { name: "Assistant" })).toBeVisible();
		await audit(page, "assistant");
		await page.getByRole("button", { name: "Close the assistant" }).click();

		const publicUrl = await makeResumePublic(page);
		await audit(page, "share sheet · link");
		await page.keyboard.press("Escape");
		await openDownloadDialog(page);
		await audit(page, "share sheet · download");
		await page.keyboard.press("Escape");

		for (const [path, name] of [
			["/dashboard", "documents"],
			["/dashboard/applications", "applications"],
			["/dashboard/applications?view=board", "applications · board"],
			["/dashboard/settings/account", "settings · account"],
			["/dashboard/settings/preferences", "settings · preferences"],
			["/dashboard/settings/ai", "settings · ai"],
		] as const) {
			await page.goto(path);
			await page.waitForLoadState("networkidle");
			await audit(page, name);
		}

		// Axe needs a page from an explicit context.
		const context = await browser.newContext({ colorScheme: scheme, reducedMotion: "reduce" });
		await page.goto("/dashboard");
		await page.getByRole("button", { name: "New", exact: true }).click();
		await expect(page.getByRole("dialog")).toBeVisible();
		await audit(page, "new dialog");
		await page.getByRole("button", { name: "New cover letter instead" }).click();
		await page.waitForURL(/\/builder\/letter\//);
		await expect(page.getByRole("button", { name: /^Document menu/ })).toBeVisible();
		await audit(page, "letter editor");

		await page.keyboard.press("ControlOrMeta+k");
		await expect(page.getByRole("dialog")).toBeVisible();
		await audit(page, "command palette");
		await page.keyboard.press("Escape");

		const visitor = await context.newPage();
		try {
			await visitor.goto(publicUrl);
			await expect(visitor.getByRole("heading", { level: 1 })).toBeVisible();
			await audit(visitor, "shared resume");
			await visitor.goto("/ats-checker");
			await expect(visitor.getByRole("button", { name: "Check a sample file" })).toBeVisible();
			await audit(visitor, "ats checker");
			await visitor.goto("/auth/login");
			await audit(visitor, "sign in");
		} finally {
			await context.close();
		}
	});
}

test("phone screens pass axe", async ({ authPage: page, browser }, testInfo) => {
	test.setTimeout(120_000);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: "reduce" });

	await createSampleResumeFromDashboard(page, testInfo);
	await expect(page.getByRole("textbox", { name: "Full name" })).toBeVisible();
	await audit(page, "phone · editor");
	const publicUrl = await makeResumePublic(page);

	for (const [path, name] of [
		["/dashboard", "phone · documents"],
		["/dashboard/applications", "phone · applications"],
		["/dashboard/settings", "phone · settings root"],
	] as const) {
		await page.goto(path);
		await page.waitForLoadState("networkidle");
		await audit(page, name);
	}

	const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
	const visitor = await context.newPage();
	try {
		await visitor.goto(publicUrl);
		await expect(visitor.getByRole("button", { name: "Download PDF" })).toBeVisible();
		await audit(visitor, "phone · shared resume");
	} finally {
		await context.close();
	}
});
