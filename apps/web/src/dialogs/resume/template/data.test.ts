import { describe, expect, it } from "vitest";
import { templateLayouts } from "@reactive-resume/schema/templates";
import { templates } from "./data";

describe("templates metadata", () => {
	const entries = Object.entries(templates);

	it("declares the expected template ids", () => {
		const ids = Object.keys(templates).sort();
		expect(ids).toEqual(
			[
				"azurill",
				"bronzor",
				"chikorita",
				"ditgar",
				"ditto",
				"gengar",
				"glalie",
				"kakuna",
				"lapras",
				"leafish",
				"meowth",
				"onyx",
				"pikachu",
				"rhyhorn",
				"scizor",
			].sort(),
		);
	});

	it("provides a name, description, image, and tags for every template", () => {
		for (const [id, meta] of entries) {
			expect(meta.name, id).toBeTruthy();
			expect(meta.description, id).toBeDefined();
			expect(meta.imageUrl, id).toMatch(/^\/templates\//);
			expect(Array.isArray(meta.tags), id).toBe(true);
			expect(meta.tags.length, id).toBeGreaterThan(0);
		}
	});

	it("takes each template's layout from the shared metadata", () => {
		for (const [id] of entries) {
			const layout = templateLayouts[id as keyof typeof templateLayouts];
			expect(layout, id).toBeDefined();
			expect(layout.columns === 2, id).toBe(layout.sidebarSide !== null);
		}
	});

	it("uses unique image URLs per template", () => {
		const urls = entries.map(([, m]) => m.imageUrl);
		expect(new Set(urls).size).toBe(urls.length);
	});

	it("uses lowercase ids that match a lowercase form of the display name", () => {
		for (const [id, meta] of entries) {
			expect(id).toBe(id.toLowerCase());
			expect(meta.name.toLowerCase()).toBe(id);
		}
	});
});
