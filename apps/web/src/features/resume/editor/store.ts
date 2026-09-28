import type { PageMap, PageMapTarget } from "@reactive-resume/pdf/page-map";
import type { Template } from "@reactive-resume/schema/templates";
import { create } from "zustand/react";

export const EDITOR_MODES = ["write", "design", "check"] as const;
export type EditorMode = (typeof EDITOR_MODES)[number];

/** The Share & export sheet's tabs; each entry point opens its own. */
export type ShareTab = "link" | "download" | "history";

/** What's selected in the editor: shared by the panel and the page, so each can outline the other. */
export type EditorSelection = PageMapTarget;

export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 1.5;
export const ZOOM_STEP = 0.1;

type EditorStore = {
	/** The mode just picked, shown while `?mode=` catches up (every navigation refetches the session first). */
	pendingMode: EditorMode | null;
	selection: EditorSelection | null;
	/** "fit" fits the page width to the canvas; otherwise an explicit scale between 60% and 150%. */
	zoom: number | "fit";
	/** Tablet only: the panel is a drawer over the page. */
	drawerOpen: boolean;
	/** Tablet in landscape: the panel sits beside the page instead of over it. */
	drawerPinned: boolean;
	/** The open tab of the Share & export sheet, or null while it's closed. */
	shareTab: ShareTab | null;
	/** History: the version shown on the page, read-only, instead of the current resume. */
	historyVersionId: string | null;
	assistantOpen: boolean;
	/** Write: sections open in the outline. */
	openSections: readonly string[];
	/** Write: sections added this visit that are still empty (a summary before any text), so they stay listed. */
	addedSections: readonly string[];
	/** Write: a new draft whose first field takes focus once it renders. */
	focusEntryId: string | null;
	/** Write: the Basics card. It collapses when an entry is picked on the page. */
	basicsOpen: boolean;
	/** Design: a template shown on the page while its thumbnail is hovered or focused, not yet applied. */
	previewTemplate: Template | null;
	/** The render on screen: physical pages and the page map. `version` counts renders, so Fit can wait for one. */
	rendered: { pageCount: number; pageMap: PageMap | undefined; version: number };
	select: (selection: EditorSelection | null) => void;
	setZoom: (zoom: number | "fit") => void;
	setDrawerOpen: (open: boolean) => void;
	setDrawerPinned: (pinned: boolean) => void;
	/** Opens the sheet on a tab, or closes it (which also returns the page to now). */
	setShareTab: (tab: ShareTab | null) => void;
	setHistoryVersion: (versionId: string | null) => void;
	setAssistantOpen: (open: boolean) => void;
	setSectionOpen: (sectionId: string, open: boolean) => void;
	markSectionAdded: (sectionId: string) => void;
	setFocusEntry: (entryId: string | null) => void;
	setBasicsOpen: (open: boolean) => void;
	setPreviewTemplate: (template: Template | null) => void;
	setRendered: (render: { pageCount: number; pageMap: PageMap | undefined }) => void;
	reset: () => void;
};

const clampZoom = (zoom: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(zoom * 100) / 100));

export const isSameSelection = (a: EditorSelection | null, b: EditorSelection | null) => {
	if (!a || !b) return a === b;
	if (a.kind !== b.kind) return false;
	if (a.kind === "header") return true;
	if (a.kind === "section" && b.kind === "section") return a.sectionId === b.sectionId;
	if (a.kind === "item" && b.kind === "item") return a.sectionId === b.sectionId && a.itemId === b.itemId;
	return false;
};

const initialState = {
	pendingMode: null,
	selection: null,
	zoom: "fit",
	drawerOpen: false,
	drawerPinned: false,
	shareTab: null,
	historyVersionId: null,
	assistantOpen: false,
	openSections: [],
	addedSections: [],
	focusEntryId: null,
	basicsOpen: true,
	previewTemplate: null,
	rendered: { pageCount: 0, pageMap: undefined, version: 0 },
} as const;

export const useEditorStore = create<EditorStore>()((set) => ({
	...initialState,
	select: (selection) => set({ selection }),
	setZoom: (zoom) => set({ zoom: zoom === "fit" ? "fit" : clampZoom(zoom) }),
	setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
	setDrawerPinned: (drawerPinned) => set({ drawerPinned }),
	setShareTab: (shareTab) => set(shareTab ? { shareTab } : { shareTab, historyVersionId: null }),
	setHistoryVersion: (historyVersionId) => set({ historyVersionId }),
	setAssistantOpen: (assistantOpen) => set({ assistantOpen }),
	setSectionOpen: (sectionId, open) =>
		set((state) => {
			const isOpen = state.openSections.includes(sectionId);
			if (isOpen === open) return state;
			return {
				openSections: open ? [...state.openSections, sectionId] : state.openSections.filter((id) => id !== sectionId),
			};
		}),
	markSectionAdded: (sectionId) =>
		set((state) =>
			state.addedSections.includes(sectionId) ? state : { addedSections: [...state.addedSections, sectionId] },
		),
	setFocusEntry: (focusEntryId) => set({ focusEntryId }),
	setBasicsOpen: (basicsOpen) => set({ basicsOpen }),
	setPreviewTemplate: (previewTemplate) => set({ previewTemplate }),
	setRendered: (render) => set((state) => ({ rendered: { ...render, version: state.rendered.version + 1 } })),
	reset: () => set(initialState),
}));
