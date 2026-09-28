import type { PageMapNode } from "@reactive-resume/pdf/page-map";
import { describe, expect, it, vi } from "vitest";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";

vi.mock("@/features/resume/builder/draft", () => ({ useResumeStore: { getState: vi.fn() } }));

const { measureOverflow } = await import("./fit");

const node = (page: number, y: number, height: number): PageMapNode => ({
	kind: "section",
	sectionId: "experience",
	key: `${page}-${y}`,
	page,
	x: 0,
	y,
	width: 100,
	height,
});

describe("measureOverflow", () => {
	// Body text is 10 pt at line height 1.5, so a line is 15 pt.
	const data = defaultResumeData;

	it("reports nothing while the content fits the authored pages", () => {
		expect(measureOverflow(data, { pageCount: 1, pageMap: { pages: [], nodes: [node(0, 0, 700)] } })).toBeNull();
	});

	it("counts the lines that spill past the authored pages", () => {
		const pageMap = { pages: [], nodes: [node(0, 0, 700), node(1, 36, 60), node(1, 90, 30)] };

		expect(measureOverflow(data, { pageCount: 2, pageMap })).toEqual({ authored: 1, pageCount: 2, lines: 6 });
	});

	it("adds up spill across several pages, whose positions are each relative to their page", () => {
		const pageMap = { pages: [], nodes: [node(1, 36, 700), node(2, 36, 30)] };

		expect(measureOverflow(data, { pageCount: 3, pageMap })?.lines).toBe(49);
	});

	it("still reports the overflow when the page map is missing", () => {
		expect(measureOverflow(data, { pageCount: 2, pageMap: undefined })).toEqual({
			authored: 1,
			pageCount: 2,
			lines: null,
		});
	});
});
