import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { Template } from "@reactive-resume/schema/templates";
import type { PageMap } from "./page-map";
import type { SectionTitleResolver } from "./section-title";
import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { sampleResumeData } from "@reactive-resume/schema/resume/sample";
import { templateSchema } from "@reactive-resume/schema/templates";
import { ResumeDocument } from "./document";
import { extractPageMap, parseResumeNodeKey } from "./page-map";

const resolveSectionTitle: SectionTitleResolver = (input) => input.defaultEnglishTitle ?? input.sectionId;

// The sample's picture points at a web path that doesn't exist in Node; hide it so renders stay quiet.
const data: ResumeData = { ...sampleResumeData, picture: { ...sampleResumeData.picture, hidden: true } };

const renderPageMap = async (template: Template): Promise<PageMap> => {
	let pageMap: PageMap | undefined;
	const element = createElement(ResumeDocument, {
		data,
		template,
		resolveSectionTitle,
		onPageMap: (map) => {
			pageMap = map;
		},
	}) as unknown as Parameters<typeof renderToBuffer>[0];
	await renderToBuffer(element);
	if (!pageMap) throw new Error("onPageMap was not called");
	return pageMap;
};

describe("parseResumeNodeKey", () => {
	it("reads headers, sections and items, and ignores deeper nodes", () => {
		expect(parseResumeNodeKey("page-1/region-header/header")).toEqual({ kind: "header" });
		expect(parseResumeNodeKey("page-1/region-main/section-experience")).toEqual({
			kind: "section",
			sectionId: "experience",
		});
		expect(parseResumeNodeKey("page-2/region-main/section-experience/section-items/item-a%2Fb")).toEqual({
			kind: "item",
			sectionId: "experience",
			itemId: "a/b",
		});
		expect(parseResumeNodeKey("page-1/region-main/section-sidebar%3Askills/section-items/item-s")).toEqual({
			kind: "item",
			sectionId: "skills",
			itemId: "s",
		});
		expect(parseResumeNodeKey("page-1/region-main/section-experience/section-heading")).toBeUndefined();
		expect(
			parseResumeNodeKey("page-1/region-main/section-experience/section-items/item-a/item-header"),
		).toBeUndefined();
		expect(parseResumeNodeKey("page-1/region-main")).toBeUndefined();
	});
});

describe("extractPageMap", () => {
	it("sums parent offsets into page-relative boxes", () => {
		const layout = {
			type: "DOCUMENT",
			children: [
				{
					type: "PAGE",
					box: { left: 0, top: 0, width: 600, height: 800 },
					children: [
						{
							type: "VIEW",
							box: { left: 20, top: 30, width: 500, height: 200 },
							props: { "data-resume-node": "page-1/region-main/section-skills" },
							children: [
								{
									type: "VIEW",
									box: { left: 5, top: 40, width: 100, height: 20 },
									props: { "data-resume-node": "page-1/region-main/section-skills/section-items/item-x" },
								},
							],
						},
					],
				},
			],
		};

		expect(extractPageMap(layout)).toEqual({
			pages: [{ width: 600, height: 800 }],
			nodes: [
				{
					kind: "section",
					sectionId: "skills",
					key: "page-1/region-main/section-skills",
					page: 0,
					x: 20,
					y: 30,
					width: 500,
					height: 200,
				},
				{
					kind: "item",
					sectionId: "skills",
					itemId: "x",
					key: "page-1/region-main/section-skills/section-items/item-x",
					page: 0,
					x: 25,
					y: 70,
					width: 100,
					height: 20,
				},
			],
		});
	});

	it("returns an empty map for missing layout data", () => {
		expect(extractPageMap(undefined)).toEqual({ pages: [], nodes: [] });
	});
});

describe("rendered page maps", () => {
	const visibleExperienceIds = data.sections.experience.items.filter((item) => !item.hidden).map((item) => item.id);

	it.each(templateSchema.options)("%s maps the header and every experience entry onto the page", async (template) => {
		const { pages, nodes } = await renderPageMap(template);

		expect(pages.length).toBeGreaterThan(0);
		expect(nodes.some((node) => node.kind === "header" && node.page === 0)).toBe(true);

		const mappedItems = new Set(
			nodes.flatMap((node) => (node.kind === "item" && node.sectionId === "experience" ? [node.itemId] : [])),
		);
		for (const id of visibleExperienceIds) expect(mappedItems, `${template}: experience item ${id}`).toContain(id);

		for (const node of nodes) {
			const page = pages[node.page];
			expect(page, `${template}: ${node.key} page`).toBeDefined();
			if (!page) continue;
			expect(node.x, `${template}: ${node.key} x`).toBeGreaterThanOrEqual(-0.5);
			expect(node.y, `${template}: ${node.key} y`).toBeGreaterThanOrEqual(-0.5);
			expect(node.x + node.width, `${template}: ${node.key} right`).toBeLessThanOrEqual(page.width + 0.5);
			expect(node.y + node.height, `${template}: ${node.key} bottom`).toBeLessThanOrEqual(page.height + 0.5);
		}
	});
});
