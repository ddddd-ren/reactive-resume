import type { ElementInfo, RenderWithLayoutResult } from "@formepdf/core";
import type { FormeDocument } from "@formepdf/react";
import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { Template } from "@reactive-resume/schema/templates";
import type { Locale } from "@reactive-resume/utils/locale";
import type { ResumeRenderOptions } from "../context";
import type { PageMap } from "../page-map";
import type { SectionTitleResolver } from "../section-title";
import { createElement } from "react";
import { parseResumeData } from "@reactive-resume/schema/resume/data";
import { ResumeDocument } from "../document";
import { resolvePdfFonts, resumeContentContainsCJK, resumeContentScripts } from "../hooks/use-register-fonts";
import { extractPageMap } from "../page-map";
import { loadFonts } from "./fonts";
import { loadIcons } from "./icons";
import { imageSources, loadImages } from "./images";
import { renderHostTree } from "./reconciler";
import { FIXED_SOURCE, FREE_FORM_MEASURE_HEIGHT, toFormeDocument } from "./to-forme";

/** The Forme entry point for this runtime: `@formepdf/core` in Node, `@formepdf/core/worker` in browsers. */
export type FormeEngine = {
	renderSerializedDocWithLayout: (document: Record<string, unknown>) => Promise<RenderWithLayoutResult>;
};

export type RenderResumeInput = {
	data: ResumeData;
	template?: Template | undefined;
	renderOptions?: ResumeRenderOptions | undefined;
	resolveSectionTitle?: SectionTitleResolver | undefined;
};

export type RenderedResume = {
	pdf: Uint8Array;
	/** Header, section and item boxes, for click-to-edit, Check and Fit (see `page-map.ts`). */
	pageMap: PageMap;
	/** Forme's layout of every page, for tests and diagnostics. */
	layout: RenderWithLayoutResult["layout"];
	/** What the engine couldn't draw as asked; for diagnostics, never shown as errors. */
	warnings: string[];
};

// A4 height: a free-form page is never shorter than a sheet of paper, as before.
const FREE_FORM_MIN_HEIGHT = 841.89;

type PageKind = Extract<FormeDocument["children"][number]["kind"], { type: "Page" }>;

const isFixed = (element: ElementInfo): boolean =>
	element.sourceLocation?.file === FIXED_SOURCE || element.children.some(isFixed);

/** A free-form page's content height: the lowest box on it plus the page's bottom margin. */
function measuredHeight(result: RenderWithLayoutResult, pageIndex: number, marginBottom: number) {
	const page = result.layout.pages[pageIndex];
	if (!page) return FREE_FORM_MIN_HEIGHT;
	// Repeated backgrounds span the page they're measured on, so they don't count.
	const content = page.elements.filter((element) => !isFixed(element));
	const bottom = content.reduce((lowest, element) => Math.max(lowest, element.y + element.height), 0);
	return Math.max(FREE_FORM_MIN_HEIGHT, Math.ceil(bottom + marginBottom));
}

/**
 * Renders a resume or letter to PDF bytes with its page map. Every PDF in the app goes through here: the live
 * preview, downloads, thumbnails, the public page and the server export.
 */
export async function renderResume(engine: FormeEngine, input: RenderResumeInput): Promise<RenderedResume> {
	const data = parseResumeData(input.data);
	const template = input.template ?? data.metadata.template;

	const { fonts: fontRequests } = resolvePdfFonts(
		data.metadata.typography,
		data.metadata.page.locale as Locale,
		resumeContentContainsCJK(data),
		resumeContentScripts(data),
	);
	const [{ fonts, warnings: fontWarnings }] = await Promise.all([loadFonts(fontRequests), loadIcons()]);

	const tree = renderHostTree(
		createElement(ResumeDocument, {
			data,
			template,
			...(input.renderOptions ? { renderOptions: input.renderOptions } : {}),
			resolveSectionTitle: input.resolveSectionTitle,
		}),
	);
	const { images, warnings: imageWarnings } = await loadImages(imageSources(tree));
	const { document, warnings } = toFormeDocument(tree, images);
	document.fonts = fonts;

	let result = await engine.renderSerializedDocWithLayout({ ...document });

	// Free-form pages grow with their content: measure it, then render once more at that height.
	if (data.metadata.page.format === "free-form") {
		let changed = false;
		document.children.forEach((page, index) => {
			const kind = page.kind as PageKind;
			if (kind.type !== "Page" || typeof kind.config.size !== "object") return;
			const { width, height } = kind.config.size.Custom;
			if (height !== FREE_FORM_MEASURE_HEIGHT) return;
			kind.config.size = { Custom: { width, height: measuredHeight(result, index, kind.config.margin.bottom) } };
			changed = true;
		});
		if (changed) result = await engine.renderSerializedDocWithLayout({ ...document });
	}

	// Forme marks a box it failed to place with an infinite coordinate; the page is then likely wrong.
	const misplaced = result.layout.pages.some((page) =>
		page.elements.some(function bad(element): boolean {
			return !Number.isFinite(element.y) || !Number.isFinite(element.height) || element.children.some(bad);
		}),
	);
	if (misplaced) warnings.push("render defect: the engine couldn't place a box; a page may be laid out wrong");

	return {
		pdf: result.pdf,
		pageMap: extractPageMap(result.layout),
		layout: result.layout,
		warnings: [...fontWarnings, ...imageWarnings, ...warnings, ...result.warnings],
	};
}
