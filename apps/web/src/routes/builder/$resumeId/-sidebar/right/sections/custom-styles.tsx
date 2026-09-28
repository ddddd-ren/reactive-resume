import { lazy, Suspense } from "react";
import { SectionBase } from "../shared/section-base";

const StylesheetEditorShell = lazy(() => import("@/features/resume/stylesheet/editor"));

export function CustomStylesSectionBuilder() {
	return (
		<SectionBase type="styles" className="space-y-4">
			<Suspense
				fallback={<div role="status" className="h-72 animate-pulse rounded-md bg-sunken" aria-label="Loading editor" />}
			>
				<StylesheetEditorShell />
			</Suspense>
		</SectionBase>
	);
}
