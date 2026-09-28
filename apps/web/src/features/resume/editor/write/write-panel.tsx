import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { useMemo } from "react";
import { Alert, AlertDescription } from "@reactive-resume/ui/components/alert";
import { Button } from "@reactive-resume/ui/components/button";
import { Icon } from "@reactive-resume/ui/components/icon";
import { toast } from "@reactive-resume/ui/components/toast";
import { useDialogStore } from "@/dialogs/store";
import {
	useCurrentBuilderResumeSelector,
	useCurrentResume,
	useIsResumeLocked,
	usePatchResume,
} from "@/features/resume/builder/draft";
import { getResumeErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";
import { useEditorStore } from "../store";
import { AddSectionMenu, StartSuggestions } from "./add-section";
import { BasicsCard } from "./basics-card";
import { getOutlineRows } from "./model";
import { Outline } from "./outline";

/**
 * Write: the Basics card, then the outline of sections in print order with their entries, then Add
 * section. Every field saves as you type; a locked resume shows the same panel read-only.
 */
export function WritePanel() {
	const locked = useIsResumeLocked();
	const locale = useCurrentBuilderResumeSelector((resume) => resume.data.metadata.page.locale);
	// The selector hook reads `undefined` as "no resume yet", so optional values need a fallback.
	const dateFormat = useCurrentBuilderResumeSelector((resume) => resume.data.metadata.page.dateFormat ?? null);
	const page = useMemo(() => ({ locale, dateFormat: dateFormat ?? undefined }), [locale, dateFormat]);
	const added = useEditorStore((state) => state.addedSections);
	const isEmpty = useCurrentBuilderResumeSelector((resume) => getOutlineRows(resume.data, new Set(added)).length === 0);
	const openDialog = useDialogStore((state) => state.openDialog);

	return (
		<div className="grid gap-4 p-4">
			{locked && <LockedNote />}

			<BasicsCard locked={locked} />

			<div>
				<p className="mb-1.5 flex items-baseline justify-between px-1 font-semibold text-[11px] text-ink-3 uppercase tracking-[0.08em]">
					<Trans>Sections · print order</Trans>
					{!locked && (
						<span className="font-normal normal-case tracking-normal">
							<Trans>drag · ⌥↑↓</Trans>
						</span>
					)}
				</p>

				{isEmpty && !locked ? (
					<StartSuggestions onImport={() => openDialog("document.new", undefined)} />
				) : (
					<Outline locked={locked} page={page} />
				)}

				{!locked && <AddSectionMenu />}
			</div>

			<p className="px-1 text-ink-3 text-xs leading-4">
				<Trans>Hidden sections keep their content but aren't printed or shared. Fields save as you type.</Trans>
			</p>
		</div>
	);
}

/** Locked resumes read as they print; Unlock is one click and reversible. */
function LockedNote() {
	const resume = useCurrentResume();
	const patchResume = usePatchResume();
	const { mutate: setLocked, isPending } = useMutation(orpc.resume.setLocked.mutationOptions());

	const unlock = () =>
		setLocked(
			{ id: resume.id, isLocked: false },
			{
				onSuccess: () =>
					patchResume((draft) => {
						draft.isLocked = false;
					}),
				onError: (error) => toast.add({ type: "error", description: getResumeErrorMessage(error) }),
			},
		);

	return (
		<Alert variant="info" className="items-center">
			<Icon name="lock" size={20} />
			<AlertDescription className="flex items-center justify-between gap-3">
				<span>
					<Trans>Locked. Unlock to edit.</Trans>
				</span>
				<Button size="sm" variant="secondary" loading={isPending} onClick={unlock} aria-label={t`Unlock editing`}>
					<Trans>Unlock</Trans>
				</Button>
			</AlertDescription>
		</Alert>
	);
}
