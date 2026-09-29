// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock locale module so getLocaleMessages returns a known mapping
// without trying to dynamically load .po files (which Vite/glob handles
// only inside the real bundle).
vi.mock("@/libs/locale", () => ({
	resolveLocale: (locale: string) => locale || "en-US",
	getLocaleMessages: async (locale: string) => ({
		locale,
		messages: {},
	}),
}));

beforeEach(() => {
	vi.resetModules();
});

afterEach(() => {
	vi.resetModules();
});

describe("createSectionTitleResolverForLocale", () => {
	it("returns a resolver function that produces section titles", async () => {
		const { createSectionTitleResolverForLocale } = await import("./section-title-locale");

		const resolver = await createSectionTitleResolverForLocale("en-US");
		const title = resolver({ sectionId: "experience", locale: "en-US", sectionKind: "builtin" });

		expect(typeof title).toBe("string");
		expect(title.length).toBeGreaterThan(0);
	});

	it("caches resolvers per requested locale", async () => {
		const { createSectionTitleResolverForLocale } = await import("./section-title-locale");

		const [a, b] = await Promise.all([
			createSectionTitleResolverForLocale("en-US"),
			createSectionTitleResolverForLocale("en-US"),
		]);

		expect(a).toBe(b);
	});

	it("falls back to en-US for an unknown locale", async () => {
		const { createSectionTitleResolverForLocale } = await import("./section-title-locale");

		const resolver = await createSectionTitleResolverForLocale("xx-YY");
		const title = resolver({ sectionId: "skills", locale: "en-US", sectionKind: "builtin" });

		expect(typeof title).toBe("string");
		expect(title.length).toBeGreaterThan(0);
	});
});
