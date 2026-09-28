import type { Breakpoint } from "@reactive-resume/ui/hooks/use-breakpoint";
import type { ReactNode } from "react";
import { cn } from "@reactive-resume/utils/style";
import { useEditorStore } from "@/features/resume/editor/store";
import { AssistantPanel } from "./assistant-panel";
import { useLetterAssistantDocument, useResumeAssistantDocument } from "./document";

/**
 * Where the assistant sits (README §6.5): a third column at ≥1280 (the panel narrows to 300px), in place of the panel
 * at 1024–1279, a drawer over the page on tablets, and the whole screen on phones.
 */
export type AssistantPlace = "column" | "replace" | "drawer" | "screen";

export const assistantPlaceFor = (breakpoint: Breakpoint): AssistantPlace =>
	breakpoint === "wide"
		? "column"
		: breakpoint === "desktop"
			? "replace"
			: breakpoint === "tablet"
				? "drawer"
				: "screen";

/** The editor grid's columns at ≥1280: the panel narrows and the assistant's column opens, animated. */
export const columnsWithAssistant = (open: boolean) =>
	open ? "300px minmax(0,1fr) 400px" : "var(--editor-panel) minmax(0,1fr) 0px";

type AssistantOverlayProps = { place: "drawer" | "screen"; children: ReactNode };

/** Tablets: a 400px drawer from the right, under the bar. Phones: the whole screen. */
export function AssistantOverlay({ place, children }: AssistantOverlayProps) {
	return (
		<div
			className={cn(
				"fixed z-40 flex flex-col bg-surface",
				place === "drawer"
					? "end-0 top-(--editor-bar) bottom-0 w-[400px] max-w-full border-line border-s shadow-e3"
					: "inset-0 pb-[env(safe-area-inset-bottom)]",
			)}
		>
			{children}
		</div>
	);
}

/** Closing the panel hands focus back to the ✦ button in the bar, as closing any panel should. */
function closeAssistant() {
	useEditorStore.getState().setAssistantOpen(false);
	requestAnimationFrame(() => globalThis.document.querySelector<HTMLElement>("[data-assistant-toggle]")?.focus());
}

export function ResumeAssistant() {
	const document = useResumeAssistantDocument();
	return <AssistantPanel document={document} onClose={closeAssistant} />;
}

export function LetterAssistant() {
	const document = useLetterAssistantDocument();
	if (!document) return null;
	return <AssistantPanel document={document} onClose={closeAssistant} />;
}
