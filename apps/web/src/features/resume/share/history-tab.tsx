import type { Resume } from "@/features/resume/builder/draft";
import type { VersionSummary } from "./format";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@reactive-resume/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@reactive-resume/ui/components/dropdown-menu";
import { Icon } from "@reactive-resume/ui/components/icon";
import { IconButton } from "@reactive-resume/ui/components/icon-button";
import { Input } from "@reactive-resume/ui/components/input";
import { toast } from "@reactive-resume/ui/components/toast";
import { cn } from "@reactive-resume/utils/style";
import { savePendingChanges, useCurrentResume, useResumeStore } from "@/features/resume/builder/draft";
import { useEditorStore } from "@/features/resume/editor/store";
import { useConfirm } from "@/hooks/use-confirm";
import { usePrompt } from "@/hooks/use-prompt";
import { getResumeErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";
import { formatVersionMoment, formatVersionTime, getVersionDetail, getVersionTitle } from "./format";

/**
 * History: name the current state, or pick any version to see it on the page, read-only, then restore it or
 * go back to now. Restoring saves the current state as "Before restore" first, so it can be undone.
 */
export function HistoryTab() {
	const resume = useCurrentResume();
	const queryClient = useQueryClient();
	const { i18n } = useLingui();
	const selectedId = useEditorStore((state) => state.historyVersionId);
	const setVersion = useEditorStore((state) => state.setHistoryVersion);
	const [name, setName] = useState("");

	const listKey = orpc.resume.listVersions.queryKey({ input: { resumeId: resume.id } });
	const { data: versions, isPending: loading } = useQuery(
		orpc.resume.listVersions.queryOptions({ input: { resumeId: resume.id } }),
	);
	const createVersion = useMutation(orpc.resume.createVersion.mutationOptions());
	const restoreVersion = useMutation(orpc.resume.restoreVersion.mutationOptions());

	const selected = versions?.find((version) => version.id === selectedId) ?? null;
	const when = (version: VersionSummary) => formatVersionTime(version.createdAt, i18n.locale);

	const save = async () => {
		const trimmed = name.trim();
		if (!trimmed) return;
		try {
			await savePendingChanges(resume.id);
			await createVersion.mutateAsync({ resumeId: resume.id, name: trimmed });
			setName("");
			void queryClient.invalidateQueries({ queryKey: listKey });
			toast.add({ description: t`Saved “${trimmed}”` });
		} catch (error) {
			toast.add({ type: "error", description: getResumeErrorMessage(error) });
		}
	};

	const restore = async (version: VersionSummary) => {
		try {
			await savePendingChanges(resume.id);
			const restored = await restoreVersion.mutateAsync({ resumeId: resume.id, versionId: version.id });
			useResumeStore.getState().replaceResumeFromServer(restored as Resume);
			queryClient.setQueryData(orpc.resume.getById.queryKey({ input: { id: resume.id } }), {
				...restored,
				applicationId: resume.applicationId ?? null,
			});
			setVersion(null);
			void queryClient.invalidateQueries({ queryKey: listKey });
			toast.add({
				description: t`Restored the version from ${formatVersionMoment(version.createdAt, i18n.locale)}. Your previous state is saved as “Before restore”.`,
			});
		} catch (error) {
			toast.add({ type: "error", description: getResumeErrorMessage(error) });
		}
	};

	return (
		<div className="grid gap-3.5">
			<form
				className="flex gap-1.5"
				onSubmit={(event) => {
					event.preventDefault();
					void save();
				}}
			>
				<Input
					value={name}
					maxLength={80}
					aria-label={t`Name this version`}
					placeholder={t`Name this version, e.g. Sent to Lumen`}
					onChange={(event) => setName(event.target.value)}
					className="h-9"
				/>
				<Button type="submit" variant="secondary" disabled={!name.trim() || createVersion.isPending}>
					<Trans>Save</Trans>
				</Button>
			</form>

			{selected && (
				<div role="status" className="grid gap-2.5 rounded-[10px] bg-ink p-3 text-[13px] text-bg">
					<span className="flex items-center gap-2 font-medium">
						<Icon name="history" size={18} />
						<Trans>
							Viewing {when(selected)} · {getVersionTitle(selected)} · read-only
						</Trans>
					</span>
					<span className="flex flex-wrap gap-2">
						<Button
							size="sm"
							disabled={resume.isLocked || restoreVersion.isPending}
							onClick={() => void restore(selected)}
						>
							<Trans>Restore this version</Trans>
						</Button>
						<Button
							size="sm"
							variant="ghost"
							className="text-bg underline underline-offset-[3px] hover:bg-transparent hover:text-bg"
							onClick={() => setVersion(null)}
						>
							<Trans>Back to now</Trans>
						</Button>
					</span>
				</div>
			)}

			<ol className="grid" aria-label={t`Versions`}>
				<TimelineItem
					title={t`Now`}
					detail={t`The resume as it is`}
					selected={!selected}
					current
					last={!versions?.length}
					onSelect={() => setVersion(null)}
				/>
				{versions?.map((version, index) => (
					<TimelineItem
						key={version.id}
						title={getVersionTitle(version)}
						detail={`${when(version)} · ${getVersionDetail(version)}`}
						named={version.kind === "named"}
						selected={version.id === selectedId}
						last={index === versions.length - 1}
						onSelect={() => setVersion(version.id)}
						menu={version.kind === "named" ? <NamedVersionMenu version={version} /> : null}
					/>
				))}
			</ol>

			{!loading && (versions?.length ?? 0) <= 1 && (
				<p className="text-[13px] text-ink-2 leading-[19px]">
					<Trans>Only one version so far. Every editing session adds one automatically.</Trans>
				</p>
			)}

			<p className="text-ink-3 text-xs leading-[17px]">
				<Trans>
					Autosaves are grouped by session and kept for 90 days. Named versions are kept until you delete them.
					Restoring saves the current state first.
				</Trans>
			</p>
		</div>
	);
}

type TimelineItemProps = {
	title: string;
	detail: string;
	selected: boolean;
	last: boolean;
	onSelect: () => void;
	current?: boolean;
	named?: boolean;
	menu?: React.ReactNode;
};

function TimelineItem({ title, detail, selected, last, onSelect, current, named, menu }: TimelineItemProps) {
	return (
		<li className="grid grid-cols-[20px_minmax(0,1fr)] gap-2.5">
			<span aria-hidden="true" className="flex flex-col items-center">
				<span
					className={cn(
						"mt-[15px] size-2.5 shrink-0 rounded-full shadow-[0_0_0_3px_var(--raised)]",
						current ? "bg-accent" : selected ? "bg-ink" : "bg-line-2",
					)}
				/>
				{!last && <span className="w-[1.5px] flex-1 bg-line" />}
			</span>
			<span
				className={cn(
					"group/version my-0.5 flex items-start rounded-[10px] border transition-colors duration-quick",
					selected ? "border-line-2 bg-sunken" : "border-transparent hover:bg-hover",
				)}
			>
				<button
					type="button"
					aria-pressed={selected}
					onClick={onSelect}
					className="flex min-w-0 flex-1 flex-col items-start gap-0.5 px-2.5 py-[9px] text-start"
				>
					<span className="flex max-w-full items-center gap-2">
						<span className="truncate font-semibold text-[13px]">{title}</span>
						{named && <Icon name="bookmark" size={14} className="text-accent-text" />}
					</span>
					<span className="text-ink-3 text-xs">{detail}</span>
				</button>
				{menu && <span className="p-1">{menu}</span>}
			</span>
		</li>
	);
}

/** Named versions are the user's own: they can be renamed or deleted. The rest expire on their own. */
function NamedVersionMenu({ version }: { version: VersionSummary }) {
	const resume = useCurrentResume();
	const queryClient = useQueryClient();
	const prompt = usePrompt();
	const confirm = useConfirm();
	const selectedId = useEditorStore((state) => state.historyVersionId);
	const setVersion = useEditorStore((state) => state.setHistoryVersion);
	const renameVersion = useMutation(orpc.resume.renameVersion.mutationOptions());
	const deleteVersion = useMutation(orpc.resume.deleteVersion.mutationOptions());
	const refresh = () =>
		queryClient.invalidateQueries({ queryKey: orpc.resume.listVersions.queryKey({ input: { resumeId: resume.id } }) });
	const title = getVersionTitle(version);

	const rename = async () => {
		const name = (await prompt(t`Rename version`, { defaultValue: version.name ?? "" }))?.trim();
		if (!name || name === version.name) return;
		try {
			await renameVersion.mutateAsync({ resumeId: resume.id, versionId: version.id, name });
			void refresh();
		} catch (error) {
			toast.add({ type: "error", description: getResumeErrorMessage(error) });
		}
	};

	const remove = async () => {
		const confirmed = await confirm(t`Delete “${title}”?`, {
			description: t`Named versions are kept until you delete them. This can't be undone.`,
			confirmText: t`Delete`,
		});
		if (!confirmed) return;
		try {
			await deleteVersion.mutateAsync({ resumeId: resume.id, versionId: version.id });
			if (selectedId === version.id) setVersion(null);
			void refresh();
			toast.add({ description: t`Deleted “${title}”` });
		} catch (error) {
			toast.add({ type: "error", description: getResumeErrorMessage(error) });
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<IconButton
						icon="more_horiz"
						label={t`Options for ${title}`}
						size="icon-sm"
						className="text-ink-2 opacity-0 focus-visible:opacity-100 group-hover/version:opacity-100 data-popup-open:opacity-100"
					/>
				}
			/>
			<DropdownMenuContent align="end" className="w-44">
				<DropdownMenuItem onClick={() => void rename()}>
					<Icon name="edit" />
					<Trans>Rename…</Trans>
				</DropdownMenuItem>
				<DropdownMenuItem variant="destructive" onClick={() => void remove()}>
					<Icon name="delete" />
					<Trans>Delete</Trans>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
