import type { LeftSidebarSection } from "@/libs/resume/section";
import { Trans } from "@lingui/react/macro";
import { LockSimpleIcon } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { match } from "ts-pattern";
import { Button } from "@reactive-resume/ui/components/button";
import { toast } from "@reactive-resume/ui/components/toast";
import { useCurrentResume, useIsResumeLocked, usePatchResume } from "@/features/resume/builder/draft";
import { SectionEditorList } from "@/features/resume/builder/section-recovery";
import { getResumeErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";
import { BasicsSectionBuilder } from "./sections/basics";
import { CustomSectionBuilder } from "./sections/custom";
import { PictureSectionBuilder } from "./sections/picture";
import { SummarySectionBuilder } from "./sections/summary";
import { ItemsSection } from "./shared/items-section";

function getSectionComponent(type: LeftSidebarSection) {
	return match(type)
		.with("picture", () => <PictureSectionBuilder />)
		.with("basics", () => <BasicsSectionBuilder />)
		.with("summary", () => <SummarySectionBuilder />)
		.with(
			"profiles",
			"experience",
			"education",
			"projects",
			"skills",
			"languages",
			"interests",
			"awards",
			"certifications",
			"publications",
			"volunteer",
			"references",
			(type) => <ItemsSection type={type} />,
		)
		.with("custom", () => <CustomSectionBuilder />)
		.exhaustive();
}

/** The Write mode panel: the section editors. It's rebuilt as the outline in M3. */
export function BuilderWritePanel() {
	const isLocked = useIsResumeLocked();

	return (
		<div className="@container space-y-4 p-4">
			{isLocked && <LockBanner />}

			<fieldset disabled={isLocked} className="m-0 min-w-0 space-y-4 border-0 p-0">
				<SectionEditorList renderSection={getSectionComponent} />
			</fieldset>
		</div>
	);
}

function LockBanner() {
	const resume = useCurrentResume();
	const patchResume = usePatchResume();
	const { mutate: setLocked, isPending } = useMutation(orpc.resume.setLocked.mutationOptions());

	const handleUnlock = () => {
		setLocked(
			{ id: resume.id, isLocked: false },
			{
				onSuccess: () => {
					patchResume((draft) => {
						draft.isLocked = false;
					});
				},
				onError: (error) => {
					toast.add({ type: "error", description: getResumeErrorMessage(error) });
				},
			},
		);
	};

	return (
		<div className="flex items-center gap-x-3 rounded-md border border-warn/40 bg-warn-soft p-3">
			<LockSimpleIcon className="size-5 shrink-0 text-warn-text" />
			<div className="min-w-0 flex-1">
				<p className="font-medium text-sm">
					<Trans>This resume is locked</Trans>
				</p>
				<p className="text-muted-foreground text-xs">
					<Trans>Editing is disabled until you unlock it.</Trans>
				</p>
			</div>
			<Button size="sm" variant="secondary" disabled={isPending} onClick={handleUnlock}>
				<Trans>Enable editing</Trans>
			</Button>
		</div>
	);
}
