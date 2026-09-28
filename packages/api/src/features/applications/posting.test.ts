import { describe, expect, it } from "vitest";
import { allPublic, assertPublicPageUrl, htmlToText, isPostingLink, readJobPosting } from "./posting";

describe("posting links", () => {
	it("tells a lone link from pasted text", () => {
		expect(isPostingLink("  https://jobs.example.com/123 ")).toBe(true);
		expect(isPostingLink("Apply at https://jobs.example.com/123 today")).toBe(false);
	});

	it("accepts only public https pages", () => {
		expect(assertPublicPageUrl("https://jobs.example.com/a#apply").toString()).toBe("https://jobs.example.com/a");
		for (const url of [
			"http://jobs.example.com/a",
			"https://user:pass@jobs.example.com/a",
			"https://localhost/a",
			"https://127.0.0.1/a",
			"https://10.0.0.8/a",
			"https://[::1]/a",
			"ftp://jobs.example.com/a",
		]) {
			expect(() => assertPublicPageUrl(url), url).toThrow();
		}
	});

	it("refuses a host when any address it resolves to is private", () => {
		expect(allPublic([{ address: "93.184.216.34" }])).toBe(true);
		expect(allPublic([{ address: "93.184.216.34" }, { address: "192.168.1.4" }])).toBe(false);
		expect(allPublic([])).toBe(false);
	});
});

describe("htmlToText", () => {
	it("keeps the words and line breaks, and drops scripts, styles and entities", () => {
		const html =
			"<head><title>x</title></head><h1>Designer</h1><p>Figma &amp; research</p><script>alert(1)</script><ul><li>5+ years</li></ul>";
		expect(htmlToText(html)).toBe("Designer\nFigma & research\n5+ years");
	});
});

describe("readJobPosting", () => {
	it("reads a JobPosting from the page's JSON-LD, including inside a graph", () => {
		const html = `<script type="application/ld+json">${JSON.stringify({
			"@graph": [
				{ "@type": "Organization", name: "Ignore" },
				{
					"@type": "JobPosting",
					title: "Senior Product Designer",
					hiringOrganization: { name: "Lumen Health" },
					jobLocation: { address: { addressLocality: "Berlin", addressCountry: "DE" } },
					description: "<p>Design calm tools.</p><ul><li>Figma</li></ul>",
				},
			],
		})}</script>`;

		expect(readJobPosting(html)).toEqual({
			role: "Senior Product Designer",
			company: "Lumen Health",
			location: "Berlin, DE",
			description: "Design calm tools.\nFigma",
		});
	});

	it("returns nothing for a page without one, or with broken JSON", () => {
		expect(readJobPosting('<script type="application/ld+json">{not json</script><p>Hi</p>')).toBeNull();
	});
});
