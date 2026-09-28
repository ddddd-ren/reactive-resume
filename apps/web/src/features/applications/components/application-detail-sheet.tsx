import type { InterviewTimelineEntry } from "@reactive-resume/schema/applications/data";
import type { Application } from "../types";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Plural, Trans } from "@lingui/react/macro";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@reactive-resume/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@reactive-resume/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@reactive-resume/ui/components/dropdown-menu";
import { Icon } from "@reactive-resume/ui/components/icon";
import { Input } from "@reactive-resume/ui/components/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@reactive-resume/ui/components/sheet";
import { Textarea } from "@reactive-resume/ui/components/textarea";
import { toast } from "@reactive-resume/ui/components/toast";
import { useBreakpoint } from "@reactive-resume/ui/hooks/use-breakpoint";
import { cn } from "@reactive-resume/utils/style";
import { useConfirm } from "@/hooks/use-confirm";
import { orpc } from "@/libs/orpc/client";
import { stageSince } from "../next-step";
import { getClosedReasonLabel, getNextStage, getStageColor, getStageLabel, PIPELINE } from "../stages";
import { useApplicationActions, useInvalidateApplications } from "../use-application-actions";
import { Activity } from "./detail/activity";
import { CloseDialog } from "./detail/close-dialog";
import { Contacts } from "./detail/contacts";
import { NextStepCard } from "./detail/next-step-card";
import { SentDocuments } from "./detail/sent-documents";
import { InterviewDialog } from "./interview-dialog";

type DetailSheetProps = {
	application: Application | null;
	onOpenChange: (open: boolean) => void;
	onEditDetails: (application: Application) => void;
};

/**
 * One application, 480px from the right (full screen on phones): the stage stepper with Move to next, the next
 * step, what was sent, the key facts, notes and activity. Close application… takes a reason; Delete is in ⋯.
 */
export function ApplicationDetailSheet({ application, onOpenChange, onEditDetails }: DetailSheetProps) {
	const phone = useBreakpoint() === "mobile";
	const { data } = useQuery({
		...orpc.applications.getById.queryOptions({ input: { id: application?.id ?? "" } }),
		enabled: Boolean(application),
		...(application ? { placeholderData: application } : {}),
	});
	const current = data ?? application;

	return (
		<Sheet open={Boolean(application)} onOpenChange={onOpenChange}>
			<SheetContent
				side={phone ? "bottom" : "right"}
				closeLabel={t`Close`}
				className={cn("gap-0 overflow-y-auto", phone ? "h-svh" : "data-[side=right]:sm:max-w-[480px]")}
			>
				{current && (
					<Detail
						key={current.id}
						application={current}
						onEditDetails={onEditDetails}
						onDeleted={() => onOpenChange(false)}
					/>
				)}
			</SheetContent>
		</Sheet>
	);
}

type DetailProps = {
	application: Application;
	onEditDetails: (application: Application) => void;
	onDeleted: () => void;
};

function Detail({ application, onEditDetails, onDeleted }: DetailProps) {
	const { i18n } = useLingui();
	const confirm = useConfirm();
	const { moveTo, close, remove } = useApplicationActions();
	const [interview, setInterview] = useState<{ open: boolean; entry: InterviewTimelineEntry | null }>({
		open: false,
		entry: null,
	});
	const [closing, setClosing] = useState(false);
	const [postingOpen, setPostingOpen] = useState(false);

	const next = getNextStage(application.status);
	const reached = PIPELINE.indexOf(application.status);
	const since = Math.max(0, Math.floor((Date.now() - stageSince(application).getTime()) / 86_400_000));
	const closed = application.status === "closed";

	const onDelete = async () => {
		const confirmed = await confirm(t`Delete this application?`, {
			description: t`“${application.role} · ${application.company}” and its timeline are deleted permanently. This can't be undone.`,
			confirmText: t`Delete`,
		});
		if (!confirmed) return;
		remove.mutate({ id: application.id }, { onSuccess: onDeleted });
	};

	return (
		<>
			<header className="grid gap-4 border-line border-b px-5 pt-5 pb-4">
				<div className="flex items-start gap-3 pe-8">
					<span
						aria-hidden="true"
						className="grid size-10 shrink-0 place-items-center rounded-[9px] bg-sunken font-semibold text-ink-2"
					>
						{application.company.slice(0, 1).toUpperCase()}
					</span>
					<div className="grid min-w-0 flex-1 gap-0.5">
						<SheetTitle className="font-display font-medium text-[22px] leading-7">{application.role}</SheetTitle>
						<SheetDescription className="flex flex-wrap items-center gap-x-1.5 text-ink-2 text-sm">
							<span>{[application.company, application.location].filter(Boolean).join(" · ")}</span>
							{(application.sourceUrl || application.jobDescription) && (
								<>
									<span aria-hidden="true">·</span>
									{application.sourceUrl && !application.jobDescription ? (
										<a
											href={application.sourceUrl}
											target="_blank"
											rel="noreferrer"
											className="font-medium text-accent-text hover:underline"
										>
											<Trans>View posting</Trans>
										</a>
									) : (
										<button
											type="button"
											onClick={() => setPostingOpen(true)}
											className="font-medium text-accent-text hover:underline"
										>
											<Trans>View posting</Trans>
										</button>
									)}
								</>
							)}
						</SheetDescription>
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button size="icon-sm" variant="ghost" aria-label={t`Application options`} className="text-ink-3" />
							}
						>
							<Icon name="more_horiz" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => onEditDetails(application)}>
								<Icon name="edit" size={18} />
								<Trans>Edit details…</Trans>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem variant="destructive" onClick={onDelete}>
								<Icon name="delete" size={18} />
								<Trans>Delete…</Trans>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				<div className="grid gap-2.5">
					<ol aria-label={t`Stages`} className="grid grid-cols-5 gap-1.5">
						{PIPELINE.map((stage, index) => (
							<li key={stage}>
								<button
									type="button"
									aria-current={stage === application.status ? "step" : undefined}
									onClick={() => stage !== application.status && moveTo(application, stage)}
									className="grid w-full gap-1.5 text-start"
								>
									<span
										className="h-1.5 rounded-full transition-colors duration-standard"
										style={{
											background: !closed && index <= reached ? getStageColor(stage) : "var(--line)",
										}}
									/>
									<span
										className={cn(
											"truncate text-[11px]",
											stage === application.status ? "font-semibold text-ink" : "text-ink-3",
										)}
									>
										{getStageLabel(stage)}
									</span>
								</button>
							</li>
						))}
					</ol>
					<div className="flex flex-wrap items-center justify-between gap-2">
						<span className="flex items-center gap-1.5 text-sm">
							<span
								aria-hidden="true"
								className="size-2 rounded-full"
								style={{ background: getStageColor(application.status) }}
							/>
							<strong className="font-semibold">{getStageLabel(application.status)}</strong>
							<span className="text-ink-3">
								{closed && application.closedReason ? (
									<>· {getClosedReasonLabel(application.closedReason)}</>
								) : (
									<>
										· <Plural value={since} _0="since today" one="for # day" other="for # days" />
									</>
								)}
							</span>
						</span>
						{next && !closed && (
							<Button size="sm" variant="secondary" onClick={() => moveTo(application, next)}>
								<Trans>Move to {getStageLabel(next)}</Trans>
								<Icon name="arrow_forward" size={16} />
							</Button>
						)}
					</div>
				</div>
			</header>

			<div className="grid gap-6 px-5 py-5">
				<NextStepCard application={application} onScheduleInterview={(entry) => setInterview({ open: true, entry })} />
				<SentDocuments application={application} disabled={remove.isPending} />
				<Facts application={application} locale={i18n.locale} />
				<Tags application={application} />
				<Notes application={application} />
				<Activity application={application} onOpenInterview={(entry) => setInterview({ open: true, entry })} />
			</div>

			<footer className="sticky bottom-0 flex flex-wrap items-center gap-2 border-line border-t bg-surface px-5 py-3">
				{!closed ? (
					<>
						<Button variant="secondary" onClick={() => setClosing(true)}>
							<Trans>Close application…</Trans>
						</Button>
						<PrepareButton application={application} />
					</>
				) : (
					<Button variant="secondary" onClick={() => moveTo(application, "applied")}>
						<Trans>Reopen</Trans>
					</Button>
				)}
			</footer>

			<CloseDialog open={closing} onOpenChange={setClosing} onClose={(reason) => close(application, reason)} />
			<InterviewDialog
				application={application}
				interview={interview.entry}
				open={interview.open}
				onOpenChange={(open) => setInterview((currentValue) => ({ ...currentValue, open }))}
			/>
			<PostingDialog application={application} open={postingOpen} onOpenChange={setPostingOpen} />
		</>
	);
}

/** Salary, Source, Applied and Contact. Salary and source edit in place. */
function Facts({ application, locale }: { application: Application; locale: string }) {
	const invalidate = useInvalidateApplications();
	const update = useMutation({
		...orpc.applications.update.mutationOptions(),
		onSuccess: () => invalidate(application.id),
		onError: () => toast.add({ type: "error", description: t`Couldn't save.` }),
	});
	const applied = new Date(application.appliedAt).toLocaleDateString(locale, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});

	return (
		<dl className="grid grid-cols-2 gap-x-4 gap-y-3">
			<InlineFact
				label={t`Salary`}
				value={application.salary}
				onSave={(salary) => update.mutate({ id: application.id, salary })}
			/>
			<InlineFact
				label={t`Source`}
				value={application.source}
				onSave={(source) => update.mutate({ id: application.id, source })}
			/>
			<div className="grid gap-0.5">
				<dt className="font-semibold text-ink-3 text-xs uppercase">
					<Trans>Applied</Trans>
				</dt>
				<dd className="font-medium text-sm">{application.status === "saved" ? "—" : applied}</dd>
			</div>
			<div className="grid gap-0.5">
				<dt className="font-semibold text-ink-3 text-xs uppercase">
					<Trans>Contact</Trans>
				</dt>
				<dd className="min-w-0">
					<Contacts
						contacts={application.contacts}
						disabled={update.isPending}
						onChange={(contacts) => update.mutate({ id: application.id, contacts })}
					/>
				</dd>
			</div>
		</dl>
	);
}

type InlineFactProps = { label: string; value: string | null; onSave: (value: string | null) => void };

/** A fact that edits in place: click to type, Enter or leaving saves, Esc cancels. */
function InlineFact({ label, value, onSave }: InlineFactProps) {
	const id = useId();
	const [draft, setDraft] = useState<string | null>(null);

	const commit = () => {
		if (draft === null) return;
		const next = draft.trim() || null;
		if (next !== (value ?? null)) onSave(next);
		setDraft(null);
	};

	return (
		<div className="grid gap-0.5">
			<dt className="font-semibold text-ink-3 text-xs uppercase">
				<label htmlFor={id}>{label}</label>
			</dt>
			<dd>
				{draft === null ? (
					<button
						id={id}
						type="button"
						onClick={() => setDraft(value ?? "")}
						className="w-full truncate rounded-md text-start font-medium text-sm hover:bg-hover"
					>
						{value || "—"}
					</button>
				) : (
					<Input
						id={id}
						autoFocus
						value={draft}
						className="h-8"
						onChange={(event) => setDraft(event.target.value)}
						onBlur={commit}
						onKeyDown={(event) => {
							if (event.key === "Enter") commit();
							if (event.key === "Escape") {
								event.stopPropagation();
								setDraft(null);
							}
						}}
					/>
				)}
			</dd>
		</div>
	);
}

function Tags({ application }: { application: Application }) {
	const invalidate = useInvalidateApplications();
	const [tag, setTag] = useState("");
	const update = useMutation({
		...orpc.applications.update.mutationOptions(),
		onSuccess: () => invalidate(application.id),
		onError: () => toast.add({ type: "error", description: t`Couldn't save the tags.` }),
	});
	const save = (tags: string[]) => update.mutate({ id: application.id, tags });

	return (
		<section aria-labelledby="application-tags" className="grid gap-2">
			<h3 id="application-tags" className="font-semibold text-ink-3 text-xs uppercase">
				<Trans>Tags</Trans>
			</h3>
			<div className="flex flex-wrap items-center gap-1.5">
				{application.tags.map((value) => (
					<span key={value} className="flex h-7 items-center gap-1 rounded-md bg-sunken ps-2 text-xs">
						{value}
						<button
							type="button"
							aria-label={t`Remove ${value}`}
							onClick={() => save(application.tags.filter((item) => item !== value))}
							className="grid size-6 place-items-center rounded text-ink-3 hover:text-ink"
						>
							<Icon name="close" size={14} />
						</button>
					</span>
				))}
				<form
					onSubmit={(event) => {
						event.preventDefault();
						const value = tag.trim();
						if (!value || application.tags.includes(value)) return setTag("");
						save([...application.tags, value]);
						setTag("");
					}}
				>
					<Input
						aria-label={t`Add a tag`}
						placeholder={t`Add a tag`}
						value={tag}
						className="h-7 w-28 text-xs"
						onChange={(event) => setTag(event.target.value)}
					/>
				</form>
			</div>
		</section>
	);
}

// Notes save a moment after typing stops.
const NOTES_SAVE_DELAY_MS = 800;

function Notes({ application }: { application: Application }) {
	const id = useId();
	const invalidate = useInvalidateApplications();
	const [notes, setNotes] = useState(application.notes ?? "");
	const saved = useRef(application.notes ?? "");
	const { mutate } = useMutation({
		...orpc.applications.update.mutationOptions(),
		onSuccess: () => invalidate(application.id),
		onError: () => toast.add({ type: "error", description: t`Couldn't save the notes.` }),
	});

	useEffect(() => {
		if (notes === saved.current) return;
		const timeout = window.setTimeout(() => {
			saved.current = notes;
			mutate({ id: application.id, notes: notes.trim() ? notes : null });
		}, NOTES_SAVE_DELAY_MS);
		return () => window.clearTimeout(timeout);
	}, [notes, application.id, mutate]);

	// Closing the sheet mid-sentence still saves what was typed.
	const latest = useRef(notes);
	latest.current = notes;
	useEffect(
		() => () => {
			if (latest.current !== saved.current)
				mutate({ id: application.id, notes: latest.current.trim() ? latest.current : null });
		},
		[application.id, mutate],
	);

	return (
		<section className="grid gap-2">
			<label htmlFor={id} className="font-semibold text-ink-3 text-xs uppercase">
				<Trans>Notes</Trans>
			</label>
			<Textarea
				id={id}
				rows={3}
				value={notes}
				placeholder={t`Anything to remember about this job`}
				onChange={(event) => setNotes(event.target.value)}
			/>
		</section>
	);
}

type PostingDialogProps = { application: Application; open: boolean; onOpenChange: (open: boolean) => void };

/** The saved posting: its link, what it asks for, and its text. */
function PostingDialog({ application, open, onOpenChange }: PostingDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>
						{application.role} · {application.company}
					</DialogTitle>
					<DialogDescription>
						{application.sourceUrl ? (
							<a
								href={application.sourceUrl}
								target="_blank"
								rel="noreferrer"
								className="text-accent-text hover:underline"
							>
								{application.sourceUrl}
							</a>
						) : (
							<Trans>The posting saved with this application.</Trans>
						)}
					</DialogDescription>
				</DialogHeader>
				{application.requirements.length > 0 && (
					<section aria-labelledby="posting-requirements" className="grid gap-2">
						<h3 id="posting-requirements" className="font-semibold text-ink-3 text-xs uppercase">
							<Trans>What it asks for</Trans>
						</h3>
						<ul className="flex flex-wrap gap-1.5">
							{application.requirements.map((requirement) => (
								<li key={requirement} className="rounded-md bg-sunken px-2 py-1 text-xs">
									{requirement}
								</li>
							))}
						</ul>
					</section>
				)}
				{application.jobDescription && (
					<p className="whitespace-pre-wrap text-ink-2 text-sm leading-6">{application.jobDescription}</p>
				)}
			</DialogContent>
		</Dialog>
	);
}

/**
 * Prepare for next step: the assistant on what was sent (the resume, or the letter), with the posting and the
 * application's notes, and suggestions for the fit, a follow-up and the interview.
 */
function PrepareButton({ application }: { application: Application }) {
	const navigate = useNavigate();
	const target = application.resumeId
		? ({ kind: "resume", id: application.resumeId } as const)
		: application.coverLetterId
			? ({ kind: "letter", id: application.coverLetterId } as const)
			: null;

	return (
		<Button
			disabled={!target}
			title={target ? undefined : t`Link a resume or a letter first`}
			className="ms-auto bg-accent-soft text-accent-text hover:bg-accent-soft hover:brightness-95"
			onClick={() => {
				if (target?.kind === "resume")
					void navigate({
						to: "/builder/$resumeId",
						params: { resumeId: target.id },
						search: { assistant: "prepare" },
					});
				else if (target)
					void navigate({
						to: "/builder/letter/$coverLetterId",
						params: { coverLetterId: target.id },
						search: { assistant: "prepare" },
					});
			}}
		>
			<Icon name="auto_awesome" size={18} />
			<Trans>Prepare for next step</Trans>
		</Button>
	);
}
