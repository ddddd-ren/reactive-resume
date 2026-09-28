/**
 * Maps rendered PDF regions back to resume data, so the editor can outline the block a field
 * belongs to and select an entry when its line on the page is clicked.
 *
 * Templates tag the views that own a semantic node with `RESUME_NODE_PROP` (see
 * `templates/shared/primitives.tsx` and `templates/shared/sections.tsx`). React PDF keeps non-style
 * props on its layout nodes and hands the layout tree to `Document.onRender` as
 * `_INTERNAL__LAYOUT__DATA_`. That tree isn't a public API, so everything here reads it defensively.
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

type LayoutBox = { left?: number; top?: number; width?: number; height?: number };
type LayoutNode = {
	type?: string;
	box?: LayoutBox;
	props?: Record<string, unknown>;
	children?: LayoutNode[];
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

const finite = (value: number | undefined) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

/**
 * Walks React PDF's layout tree and returns page-relative boxes for every tagged header, section
 * and item. Child boxes in that tree are relative to their parent's box (React PDF translates by
 * each parent's `left`/`top` while painting), so offsets are summed on the way down.
 *
 * ponytail: CSS `transform` on a tagged node or its ancestors isn't applied; templates don't
 * transform blocks today. Apply the transform matrix here if one ever does.
 */
export const extractPageMap = (layout: unknown): PageMap => {
	const root = layout as LayoutNode | undefined;
	const pages: PageMap["pages"] = [];
	const nodes: PageMapNode[] = [];

	const visit = (node: LayoutNode, page: number, offsetX: number, offsetY: number) => {
		const box = node.box ?? {};
		const x = offsetX + finite(box.left);
		const y = offsetY + finite(box.top);
		const key = node.props?.[RESUME_NODE_PROP];

		if (typeof key === "string") {
			const target = parseResumeNodeKey(key);
			if (target) nodes.push({ ...target, key, page, x, y, width: finite(box.width), height: finite(box.height) });
		}

		for (const child of node.children ?? []) visit(child, page, x, y);
	};

	for (const pageNode of root?.children ?? []) {
		const page = pages.length;
		pages.push({ width: finite(pageNode.box?.width), height: finite(pageNode.box?.height) });
		for (const child of pageNode.children ?? []) visit(child, page, 0, 0);
	}

	return { pages, nodes };
};
