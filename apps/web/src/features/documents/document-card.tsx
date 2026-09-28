import type { DocumentSummary } from "./filter";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ContextMenu, ContextMenuTrigger } from "@reactive-resume/ui/components/context-menu";
import { DropdownMenu, DropdownMenuTrigger } from "@reactive-resume/ui/components/dropdown-menu";
import { Icon } from "@reactive-resume/ui/components/icon";
import { IconButton } from "@reactive-resume/ui/components/icon-button";
import { cn } from "@reactive-resume/utils/style";
import { formatRelativeTime } from "@/libs/locale";
import { DocumentMenuContent, useDocumentActions } from "./document-actions";
import { daysLeftInTrash } from "./filter";
import { useNewDocumentsStore } from "./new-documents";
import { ResumeThumbnail } from "./resume-thumbnail";

export type DocumentItemProps = {
	document: DocumentSummary;
	onOpenLetter: (id: string) => void;
	onTags: (document: DocumentSummary) => void;
	onLink: (document: DocumentSummary) => void;
};

/** "Resume · Edited 2h ago", or the days left for a document in Trash. */
function useDocumentMeta(document: DocumentSummary) {
	const { i18n } = useLingui();
	const formatter = new Intl.RelativeTimeFormat(i18n.locale, { numeric: "auto" });
	const type = document.type === "resume" ? t`Resume` : t`Letter`;
	if (document.trashedAt) return t`${type} · ${daysLeftInTrash(document.trashedAt)} days left`;
	return t`${type} · Edited ${formatRelativeTime(document.updatedAt, formatter)}`;
}

/** Opens the document: resumes in the editor, letters in the letter editor. */
function OpenLink({
	document,
	onOpenLetter,
	className,
	children,
	label,
}: Pick<DocumentItemProps, "document" | "onOpenLetter"> & {
	className?: string;
	children: React.ReactNode;
	label?: string;
}) {
	const markOpened = useNewDocumentsStore((state) => state.markOpened);

	if (document.type === "resume") {
		return (
			<Link
				to="/builder/$resumeId"
				params={{ resumeId: document.id }}
				aria-label={label}
				className={className}
				onClick={() => markOpened(document.id)}
			>
				{children}
			</Link>
		);
	}

	return (
		<button
			type="button"
			aria-label={label}
			className={className}
			onClick={() => {
				markOpened(document.id);
				onOpenLetter(document.id);
			}}
		>
			{children}
		</button>
	);
}

/** Enter commits, Esc cancels, and leaving the field commits. */
function RenameInput({ document, onDone }: { document: DocumentSummary; onDone: () => void }) {
	const actions = useDocumentActions();
	const [value, setValue] = useState(document.name);
	const commit = () => {
		actions.rename(document, value);
		onDone();
	};

	return (
		<input
			// biome-ignore lint/a11y/noAutofocus: renaming starts from the menu, so focus goes straight to the field.
			autoFocus
			value={value}
			maxLength={100}
			aria-label={t`Name`}
			onChange={(event) => setValue(event.target.value)}
			onFocus={(event) => event.target.select()}
			onBlur={commit}
			onKeyDown={(event) => {
				if (event.key === "Enter") commit();
				if (event.key === "Escape") {
					event.stopPropagation();
					onDone();
				}
			}}
			className="h-7 w-full min-w-0 rounded-md border border-accent bg-raised px-1.5 font-semibold text-sm outline-none ring-3 ring-accent-soft"
		/>
	);
}

/** A letter's page, drawn from lines: letters have no thumbnail render. */
function LetterThumbnail({ name }: { name: string }) {
	return (
		<div aria-hidden="true" className="flex size-full flex-col gap-1.5 bg-white p-[14%] text-[0]">
			<span className="h-1.5 w-2/5 rounded-full bg-[#c9c9c9]" />
			<span className="mb-3 h-1 w-3/5 rounded-full bg-[#e2e2e2]" />
			<span className="h-1 w-1/3 rounded-full bg-[#d4d4d4]" />
			{Array.from({ length: 7 }, (_, index) => (
				<span key={index} className={cn("h-1 rounded-full bg-[#e6e6e6]", index % 3 === 2 ? "w-4/5" : "w-full")} />
			))}
			<span className="mt-2 h-1 w-1/4 rounded-full bg-[#d4d4d4]" />
			<span className="sr-only">{name}</span>
		</div>
	);
}

/** A 204px card: the real first page, title with ⋯, "Resume · Edited 2h ago" and the linked application. */
export function DocumentCard({ document, onOpenLetter, onTags, onLink }: DocumentItemProps) {
	const openDocument = useOpenDocument(onOpenLetter);
	const [renaming, setRenaming] = useState(false);
	const isNew = useNewDocumentsStore((state) => state.ids.includes(document.id)) && !document.trashedAt;
	const meta = useDocumentMeta(document);
	const menuProps = {
		document,
		onOpen: () => openDocument(document),
		onRename: () => setRenaming(true),
		onTags: () => onTags(document),
		onLink: () => onLink(document),
	};

	return (
		<ContextMenu>
			<ContextMenuTrigger
				render={<article className={cn("group/card grid gap-2", document.trashedAt && "opacity-70")} />}
			>
				<OpenLink
					document={document}
					onOpenLetter={onOpenLetter}
					label={document.name}
					className={cn(
						"relative block aspect-page overflow-hidden rounded-[6px] shadow-[0_0_0_1px_var(--line),var(--shadow-1)] transition-[transform,box-shadow] duration-quick hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_var(--line),var(--shadow-2)]",
						isNew && "shadow-[0_0_0_2px_var(--accent),var(--shadow-1)]",
						document.trashedAt && "pointer-events-none",
					)}
				>
					{document.type === "resume" ? (
						<ResumeThumbnail resume={document} />
					) : (
						<LetterThumbnail name={document.name} />
					)}
					<span className="absolute start-2 top-2 flex gap-1">
						{isNew && (
							<span className="rounded bg-accent px-1.5 font-semibold text-[11px] text-on-accent leading-[18px]">
								<Trans>New</Trans>
							</span>
						)}
						{document.isLocked && (
							<span className="grid size-[22px] place-items-center rounded bg-ink/80 text-bg" title={t`Locked`}>
								<Icon name="lock" size={14} />
								<span className="sr-only">
									<Trans>Locked</Trans>
								</span>
							</span>
						)}
					</span>
				</OpenLink>

				<div className="flex items-start gap-1">
					<div className="grid min-w-0 flex-1 gap-0.5">
						{renaming ? (
							<RenameInput document={document} onDone={() => setRenaming(false)} />
						) : (
							<h3 className="truncate font-semibold text-sm leading-5">{document.name}</h3>
						)}
						<span className="truncate text-ink-3 text-xs">{meta}</span>
						{document.application && (
							<span className="flex min-w-0 items-center gap-1 text-ink-2 text-xs">
								<Icon name="work" size={14} />
								<span className="truncate">{document.application.company}</span>
							</span>
						)}
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<IconButton
									icon="more_horiz"
									size="icon-sm"
									label={t`Options for ${document.name}`}
									className="text-ink-2"
								/>
							}
						/>
						<DocumentMenuContent {...menuProps} />
					</DropdownMenu>
				</div>
			</ContextMenuTrigger>
			<DocumentMenuContent {...menuProps} variant="context" />
		</ContextMenu>
	);
}

/** The list view's row: Name, Type, Application, Edited, ⋯. */
export function DocumentRow({ document, onOpenLetter, onTags, onLink }: DocumentItemProps) {
	const { i18n } = useLingui();
	const openDocument = useOpenDocument(onOpenLetter);
	const [renaming, setRenaming] = useState(false);
	const isNew = useNewDocumentsStore((state) => state.ids.includes(document.id)) && !document.trashedAt;
	const formatter = new Intl.RelativeTimeFormat(i18n.locale, { numeric: "auto" });
	const menuProps = {
		document,
		onOpen: () => openDocument(document),
		onRename: () => setRenaming(true),
		onTags: () => onTags(document),
		onLink: () => onLink(document),
	};

	return (
		<ContextMenu>
			<ContextMenuTrigger
				render={
					<tr
						className={cn(
							"border-line border-b transition-colors duration-quick hover:bg-hover",
							document.trashedAt && "opacity-70",
						)}
					/>
				}
			>
				<td className="py-3 ps-3 pe-2">
					<span className="flex min-w-0 items-center gap-2.5">
						<Icon name={document.type === "resume" ? "description" : "mail"} className="shrink-0 text-ink-2" />
						{renaming ? (
							<RenameInput document={document} onDone={() => setRenaming(false)} />
						) : (
							<OpenLink
								document={document}
								onOpenLetter={onOpenLetter}
								className="min-w-0 truncate text-start font-semibold text-sm hover:underline"
							>
								{document.name}
							</OpenLink>
						)}
						{isNew && (
							<span className="rounded bg-accent px-1.5 font-semibold text-[11px] text-on-accent leading-[18px]">
								<Trans>New</Trans>
							</span>
						)}
						{document.isLocked && <Icon name="lock" size={16} className="shrink-0 text-ink-3" />}
					</span>
				</td>
				<td className="px-2 text-ink-2 text-sm max-sm:hidden">
					{document.type === "resume" ? <Trans>Resume</Trans> : <Trans>Letter</Trans>}
				</td>
				<td className="px-2 text-ink-2 text-sm max-sm:hidden">{document.application?.company ?? "—"}</td>
				<td className="whitespace-nowrap px-2 text-ink-3 text-sm">
					{document.trashedAt ? (
						<Trans>{daysLeftInTrash(document.trashedAt)} days left</Trans>
					) : (
						formatRelativeTime(document.updatedAt, formatter)
					)}
				</td>
				<td className="w-10 pe-2 text-end">
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<IconButton
									icon="more_horiz"
									size="icon-sm"
									label={t`Options for ${document.name}`}
									className="text-ink-2"
								/>
							}
						/>
						<DocumentMenuContent {...menuProps} />
					</DropdownMenu>
				</td>
			</ContextMenuTrigger>
			<DocumentMenuContent {...menuProps} variant="context" />
		</ContextMenu>
	);
}

/** Open from a menu: resumes in the editor, letters in the letter editor. */
function useOpenDocument(onOpenLetter: (id: string) => void) {
	const navigate = useNavigate();
	return (document: DocumentSummary) => {
		useNewDocumentsStore.getState().markOpened(document.id);
		if (document.type === "letter") return onOpenLetter(document.id);
		void navigate({ to: "/builder/$resumeId", params: { resumeId: document.id } });
	};
}
