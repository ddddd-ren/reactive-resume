import type { EditorSelection } from "@/features/resume/editor/store";
import type { LeftSidebarSection } from "@/libs/resume/section";
import {
	focusCustomSidebarSection,
	focusLeftSidebarSection,
	getScrollBehavior,
} from "@/features/resume/builder/section-recovery";
import { atsFindingItemElementId } from "@/libs/resume/ats";
import { leftSidebarSections } from "@/libs/resume/section";
import { useSectionStore } from "../-store/section";

const isBuiltInSection = (sectionId: string): sectionId is LeftSidebarSection =>
	(leftSidebarSections as readonly string[]).includes(sectionId);

const SECTION_ANCHOR = "sidebar-";
const ITEM_ANCHOR = atsFindingItemElementId("");

/**
 * The block an element in the Write panel edits, read from the section and entry anchors around it, so focusing
 * a field outlines its block on the page. Picture and Basics edit the header.
 */
export function selectionFromPanelElement(element: Element): EditorSelection | null {
	const sectionId = element.closest(`[id^="${SECTION_ANCHOR}"]`)?.id.slice(SECTION_ANCHOR.length);
	// "sidebar-hidden-…" rows restore hidden sections; they have no block on the page.
	if (!sectionId || sectionId.startsWith("hidden-")) return null;
	if (sectionId === "basics" || sectionId === "picture") return { kind: "header" };

	const itemId = element.closest(`[id^="${ITEM_ANCHOR}"]`)?.id.slice(ITEM_ANCHOR.length);
	return itemId ? { kind: "item", sectionId, itemId } : { kind: "section", sectionId };
}

/**
 * Brings the selected block's editor into view in the Write panel: expands its section and scrolls the
 * entry to the middle. The Write panel is rebuilt in M3; until then this targets the existing section list.
 */
export function revealSelectionInPanel(selection: EditorSelection) {
	const sectionKey: LeftSidebarSection =
		selection.kind === "header" ? "basics" : isBuiltInSection(selection.sectionId) ? selection.sectionId : "custom";
	useSectionStore.getState().setCollapsed(sectionKey, false);

	requestAnimationFrame(() => {
		if (selection.kind === "item") {
			const row = document.getElementById(atsFindingItemElementId(selection.itemId));
			if (row) {
				row.scrollIntoView({ block: "center", behavior: getScrollBehavior() });
				return;
			}
		}

		if (selection.kind === "header") focusLeftSidebarSection("basics");
		else if (isBuiltInSection(selection.sectionId)) focusLeftSidebarSection(selection.sectionId);
		else focusCustomSidebarSection(selection.sectionId);
	});
}
