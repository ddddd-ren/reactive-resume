import type { FormeDocument, Style as FormeStyle } from "@formepdf/react";
import type { ReactElement, ReactNode } from "react";
import type { LoadedImage } from "./images";
import type { PageSize } from "./primitives";
import type { HostElement, HostNode } from "./reconciler";
import type { Rgb } from "./style";
import type { Style, StyleProp } from "./style-types";
import {
	Document as FormeDocumentElement,
	Fixed as FormeFixed,
	Image as FormeImage,
	Page as FormePage,
	Svg as FormeSvg,
	Text as FormeText,
	View as FormeView,
	serialize,
} from "@formepdf/react";
import { cloneElement, createElement, isValidElement } from "react";
import { NODE_SOURCE_PREFIX, RESUME_NODE_PROP } from "../page-map";
import { HOST } from "./primitives";
import { flattenAlpha, flattenStyle, toFormeStyle, toPoints, WHITE } from "./style";

// A4 in points, the size used for `vw`/`vh` until a page says otherwise.
const DEFAULT_PAGE = { width: 595.28, height: 841.89 };
/** Free-form pages start this tall; `renderResume` measures the content and renders again at its height. */
export const FREE_FORM_MEASURE_HEIGHT = 14_400;

type SourceLocation = { file: string; line: number; column: number };

type Edges = { top: number; right: number; bottom: number; left: number };

/** Source location of a repeated page background, so free-form measuring can skip it. */
export const FIXED_SOURCE = "rr-fixed";

type Context = {
	fontSize: number;
	pageWidth: number;
	pageHeight: number;
	inText: boolean;
	/** The pictures, loaded by `renderResume`, by source. */
	images: ReadonlyMap<string, LoadedImage>;
	/** Whether some ancestor lays its children out in a row. */
	insideRow: boolean;
	/** The parent's padding: Forme places absolute boxes inside it, react-pdf over it. */
	parentPadding: Edges;
	/** The opaque colour behind the element being converted (see `flattenAlpha`). */
	backdrop: Rgb;
	/** The page's margin while converting its direct children; undefined deeper down. */
	pageMargin: Edges | undefined;
	/** Applied to every text run: Forme hyphenates per run, by its language. */
	textDefaults: FormeStyle;
	warnings: Set<string>;
	sourceMap: WeakMap<object, SourceLocation>;
};

const PADDING_KEYS = [
	"padding",
	"paddingTop",
	"paddingRight",
	"paddingBottom",
	"paddingLeft",
	"paddingHorizontal",
	"paddingVertical",
] as const;

const pageDimensions = (size: PageSize | undefined) => {
	if (size === "LETTER") return { width: 612, height: 792 };
	if (size && typeof size === "object") return { width: size.width, height: size.height ?? FREE_FORM_MEASURE_HEIGHT };
	return DEFAULT_PAGE;
};

const pageSizeProp = (size: PageSize | undefined) => {
	if (size === "LETTER") return "Letter" as const;
	if (size && typeof size === "object") return pageDimensions(size);
	return "A4" as const;
};

/** The page's padding, which Forme takes as the page margin. */
function pageMargin(style: Style, context: Context) {
	const source = style as Record<string, unknown>;
	const length = (value: unknown) => {
		const points = toPoints(value, context);
		return typeof points === "number" ? points : 0;
	};
	const edges = { top: 0, right: 0, bottom: 0, left: 0 };
	const all = length(source.padding);
	edges.top = edges.right = edges.bottom = edges.left = all;
	if (source.paddingVertical !== undefined) edges.top = edges.bottom = length(source.paddingVertical);
	if (source.paddingHorizontal !== undefined) edges.left = edges.right = length(source.paddingHorizontal);
	if (source.paddingTop !== undefined) edges.top = length(source.paddingTop);
	if (source.paddingRight !== undefined) edges.right = length(source.paddingRight);
	if (source.paddingBottom !== undefined) edges.bottom = length(source.paddingBottom);
	if (source.paddingLeft !== undefined) edges.left = length(source.paddingLeft);
	return edges;
}

const convertStyle = (styleProp: unknown, context: Context, element: HostElement) => {
	const flat = flattenStyle(styleProp as StyleProp);
	const converted = toFormeStyle(flat, context);
	for (const property of converted.dropped)
		context.warnings.add(`${element.type.slice(3)}: ${property} isn't supported`);
	const flattened = flattenAlpha(converted.style, context.backdrop);
	return { ...converted, backdrop: flattened.backdrop, style: fromPaddingBox(flattened.style, context.parentPadding) };
};

type ParentStyle = { style: FormeStyle; backdrop: Rgb };

const childContext = (context: Context, parent: ParentStyle, inText = context.inText): Context => ({
	...context,
	pageMargin: undefined,
	fontSize: typeof parent.style.fontSize === "number" ? parent.style.fontSize : context.fontSize,
	backdrop: parent.backdrop,
	parentPadding: paddingEdges(parent.style),
	insideRow: context.insideRow || parent.style.flexDirection === "row" || parent.style.flexDirection === "row-reverse",
	inText,
});

const NO_EDGES: Edges = { top: 0, right: 0, bottom: 0, left: 0 };

/** A converted style's padding per edge, in points. */
function paddingEdges(style: FormeStyle): Edges {
	const source = style as Record<string, unknown>;
	const edges = { ...NO_EDGES };
	const all = source.padding;
	if (typeof all === "number") edges.top = edges.right = edges.bottom = edges.left = all;
	else if (typeof all === "string") {
		const [top = 0, right = top, bottom = top, left = right] = all.split(/\s+/).map(Number);
		Object.assign(edges, { top, right, bottom, left });
	}
	const number = (value: unknown) => (typeof value === "number" ? value : undefined);
	edges.top = number(source.paddingVertical) ?? edges.top;
	edges.bottom = number(source.paddingVertical) ?? edges.bottom;
	edges.left = number(source.paddingHorizontal) ?? edges.left;
	edges.right = number(source.paddingHorizontal) ?? edges.right;
	edges.top = number(source.paddingTop) ?? edges.top;
	edges.right = number(source.paddingRight) ?? edges.right;
	edges.bottom = number(source.paddingBottom) ?? edges.bottom;
	edges.left = number(source.paddingLeft) ?? edges.left;
	return edges;
}

/** Absolute offsets measured from the parent's padding box, as react-pdf measures them, for Forme's content box. */
function fromPaddingBox(style: FormeStyle, padding: Edges): FormeStyle {
	if (style.position !== "absolute") return style;
	const next: Record<string, unknown> = { ...style };
	for (const edge of ["top", "right", "bottom", "left"] as const)
		if (typeof next[edge] === "number") next[edge] = (next[edge] as number) - padding[edge];
	return next as FormeStyle;
}

const flowStyle = (props: Record<string, unknown>, style: FormeStyle): FormeStyle => {
	// Yoga places an absolute box against its parent; Forme, like CSS, against the nearest positioned ancestor.
	const next: FormeStyle = { position: "relative", ...style };
	if (props.wrap === false) next.wrap = false;
	if (props.break === true) next.breakBefore = true;
	if (typeof props.orphans === "number") next.minOrphanLines = props.orphans;
	if (typeof props.widows === "number") next.minWidowLines = props.widows;
	return next;
};

const imageSource = (src: unknown): string | undefined => {
	if (typeof src === "string") return src;
	if (src && typeof src === "object" && "uri" in src && typeof src.uri === "string") return src.uri;
	return undefined;
};

const number = (value: unknown, context: Context): number | undefined => {
	const points = toPoints(value, context);
	return typeof points === "number" ? points : undefined;
};

/**
 * Forme 0.25 mislays a column's `rowGap` where the column breaks across pages (up to a page with a box of height
 * -1.8e308), so a column's gap becomes a top margin on every child after the first, which lays out the same.
 */
function spreadRowGap(
	style: FormeStyle,
	children: ReactNode[],
	context: Context,
): { style: FormeStyle; children: ReactNode[] } {
	const direction = style.flexDirection ?? "column";
	const gap = style.rowGap ?? style.gap;
	if ((direction !== "column" && direction !== "column-reverse") || typeof gap !== "number" || gap === 0)
		return { style, children };
	const { rowGap: _rowGap, gap: _gap, ...rest } = style;
	const next: FormeStyle =
		style.gap !== undefined && style.columnGap === undefined ? { ...rest, columnGap: style.gap } : rest;
	let first = true;
	const result = children.map((child) => {
		if (!isValidElement<{ style?: FormeStyle }>(child)) return child;
		const childStyle = child.props.style;
		if (childStyle?.position === "absolute" || child.type === FormeFixed) return child;
		if (first) {
			first = false;
			return child;
		}
		const edge = direction === "column" ? "marginTop" : "marginBottom";
		const current = childStyle?.[edge];
		if (current === "auto") return child;
		const spaced = cloneElement(child, {
			style: { ...childStyle, [edge]: (typeof current === "number" ? current : 0) + gap },
		});
		const source = context.sourceMap.get(child);
		if (source) context.sourceMap.set(spaced, source);
		return spaced;
	});
	return { style: next, children: result };
}

function convertChildren(children: HostNode[], context: Context): ReactNode[] {
	return children.map((child, index) => convertNode(child, context, index));
}

function convertNode(node: HostNode, context: Context, key: number): ReactNode {
	if ("text" in node) return node.text;
	const { props } = node;

	switch (node.type) {
		case HOST.view: {
			const converted = convertStyle(props.style, context, node);
			const { style } = converted;
			if (converted.hidden) return null;
			const spread = spreadRowGap(style, convertChildren(node.children, childContext(context, converted)), context);
			const children = spread.children;
			const viewStyle = flowStyle(props, spread.style);
			// Forme 0.25 gives a row within a row a box at y -1.8e308 on the next page when the outer row splits, which
			// wrecks the rest of the document. Rows within rows are headings, list items and icon-label pairs, which are
			// better kept whole anyway.
			if (context.insideRow && (style.flexDirection === "row" || style.flexDirection === "row-reverse"))
				viewStyle.wrap = false;
			const bordered = insetBorder(viewStyle, children);
			const element = createElement(
				FormeView,
				{
					key,
					style: bordered.style,
					...(typeof props.bookmark === "string" ? { bookmark: props.bookmark } : {}),
				},
				...bordered.children,
			);
			tagNode(element, props, context);
			if (props.fixed !== true) return shrinkToFit(placePercentOffset(element, style, context), context);
			// A repeated view nested in a column stays with the column: its fragments already paint on each page.
			if (!context.pageMargin) return element;
			return createElement(
				FormeFixed,
				{ key, position: "header" },
				fixedOnPage(element, style, context, context.pageMargin),
			);
		}
		case HOST.text:
		case HOST.link: {
			const converted = convertStyle(props.style, context, node);
			const { style } = converted;
			if (converted.hidden) return null;
			const href = node.type === HOST.link && typeof props.src === "string" ? props.src : undefined;
			const hasBlockChild = node.children.some(
				(child) => child.type !== "#text" && child.type !== HOST.text && child.type !== HOST.link,
			);
			// A link around views (a whole entry, a picture) becomes a linked view.
			if (href && hasBlockChild && !context.inText) {
				const children = convertChildren(node.children, childContext(context, converted));
				const element = createElement(FormeView, { key, style: flowStyle(props, style), href }, ...children);
				tagNode(element, props, context);
				return element;
			}
			const children = convertChildren(node.children, childContext(context, converted, true));
			const element = createElement(
				FormeText,
				{ key, style: { ...context.textDefaults, ...flowStyle(props, style) }, ...(href ? { href } : {}) },
				...children,
			);
			tagNode(element, props, context);
			return element;
		}
		case HOST.image: {
			const image = context.images.get(imageSource(props.src) ?? "");
			if (!image) return null;
			const { style, hidden } = convertStyle(props.style, context, node);
			if (hidden) return null;
			return placePercentOffset(fitImage(image, style, key), style, context);
		}
		case HOST.svg: {
			const { style, hidden } = convertStyle(props.style, context, node);
			if (hidden) return null;
			const width = number(props.width, context) ?? (typeof style.width === "number" ? style.width : 12);
			const height = number(props.height, context) ?? (typeof style.height === "number" ? style.height : width);
			const opacity = typeof props.opacity === "number" ? props.opacity : undefined;
			return createElement(FormeSvg, {
				key,
				width,
				height,
				content: String(props.content ?? ""),
				style: opacity === undefined ? style : { ...style, opacity },
				...(typeof props.viewBox === "string" ? { viewBox: props.viewBox } : {}),
			});
		}
		default:
			context.warnings.add(`Unknown element ${node.type}`);
			return null;
	}
}

/**
 * Forme 0.25 strokes a border centred on the box's edge, so half of it lands outside the box and a gap of the other
 * half shows inside. For a thick uniform border on a box of known size, the border's room becomes padding and the
 * border is drawn by an overlay inset by half its width, which puts the paint where CSS puts it. Thinner borders
 * are left alone: their error is under half a point.
 */
function insetBorder(style: FormeStyle, children: ReactNode[]): { style: FormeStyle; children: ReactNode[] } {
	const { borderWidth, borderColor, width, height } = style;
	const perSide = ["borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth"].some(
		(key) => (style as Record<string, unknown>)[key] !== undefined,
	);
	if (
		typeof borderWidth !== "number" ||
		borderWidth < 1.5 ||
		perSide ||
		typeof borderColor !== "string" ||
		typeof width !== "number" ||
		typeof height !== "number"
	)
		return { style, children };

	const padding = paddingEdges(style);
	const {
		borderWidth: _borderWidth,
		borderColor: _borderColor,
		padding: _padding,
		paddingHorizontal: _paddingHorizontal,
		paddingVertical: _paddingVertical,
		...rest
	} = style;
	const radius = typeof style.borderRadius === "number" ? style.borderRadius : 0;
	const half = borderWidth / 2;
	const overlay = createElement(FormeView, {
		key: "border",
		style: {
			position: "absolute",
			// Forme places absolute boxes against the content box, inside the padding.
			left: half - padding.left - borderWidth,
			top: half - padding.top - borderWidth,
			width: width - borderWidth,
			height: height - borderWidth,
			borderWidth,
			borderColor,
			...(radius > 0 ? { borderRadius: Math.max(0, radius - half) } : {}),
		},
	});
	return {
		style: {
			...rest,
			paddingTop: padding.top + borderWidth,
			paddingRight: padding.right + borderWidth,
			paddingBottom: padding.bottom + borderWidth,
			paddingLeft: padding.left + borderWidth,
		},
		children: [...children, overlay],
	};
}

/**
 * A picture in its box, as CSS `object-fit` places it: stretched (`fill`), whole and centred (`contain`,
 * `scale-down`), or filling the box and cropped (`cover`, `none`). The box carries the style; the bitmap sits inside.
 */
function fitImage(image: LoadedImage, style: FormeStyle, key: number): ReactElement {
	const { objectFit, aspectRatio, ...boxStyle } = style as FormeStyle & { objectFit?: string; aspectRatio?: number };
	let width = typeof boxStyle.width === "number" ? boxStyle.width : undefined;
	let height = typeof boxStyle.height === "number" ? boxStyle.height : undefined;
	const ratio = typeof aspectRatio === "number" && aspectRatio > 0 ? aspectRatio : image.width / image.height;
	if (width === undefined && height !== undefined) width = height * ratio;
	if (height === undefined && width !== undefined) height = width / ratio;
	if (width === undefined || height === undefined || objectFit === undefined || objectFit === "fill")
		return createElement(FormeImage, {
			key,
			src: image.src,
			style: boxStyle,
			...(width === undefined ? {} : { width }),
			...(height === undefined ? {} : { height }),
		});

	const scaleX = width / image.width;
	const scaleY = height / image.height;
	const scale =
		objectFit === "cover"
			? Math.max(scaleX, scaleY)
			: objectFit === "none"
				? 1
				: objectFit === "scale-down"
					? Math.min(1, scaleX, scaleY)
					: Math.min(scaleX, scaleY);
	const drawnWidth = image.width * scale;
	const drawnHeight = image.height * scale;
	return createElement(
		FormeView,
		{ key, style: { position: "relative", ...boxStyle, width, height, overflow: "hidden" } },
		createElement(
			FormeView,
			{ style: { position: "absolute", left: (width - drawnWidth) / 2, top: (height - drawnHeight) / 2 } },
			createElement(FormeImage, { src: image.src, width: drawnWidth, height: drawnHeight }),
		),
	);
}

/**
 * Forme takes absolute offsets in points only. A percentage one (a picture centred with `left: "50%"`) becomes a
 * full-width absolute row where a spacer of that percentage of the parent's width comes first.
 */
function placePercentOffset(element: ReactElement, style: FormeStyle, context: Context): ReactElement {
	const percent = (value: unknown) => typeof value === "string" && value.endsWith("%");
	const fromLeft = percent(style.left);
	const fromRight = percent(style.right);
	if (!fromLeft && !fromRight) return element;
	const { top, bottom, left, right, ...rest } = flowStyleOf(element);
	if (style.position !== "absolute" || (fromLeft && fromRight)) {
		context.warnings.add("view: percentage offsets are only supported on one side of an absolute box");
		return cloneElement(element as ReactElement<{ style: FormeStyle }>, { style: rest });
	}
	const place: FormeStyle = {
		position: "absolute",
		flexDirection: fromLeft ? "row" : "row-reverse",
		alignItems: "flex-start",
		left: 0,
		right: 0,
		...(top === undefined ? {} : { top }),
		...(bottom === undefined ? {} : { bottom }),
	};
	const content = cloneElement(element as ReactElement<{ style: FormeStyle }>, {
		key: "content",
		style: { ...rest, position: "relative", flexShrink: 0 },
	});
	const source = context.sourceMap.get(element);
	if (source) context.sourceMap.set(content, source);
	return createElement(
		FormeView,
		{ key: element.key, style: place },
		createElement(FormeView, { key: "offset", style: { width: String(fromLeft ? left : right), flexShrink: 0 } }),
		content,
	);
}

/**
 * Forme 0.25 gives an absolute box without a width zero width, where CSS and Yoga shrink it to its content. Such a
 * box goes in a transparent absolute row that reaches the far edge, and sizes to its content inside it.
 */
function shrinkToFit(element: ReactElement, context: Context): ReactElement {
	const style = flowStyleOf(element);
	if (style.position !== "absolute" || style.width !== undefined) return element;
	const fromLeft = style.left !== undefined;
	const fromRight = style.right !== undefined;
	if (fromLeft === fromRight) return element;
	const { top, bottom, left, right, ...rest } = flowStyleOf(element);
	const place: FormeStyle = {
		position: "absolute",
		flexDirection: "row",
		alignItems: "flex-start",
		justifyContent: fromLeft ? "flex-start" : "flex-end",
		...(top === undefined ? {} : { top }),
		...(bottom === undefined ? {} : { bottom }),
		left: fromLeft ? (left ?? 0) : 0,
		right: fromRight ? (right ?? 0) : 0,
	};
	const content = cloneElement(element as ReactElement<{ style: FormeStyle }>, {
		key: "content",
		style: { ...rest, position: "relative" },
	});
	const source = context.sourceMap.get(element);
	if (source) context.sourceMap.set(content, source);
	return createElement(FormeView, { key: element.key, style: place }, content);
}

const flowStyleOf = (element: ReactElement) => (element.props as { style: FormeStyle }).style;

/**
 * A view react-pdf repeats on every page. Forme repeats header bands, which take room from the page; an absolute view
 * takes none, so it sits in an empty band, placed against the page as react-pdf placed it.
 */
function fixedOnPage(element: ReactElement, style: FormeStyle, context: Context, margin: Edges): ReactNode {
	if (style.position !== "absolute") return element;
	const edge = (value: unknown) => (typeof value === "number" ? value : undefined);
	const length = (value: unknown, whole: number) =>
		typeof value === "string" && value.endsWith("%") ? (Number.parseFloat(value) / 100) * whole : edge(value);
	const { top, right, bottom, left, width, height, ...rest } = style;
	const w = length(width, context.pageWidth);
	const h = length(height, context.pageHeight);
	const x =
		edge(left) ?? (w !== undefined && edge(right) !== undefined ? context.pageWidth - (edge(right) ?? 0) - w : 0);
	const y =
		edge(top) ?? (h !== undefined && edge(bottom) !== undefined ? context.pageHeight - (edge(bottom) ?? 0) - h : 0);
	const boxHeight = h ?? context.pageHeight - y - (edge(bottom) ?? 0);
	// Forme 0.25 cuts a repeated box taller than the page's content area short, so a tall one is drawn in bands.
	const band = Math.max(1, context.pageHeight - margin.top - margin.bottom);
	const bands: ReactElement[] = [];
	for (let offset = 0; offset < boxHeight; offset += band) {
		const placed: FormeStyle = {
			...rest,
			position: "absolute",
			left: x - margin.left,
			top: y + offset - margin.top,
			width: w ?? context.pageWidth - x - (edge(right) ?? 0),
			height: Math.min(band, boxHeight - offset),
		};
		const fixed = cloneElement(element as ReactElement<{ style: FormeStyle }>, { key: offset, style: placed });
		context.sourceMap.set(fixed, { file: FIXED_SOURCE, line: 1, column: 1 });
		bands.push(fixed);
	}
	return bands;
}

/** Remembers which Forme element draws a tagged block, so its box can be found in the layout afterwards. */
function tagNode(element: object, props: Record<string, unknown>, context: Context) {
	const key = props[RESUME_NODE_PROP];
	if (typeof key === "string" && key.length > 0)
		context.sourceMap.set(element, { file: `${NODE_SOURCE_PREFIX}${key}`, line: 1, column: 1 });
}

function convertPage(page: HostElement, context: Context, key: number): ReactNode {
	const size = page.props.size as PageSize | undefined;
	const dimensions = pageDimensions(size);
	const pageContext: Context = { ...context, pageWidth: dimensions.width, pageHeight: dimensions.height };
	const flat = flattenStyle(page.props.style as StyleProp);
	const margin = pageMargin(flat, pageContext);
	const rest = Object.fromEntries(
		Object.entries(flat).filter(([property]) => !(PADDING_KEYS as readonly string[]).includes(property)),
	) as Style;
	const converted = flattenAlpha(toFormeStyle(rest, pageContext).style, WHITE);
	const spread = spreadRowGap(
		converted.style,
		convertChildren(page.children, { ...childContext(pageContext, converted), pageMargin: margin }),
		pageContext,
	);
	converted.style = spread.style;
	const { children } = spread;
	const fixed = children.filter((child) => isValidElement(child) && child.type === FormeFixed);
	if (fixed.length === 0)
		return createElement(FormePage, { key, size: pageSizeProp(size), margin, style: converted.style }, ...children);

	// Forme lays repeated bands out with the page's other children, so on a row page they'd take a column's place.
	// The page's own layout moves to a box around the flowing content, and the bands stay outside it.
	const pageStyle: Record<string, unknown> = {};
	const layoutStyle: Record<string, unknown> = { flexGrow: 1 };
	for (const [property, value] of Object.entries(converted.style))
		(PAGE_LAYOUT_KEYS.has(property) ? layoutStyle : pageStyle)[property] = value;
	return createElement(
		FormePage,
		{ key, size: pageSizeProp(size), margin, style: pageStyle as FormeStyle },
		...fixed,
		createElement(
			FormeView,
			{ key: "content", style: layoutStyle as FormeStyle },
			...children.filter((child) => !fixed.includes(child)),
		),
	);
}

const PAGE_LAYOUT_KEYS = new Set([
	"display",
	"flexDirection",
	"flexWrap",
	"justifyContent",
	"alignItems",
	"alignContent",
	"gap",
	"rowGap",
	"columnGap",
	"gridTemplateColumns",
	"gridTemplateRows",
]);

export type ConvertedDocument = { document: FormeDocument; warnings: string[] };

/**
 * Host tree → Forme document JSON. Tagged blocks get a source location Forme carries into its layout info, which
 * is how the page map finds them.
 */
export function toFormeDocument(
	tree: HostNode[],
	images: ReadonlyMap<string, LoadedImage> = new Map(),
): ConvertedDocument {
	const root = tree.find((node): node is HostElement => node.type === HOST.document);
	if (!root) throw new Error("The resume didn't render a <Document>.");

	const context: Context = {
		fontSize: 12,
		pageWidth: DEFAULT_PAGE.width,
		pageHeight: DEFAULT_PAGE.height,
		inText: false,
		parentPadding: NO_EDGES,
		insideRow: false,
		images,
		backdrop: WHITE,
		pageMargin: undefined,
		textDefaults: {
			hyphens: root.props.hyphenation === "auto" ? "auto" : "manual",
			...(typeof root.props.language === "string" ? { lang: root.props.language } : {}),
		},
		warnings: new Set(),
		sourceMap: new WeakMap(),
	};

	const { props } = root;
	const pages = root.children
		.filter((child): child is HostElement => child.type === HOST.page)
		.map((page, index) => convertPage(page, context, index));
	const metadata: Record<string, string> = {};
	for (const [from, to] of [
		["title", "title"],
		["author", "author"],
		["subject", "subject"],
		["creator", "creator"],
		["language", "lang"],
	] as const) {
		const value = props[from];
		if (typeof value === "string" && value.length > 0) metadata[to] = value;
	}
	const element = createElement(FormeDocumentElement, metadata, ...pages);

	// Forme's serializer looks tagged elements up here (its dev server fills it for JSX source locations).
	const scope = globalThis as { __formeSourceMap?: WeakMap<object, SourceLocation> };
	const previous = scope.__formeSourceMap;
	scope.__formeSourceMap = context.sourceMap;
	try {
		return { document: serialize(element), warnings: [...context.warnings] };
	} finally {
		if (previous) scope.__formeSourceMap = previous;
		else delete scope.__formeSourceMap;
	}
}
