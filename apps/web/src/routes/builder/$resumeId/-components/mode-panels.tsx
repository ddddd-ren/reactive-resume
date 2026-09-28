import type { EditorMode } from "@/features/resume/editor/store";
import { Fragment } from "react";
import { Separator } from "@reactive-resume/ui/components/separator";
import { OfflineBanner } from "@/features/resume/editor/save-status";
import { useEditorStore } from "@/features/resume/editor/store";
import { selectionFromPanelElement } from "@/features/resume/editor/write/reveal";
import { WritePanel } from "@/features/resume/editor/write/write-panel";
import { AtsCheckSectionBuilder } from "../-sidebar/right/sections/ats-check";
import { CustomStylesSectionBuilder } from "../-sidebar/right/sections/custom-styles";
import { DesignSectionBuilder } from "../-sidebar/right/sections/design";
import { LayoutSectionBuilder } from "../-sidebar/right/sections/layout";
import { PageSectionBuilder } from "../-sidebar/right/sections/page";
import { TemplateSectionBuilder } from "../-sidebar/right/sections/template";
import { TypographySectionBuilder } from "../-sidebar/right/sections/typography";
import { BareSectionChrome } from "../-sidebar/right/shared/section-base";

// Until the Design mode is rebuilt (M4), it hosts the existing design sections in this order.
const DESIGN_SECTIONS = [
	TemplateSectionBuilder,
	LayoutSectionBuilder,
	TypographySectionBuilder,
	DesignSectionBuilder,
	PageSectionBuilder,
	CustomStylesSectionBuilder,
] as const;

function DesignPanel() {
	return (
		<div className="@container space-y-4 p-4">
			{DESIGN_SECTIONS.map((Section, index) => (
				<Fragment key={Section.name}>
					{index > 0 && <Separator />}
					<Section />
				</Fragment>
			))}
		</div>
	);
}

// Until Check mode is rebuilt (M7), it hosts the existing ATS check.
function CheckPanel() {
	return (
		<div className="@container p-4">
			<BareSectionChrome>
				<AtsCheckSectionBuilder />
			</BareSectionChrome>
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
