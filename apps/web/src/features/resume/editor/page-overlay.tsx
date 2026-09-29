import type { PageMap, PageMapNode } from "@reactive-resume/pdf/page-map";
import type { MouseEvent } from "react";
import type { EditorSelection } from "./store";
import { Trans } from "@lingui/react/macro";
import { cn } from "@reactive-resume/utils/style";
import { isSameSelection, useEditorStore } from "./store";

type PageOverlayProps = {
	pageIndex: number;
	pageMap: PageMap | undefined;
	onSelect: (selection: EditorSelection) => void;
};

const toSelection = (node: PageMapNode): EditorSelection => {
	if (node.kind === "item") return { kind: "item", sectionId: node.sectionId, itemId: node.itemId };
	if (node.kind === "section") return { kind: "section", sectionId: node.sectionId };
	return { kind: "header" };
};

const readSelection = (element: HTMLElement): EditorSelection | null => {
	const { kind, sectionId, itemId } = element.dataset;
	if (kind === "header") return { kind: "header" };
	if (kind === "section" && sectionId) return { kind: "section", sectionId };
	if (kind === "item" && sectionId && itemId) return { kind: "item", sectionId, itemId };
	return null;
};

/**
 * Pointer layer over one rendered page: hovering a block tints it, clicking selects its entry, and the
 * selected block gets an accent outline with an "Editing" tag.
 */
export function PageOverlay({ pageIndex, pageMap, onSelect }: PageOverlayProps) {
	const selection = useEditorStore((state) => state.selection);
	const page = pageMap?.pages[pageIndex];
	if (!pageMap || !page || page.width <= 0 || page.height <= 0) return null;

	const nodes = pageMap.nodes.filter((node) => node.page === pageIndex);
	// A section with entries on this page is selected through its entries; only entry-less sections
	// (the summary, for example) are blocks of their own.
	const sectionsWithItems = new Set(nodes.flatMap((node) => (node.kind === "item" ? [node.sectionId] : [])));
	const blocks = nodes.filter((node) => node.kind !== "section" || !sectionsWithItems.has(node.sectionId));

	const handleClick = (event: MouseEvent<HTMLDivElement>) => {
		const target = (event.target as HTMLElement).closest<HTMLElement>("[data-kind]");
		const next = target ? readSelection(target) : null;
		if (next) onSelect(next);
	};

	return (
		// A pointer shortcut, hidden from assistive tech: the panel selects the same entries by keyboard.
		<div aria-hidden="true" data-slot="page-overlay" className="absolute inset-0" onClick={handleClick}>
			{blocks.map((node) => {
				const selected = isSameSelection(selection, toSelection(node));

				return (
					<div
						key={`${node.key}:${node.y}`}
						data-kind={node.kind}
						data-section-id={node.kind === "header" ? undefined : node.sectionId}
						data-item-id={node.kind === "item" ? node.itemId : undefined}
						className={cn(
							"absolute cursor-pointer rounded-[4px] outline-[1.5px] outline-solid transition-[background-color,outline-color] duration-quick hover:bg-[oklch(0.5_0.1_150/0.06)]",
							selected ? "outline-accent" : "outline-transparent",
						)}
						style={{
							left: `calc(${(node.x / page.width) * 100}% - 4px)`,
							top: `calc(${(node.y / page.height) * 100}% - 3px)`,
							width: `calc(${(node.width / page.width) * 100}% + 8px)`,
							height: `calc(${(node.height / page.height) * 100}% + 6px)`,
						}}
					>
						{selected && (
							<span className="absolute start-1 -top-2 rounded-[3px] bg-accent px-1 font-semibold text-[8px] text-on-accent leading-3">
								<Trans>Editing</Trans>
							</span>
						)}
					</div>
				);
			})}
		</div>
	);
}
