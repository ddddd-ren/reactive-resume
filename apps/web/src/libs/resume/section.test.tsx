// @vitest-environment happy-dom

import { beforeAll, describe, expect, it } from "vitest";
import { i18n } from "@lingui/core";
import { getSectionTitle } from "./section";

beforeAll(() => {
	i18n.loadAndActivate({ locale: "en", messages: {} });
});

const ALL_SECTIONS = [
	...["picture", "basics", "summary", "profiles", "experience", "education", "projects", "skills", "languages"],
	...["interests", "awards", "certifications", "publications", "volunteer", "references", "custom", "template"],
	...["layout", "sharing", "statistics", "typography", "design", "styles", "page", "notes", "export", "information"],
	"cover-letter",
] as Parameters<typeof getSectionTitle>[0][];

describe("getSectionTitle", () => {
	it("returns a non-empty string for every known sidebar section", () => {
		for (const section of ALL_SECTIONS) {
			const title = getSectionTitle(section);
			expect(typeof title, section).toBe("string");
			expect(title.length, section).toBeGreaterThan(0);
		}
	});

	it("returns distinct titles for each section", () => {
		const titles = ALL_SECTIONS.map((section) => getSectionTitle(section));
		expect(new Set(titles).size).toBe(titles.length);
	});
});
