import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@reactive-resume/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@reactive-resume/ui/components/dropdown-menu";
import { Icon } from "@reactive-resume/ui/components/icon";
import { toast } from "@reactive-resume/ui/components/toast";
import { useDialogStore } from "@/dialogs/store";
import { useCurrentBuilderResumeSelector, useCurrentResume, usePatchResume } from "@/features/resume/builder/draft";
import { SaveStatus } from "@/features/resume/editor/save-status";
import { useResumeExport } from "@/features/resume/export/use-resume-export";
import { getResumeErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";
import { InformationSectionBuilder } from "../-sidebar/right/sections/information";
import { NotesSectionBuilder } from "../-sidebar/right/sections/notes";

type DocumentDialog = "notes" | "information" | null;

/**
 * The document name in the editor bar opens the document menu: rename, duplicate, lock, notes,
 * information, print and delete.
 */
export function DocumentMenu() {
	const name = useCurrentBuilderResumeSelector((resume) => resume.name);
	const isLocked = useCurrentBuilderResumeSelector((resume) => resume.isLocked);
	const [dialog, setDialog] = useState<DocumentDialog>(null);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<button
							type="button"
							aria-label={t`Document menu: ${name}`}
							className="-mx-1.5 flex min-w-0 max-w-[calc(100%+0.75rem)] flex-col items-start rounded-md px-1.5 py-0.5 text-start transition-colors duration-quick hover:bg-hover"
						>
							<span className="flex min-w-0 max-w-full items-center gap-1.5">
								<span className="truncate font-semibold text-ink text-sm leading-[18px]">{name}</span>
								{isLocked && <Icon name="lock" size={16} className="text-ink-3" />}
								<Icon name="expand_more" size={16} className="text-ink-3" />
							</span>
						</button>
					}
				/>
				<DocumentMenuItems onOpenDialog={setDialog} />
			</DropdownMenu>
			<SaveStatus />

			<Dialog open={dialog === "notes"} onOpenChange={(open) => !open && setDialog(null)}>
				<DialogContent className="sm:max-w-[560px]">
					<DialogHeader>
						<DialogTitle>
							<Trans>Notes</Trans>
						</DialogTitle>
					</DialogHeader>
					<NotesSectionBuilder />
				</DialogContent>
			</Dialog>

			<Dialog open={dialog === "information"} onOpenChange={(open) => !open && setDialog(null)}>
				<DialogContent className="sm:max-w-[560px]">
					<DialogHeader>
						<DialogTitle>
							<Trans>Information</Trans>
						</DialogTitle>
					</DialogHeader>
					<InformationSectionBuilder />
				</DialogContent>
			</Dialog>
		</>
	);
}

type DocumentMenuItemsProps = {
	onOpenDialog: (dialog: DocumentDialog) => void;
};

function DocumentMenuItems({ onOpenDialog }: DocumentMenuItemsProps) {
	const navigate = useNavigate();
	const { openDialog } = useDialogStore();
	const resume = useCurrentResume();
	const patchResume = usePatchResume();
	const { onPrint } = useResumeExport(resume);
	const { id, name, slug, tags, isLocked } = resume;

	const { mutate: trashResume } = useMutation(orpc.documents.trash.mutationOptions());
	const { mutate: restoreResume } = useMutation(orpc.documents.restore.mutationOptions());
	const { mutate: setLockedResume } = useMutation(orpc.resume.setLocked.mutationOptions());

	// Locking is reversible, so it doesn't ask for confirmation.
	const handleToggleLock = () => {
		setLockedResume(
			{ id, isLocked: !isLocked },
			{
				onSuccess: () => {
					patchResume((draft) => {
						draft.isLocked = !isLocked;
					});
				},
				onError: (error) => {
					toast.add({ type: "error", description: getResumeErrorMessage(error) });
				},
			},
		);
	};

	// Undoable, so it doesn't ask first: the resume waits in Trash for 30 days.
	const handleTrash = () => {
		trashResume(
			{ type: "resume", id },
			{
				onSuccess: () => {
					void navigate({ to: "/dashboard" });
					toast.add({
						description: t`“${name}” moved to Trash`,
						actionProps: {
							children: t`Undo`,
							onClick: () =>
								restoreResume(
									{ type: "resume", id },
									{ onError: (error) => toast.add({ type: "error", description: getResumeErrorMessage(error) }) },
								),
						},
					});
				},
				onError: (error) => {
					toast.add({ type: "error", description: getResumeErrorMessage(error) });
				},
			},
		);
	};

	return (
		<DropdownMenuContent align="start" className="w-60">
			<DropdownMenuItem disabled={isLocked} onClick={() => openDialog("resume.update", { id, name, slug, tags })}>
				<Icon name="edit" />
				<Trans>Rename…</Trans>
			</DropdownMenuItem>
			<DropdownMenuItem onClick={() => openDialog("resume.duplicate", { id, name, slug, tags })}>
				<Icon name="content_copy" />
				<Trans>Duplicate</Trans>
			</DropdownMenuItem>
			<DropdownMenuItem onClick={handleToggleLock}>
				<Icon name={isLocked ? "lock_open" : "lock"} />
				{isLocked ? <Trans>Unlock editing</Trans> : <Trans>Lock editing</Trans>}
			</DropdownMenuItem>
			<DropdownMenuSeparator />
			<DropdownMenuItem onClick={() => onOpenDialog("notes")}>
				<Icon name="sticky_note_2" />
				<Trans>Notes</Trans>
			</DropdownMenuItem>
			<DropdownMenuItem onClick={() => onOpenDialog("information")}>
				<Icon name="info" />
				<Trans>Information</Trans>
			</DropdownMenuItem>
			<DropdownMenuItem onClick={() => void onPrint()}>
				<Icon name="print" />
				<Trans>Print</Trans>
			</DropdownMenuItem>
			<DropdownMenuSeparator />
			<DropdownMenuItem variant="destructive" disabled={isLocked} onClick={handleTrash}>
				<Icon name="delete" />
				<Trans>Move to Trash</Trans>
			</DropdownMenuItem>
		</DropdownMenuContent>
	);
}
