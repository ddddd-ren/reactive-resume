import type { EditorSelection } from "../store";
import { useEditorStore } from "../store";

/** The id of an entry's card in the Write panel, which the page and Check scroll to. */
export const entryElementId = (entryId: string) => `resume-item-${entryId}`;

/** Smooth scrolling unless the user asked for reduced motion. */
export const getScrollBehavior = (): ScrollBehavior =>
	window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";

const SECTION_ANCHOR = "sidebar-";
const ITEM_ANCHOR = entryElementId("");

/**
 * The block an element in the Write panel edits, read from the section and entry anchors around it, so focusing
 * a field outlines its block on the page. The Basics card (and its photo) edit the header.
 */
export function selectionFromPanelElement(element: Element): EditorSelection | null {
	const sectionId = element.closest(`[id^="${SECTION_ANCHOR}"]`)?.id.slice(SECTION_ANCHOR.length);
	if (!sectionId) return null;
	if (sectionId === "basics" || sectionId === "picture") return { kind: "header" };

	const itemId = element.closest(`[id^="${ITEM_ANCHOR}"]`)?.id.slice(ITEM_ANCHOR.length);
	return itemId ? { kind: "item", sectionId, itemId } : { kind: "section", sectionId };
}

/**
 * Page → panel: opens what was picked (the Basics card for the header; otherwise its section, with Basics
 * collapsed) and scrolls it 60px from the top of the panel, instantly with reduced motion.
 */
export function revealSelectionInPanel(selection: EditorSelection) {
	const editor = useEditorStore.getState();
	editor.select(selection);
	if (selection.kind === "header") editor.setBasicsOpen(true);
	else {
		editor.setBasicsOpen(false);
		editor.setSectionOpen(selection.sectionId, true);
	}

	requestAnimationFrame(() => {
		const section = document.getElementById(
			selection.kind === "header" ? "sidebar-basics" : `sidebar-${selection.sectionId}`,
		);
		const entry = selection.kind === "item" ? document.getElementById(entryElementId(selection.itemId)) : null;
		(entry ?? section)?.scrollIntoView({ block: "start", behavior: getScrollBehavior() });
	});
}
