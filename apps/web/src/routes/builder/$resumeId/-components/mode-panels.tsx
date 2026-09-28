import type { EditorMode } from "@/features/resume/editor/store";
import { OfflineBanner } from "@/features/resume/editor/save-status";
import { useEditorStore } from "@/features/resume/editor/store";
import { selectionFromPanelElement } from "@/features/resume/editor/write/reveal";
import { WritePanel } from "@/features/resume/editor/write/write-panel";
import { AtsCheckSectionBuilder } from "../-sidebar/right/sections/ats-check";
import { DesignPanel } from "./design-panel";

// Until Check mode is rebuilt (M7), it hosts the existing ATS check.
function CheckPanel() {
	return (
		<div className="@container p-4">
			<AtsCheckSectionBuilder />
		</div>
	);
}

function WriteMode() {
	const select = useEditorStore((state) => state.select);

	return (
		// Focus events bubble here from every field; the handler only reads where focus landed.
		// biome-ignore lint/a11y/noStaticElementInteractions: not an interactive element, see above.
		<div
			onFocus={(event) => {
				// Fields only: buttons (an entry's title, the chevrons) change the selection themselves.
				if (!event.target.matches("input, textarea, select, [contenteditable='true']")) return;
				const selection = selectionFromPanelElement(event.target);
				if (selection) select(selection);
			}}
		>
			<WritePanel />
		</div>
	);
}

export function ModePanel({ mode }: { mode: EditorMode }) {
	return (
		<>
			<OfflineBanner className="mx-4 mt-4 w-auto" />
			{mode === "design" ? <DesignPanel /> : mode === "check" ? <CheckPanel /> : <WriteMode />}
		</>
	);
}
