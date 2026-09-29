import type { ElementInfo, RenderWithLayoutResult } from "@formepdf/core";
import type { FormeDocument } from "@formepdf/react";
import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { Template } from "@reactive-resume/schema/templates";
import type { Locale } from "@reactive-resume/utils/locale";
import type { ReactElement } from "react";
import type { ResumeRenderOptions } from "../context";
import type { PageMap } from "../page-map";
import type { SectionTitleResolver } from "../section-title";
import { createElement } from "react";
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
	/** Parsed with `parseResumeData`: the entry points check data at their boundary. */
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
	/** Font families that couldn't be downloaded; their text falls back to the standard PDF fonts. */
	missingFonts: string[];
	/** What the engine couldn't draw as asked; for diagnostics, never shown as errors. */
	warnings: string[];
};

// A4 height: a free-form page is never shorter than a sheet of paper, as before.
const FREE_FORM_MIN_HEIGHT = 841.89;

type PageKind = Extract<FormeDocument["children"][number]["kind"], { type: "Page" }>;

// Forme leaves a box it failed to place at ±Number.MAX_VALUE; the page is then likely wrong.
const offPage = (value: number) => !(Math.abs(value) < 1e6);
const misplacesABox = (result: RenderWithLayoutResult) =>
	result.layout.pages.some((page) =>
		page.elements.some(function bad(element): boolean {
			return offPage(element.y) || offPage(element.height) || element.children.some(bad);
		}),
	);

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
export function renderResume(engine: FormeEngine, input: RenderResumeInput): Promise<RenderedResume> {
	const { data } = input;
	return renderResumeElement(
		engine,
		createElement(ResumeDocument, {
			data,
			template: input.template ?? data.metadata.template,
			...(input.renderOptions ? { renderOptions: input.renderOptions } : {}),
			resolveSectionTitle: input.resolveSectionTitle,
		}),
	);
}

/**
 * Renders an element tree (normally a `ResumeDocument`) to PDF. The fonts come from the `data` prop of the root
 * element when it has one; without it, only the standard PDF fonts are available.
 */
export async function renderResumeElement(engine: FormeEngine, element: ReactElement): Promise<RenderedResume> {
	const data = (element.props as { data?: ResumeData }).data;
	const fontRequests = data
		? resolvePdfFonts(
				data.metadata.typography,
				data.metadata.page.locale as Locale,
				resumeContentContainsCJK(data),
				resumeContentScripts(data),
			).fonts
		: [];
	const [{ fonts, warnings: fontWarnings, missing }] = await Promise.all([loadFonts(fontRequests), loadIcons()]);

	const tree = renderHostTree(element);
	const { images, warnings: imageWarnings } = await loadImages(imageSources(tree));

	const layOut = async (keepNestedRowsWhole: boolean) => {
		const { document, warnings } = toFormeDocument(tree, { images, keepNestedRowsWhole });
		// Forme rewrites the font entries it's given (bytes to base64), so each render gets its own.
		const render = () =>
			engine.renderSerializedDocWithLayout({ ...document, fonts: fonts.map((font) => ({ ...font })) });
		let result = await render();

		// Free-form pages grow with their content: measure it, then render once more at that height.
		let measured = false;
		document.children.forEach((page, index) => {
			const kind = page.kind as PageKind;
			if (kind.type !== "Page" || typeof kind.config.size !== "object") return;
			const { width, height } = kind.config.size.Custom;
			if (height !== FREE_FORM_MEASURE_HEIGHT) return;
			kind.config.size = { Custom: { width, height: measuredHeight(result, index, kind.config.margin.bottom) } };
			measured = true;
		});
		if (measured) result = await render();
		return { result, warnings };
	};

	let { result, warnings } = await layOut(false);
	if (misplacesABox(result)) ({ result, warnings } = await layOut(true));
	if (misplacesABox(result))
		warnings.push("render defect: the engine couldn't place a box; a page may be laid out wrong");

	return {
		pdf: result.pdf,
		pageMap: extractPageMap(result.layout),
		missingFonts: [...new Set(missing)],
		layout: result.layout,
		warnings: [...fontWarnings, ...imageWarnings, ...warnings, ...result.warnings],
	};
}
