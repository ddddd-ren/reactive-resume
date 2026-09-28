import type { PageMapTarget } from "@reactive-resume/pdf/page-map";
import { create } from "zustand/react";

export const EDITOR_MODES = ["write", "design", "check"] as const;
export type EditorMode = (typeof EDITOR_MODES)[number];

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
	shareOpen: boolean;
	downloadOpen: boolean;
	assistantOpen: boolean;
	select: (selection: EditorSelection | null) => void;
	setZoom: (zoom: number | "fit") => void;
	setDrawerOpen: (open: boolean) => void;
	setDrawerPinned: (pinned: boolean) => void;
	setShareOpen: (open: boolean) => void;
	setDownloadOpen: (open: boolean) => void;
	setAssistantOpen: (open: boolean) => void;
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
	shareOpen: false,
	downloadOpen: false,
	assistantOpen: false,
} as const;

export const useEditorStore = create<EditorStore>()((set) => ({
	...initialState,
	select: (selection) => set({ selection }),
	setZoom: (zoom) => set({ zoom: zoom === "fit" ? "fit" : clampZoom(zoom) }),
	setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
	setDrawerPinned: (drawerPinned) => set({ drawerPinned }),
	setShareOpen: (shareOpen) => set({ shareOpen }),
	setDownloadOpen: (downloadOpen) => set({ downloadOpen }),
	setAssistantOpen: (assistantOpen) => set({ assistantOpen }),
	reset: () => set(initialState),
}));
