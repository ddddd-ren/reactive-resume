import type { ElementInfo, LayoutInfo } from "@formepdf/core";

/**
 * Maps rendered PDF regions back to resume data, so the editor can outline the block a field
 * belongs to and select an entry when its line on the page is clicked.
 *
 * Templates tag the views that own a semantic node with `RESUME_NODE_PROP` (see
 * `templates/shared/primitives.tsx` and `templates/shared/sections.tsx`). The Forme conversion gives
 * each tagged element a source location, `rr-node:<key>`, which Forme reports back with every box in
 * its layout info.
 */

export const RESUME_NODE_PROP = "data-resume-node";

export type PageMapTarget =
	| { kind: "header" }
	| { kind: "section"; sectionId: string }
	| { kind: "item"; sectionId: string; itemId: string };

export type PageMapNode = PageMapTarget & {
	key: string;
	/** Physical page index, 0-based. One authored page can spill onto several physical pages. */
	page: number;
	/** Position and size in PDF points, relative to the page's top-left corner. */
	x: number;
	y: number;
	width: number;
	height: number;
};

export type PageMap = {
	pages: { width: number; height: number }[];
	nodes: PageMapNode[];
};

const decode = (value: string) => {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
};

/**
 * Reads a semantic node key (see `semantic/node-keys.ts`), e.g.
 * `page-1/region-main/section-experience/section-items/item-<id>`, as the part of the resume it
 * renders. Only the header, sections and items are addressable; deeper keys (fields, icons,
 * template parts) return `undefined` because they live inside one of those blocks.
 */
export const parseResumeNodeKey = (key: string): PageMapTarget | undefined => {
	const segments = key.split("/");
	const last = segments.at(-1);
	if (!last) return;
	if (last === "header") return { kind: "header" };

	const sectionSegment = segments.find(
		(segment) => segment.startsWith("section-") && segment !== "section-items" && segment !== "section-heading",
	);
	if (!sectionSegment) return;
	// Templates that merge main and sidebar into one region qualify ids with their origin
	// (`main:experience`, see `semantic/tree.ts`); section ids never contain a colon otherwise.
	const sectionId = decode(sectionSegment.slice("section-".length)).replace(/^(main|sidebar):/, "");

	if (last === sectionSegment) return { kind: "section", sectionId };
	if (last.startsWith("item-") && segments.at(-2) === "section-items") {
		return { kind: "item", sectionId, itemId: decode(last.slice("item-".length)) };
	}
};

/** Source-location files that carry a page-map key: `rr-node:<semantic key>`. */
export const NODE_SOURCE_PREFIX = "rr-node:";

/**
 * Page-relative boxes for every tagged header, section and item, from Forme's layout info. A block
 * that breaks across pages has a box on each page it reaches.
 */
export const extractPageMap = (layout: LayoutInfo): PageMap => {
	const nodes: PageMapNode[] = [];

	const visit = (element: ElementInfo, page: number) => {
		const file = element.sourceLocation?.file;
		if (file?.startsWith(NODE_SOURCE_PREFIX)) {
			const key = file.slice(NODE_SOURCE_PREFIX.length);
			const target = parseResumeNodeKey(key);
			if (target)
				nodes.push({ ...target, key, page, x: element.x, y: element.y, width: element.width, height: element.height });
		}
		for (const child of element.children) visit(child, page);
	};

	layout.pages.forEach((page, index) => {
		for (const element of page.elements) visit(element, index);
	});

	return { pages: layout.pages.map((page) => ({ width: page.width, height: page.height })), nodes };
};
