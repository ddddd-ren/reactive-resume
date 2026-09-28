import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { KeyboardEvent } from "react";
import type { Proposal, ProposalState } from "./proposals";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useState } from "react";
import { Button } from "@reactive-resume/ui/components/button";
import { toast } from "@reactive-resume/ui/components/toast";
import { cn } from "@reactive-resume/utils/style";
import { useIsResumeLocked, useResumeStore } from "@/features/resume/builder/draft";
import { useEditorStore } from "../store";
import { applyProposal, getProposalState } from "./proposals";

/** The visible text of a passage's HTML, for the card. */
const passageText = (html: string) =>
	html
		.replace(/<[^>]*>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&amp;/g, "&")
		.trim();

/** Applies proposals as one undo step; the toast's Undo takes them back, and they show as pending again. */
function acceptProposals(proposals: readonly Proposal[]) {
	useResumeStore.getState().updateResumeData(
		(draft) => {
			for (const proposal of proposals) applyProposal(draft, proposal);
		},
		{ newStep: true },
	);
	useEditorStore.getState().setProposalStatus(
		proposals.map((proposal) => proposal.id),
		"accepted",
	);
	toast.add({
		description: proposals.length === 1 ? t`Edit applied` : t`${proposals.length} edits applied`,
		actionProps: { children: t`Undo`, onClick: () => useResumeStore.getState().undo() },
	});
}

type ProposalListProps = {
	proposals: readonly Proposal[];
	data: ResumeData;
	/** "Suggest again" on an out-of-date proposal. */
	onSuggestAgain: () => void;
};

/**
 * A change set: "n proposed edits" with Accept all, then each edit numbered like its marker on the page, with
 * where it lands, the old text struck through, the new text and why. A accepts and R rejects the focused edit;
 * ↑ and ↓ move between edits.
 */
export function ProposalList({ proposals, data, onSuggestAgain }: ProposalListProps) {
	const setProposalStatus = useEditorStore((state) => state.setProposalStatus);
	const locked = useIsResumeLocked();
	const [focused, setFocused] = useState(0);
	const states = proposals.map((proposal) => getProposalState(data, proposal));
	const pending = proposals.filter((_, index) => states[index] === "pending");

	const onKeyDown = (event: KeyboardEvent<HTMLOListElement>) => {
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		const item = (event.target as HTMLElement).closest<HTMLElement>("[data-proposal-index]");
		const index = Number(item?.dataset.proposalIndex ?? focused);
		const proposal = proposals[index];

		const move = (next: number) => {
			event.preventDefault();
			const target = Math.min(proposals.length - 1, Math.max(0, next));
			setFocused(target);
			event.currentTarget.querySelector<HTMLElement>(`[data-proposal-index="${target}"]`)?.focus();
		};

		if (event.key === "ArrowDown") return move(index + 1);
		if (event.key === "ArrowUp") return move(index - 1);
		if (!proposal || states[index] !== "pending" || locked) return;
		if (event.key === "a" || event.key === "A") {
			event.preventDefault();
			acceptProposals([proposal]);
		}
		if (event.key === "r" || event.key === "R") {
			event.preventDefault();
			setProposalStatus([proposal.id], "rejected");
		}
	};

	return (
		<section aria-labelledby="proposals-heading" className="overflow-hidden rounded-xl border border-line">
			<header className="flex min-h-11 items-center justify-between gap-2 border-line border-b bg-bg px-3 py-2">
				<h3 id="proposals-heading" className="font-semibold text-sm">
					<Plural value={proposals.length} one="# proposed edit" other="# proposed edits" />
				</h3>
				{pending.length > 1 && (
					<Button size="sm" disabled={locked} onClick={() => acceptProposals(pending)}>
						<Trans>Accept all</Trans>
					</Button>
				)}
			</header>

			<ol aria-label={t`Proposed edits`} onKeyDown={onKeyDown} className="divide-y divide-line">
				{proposals.map((proposal, index) => (
					<ProposalItem
						key={proposal.id}
						proposal={proposal}
						number={index + 1}
						state={states[index] ?? "pending"}
						index={index}
						focusable={index === Math.min(focused, proposals.length - 1)}
						locked={locked}
						onFocus={() => setFocused(index)}
						onAccept={() => acceptProposals([proposal])}
						onReject={() => setProposalStatus([proposal.id], "rejected")}
						onSuggestAgain={onSuggestAgain}
					/>
				))}
			</ol>

			<p className="border-line border-t px-3 py-2 text-ink-3 text-xs">
				<Trans>A accepts and R rejects the focused edit. ↑ and ↓ move between edits.</Trans>
			</p>
		</section>
	);
}

type ProposalItemProps = {
	proposal: Proposal;
	number: number;
	state: ProposalState;
	index: number;
	focusable: boolean;
	locked: boolean;
	onFocus: () => void;
	onAccept: () => void;
	onReject: () => void;
	onSuggestAgain: () => void;
};

function ProposalItem(props: ProposalItemProps) {
	const { proposal, number, state, index, focusable, locked } = props;
	const labelId = `proposal-${proposal.id}-location`;

	return (
		<li
			data-proposal-index={index}
			// Roving focus: one edit in the tab order, ↑ and ↓ move between them.
			tabIndex={focusable ? 0 : -1}
			aria-labelledby={labelId}
			onFocus={props.onFocus}
			className="grid gap-2 p-3 outline-none focus-visible:bg-hover"
		>
			<div className="flex items-center gap-2">
				<span
					aria-hidden="true"
					className="grid size-5 shrink-0 place-items-center rounded-full bg-accent font-bold text-[11px] text-on-accent"
				>
					{number}
				</span>
				<span id={labelId} className="truncate font-mono text-[11px] text-ink-3 uppercase">
					<span className="sr-only">
						<Trans>Edit {number}:</Trans>{" "}
					</span>
					{proposal.location}
				</span>
			</div>

			<div className="grid gap-1.5 text-[13px] leading-[19px]">
				<del className="text-ink-3">{passageText(proposal.before)}</del>
				<ins className="rounded-[3px] bg-accent-soft px-1 py-0.5 no-underline">{passageText(proposal.after)}</ins>
				{proposal.why && <span className="text-ink-2 text-xs">{proposal.why}</span>}
			</div>

			{state === "pending" ? (
				<div className="flex gap-1.5">
					<Button size="sm" disabled={locked} onClick={props.onAccept}>
						<Trans>Accept</Trans>
					</Button>
					<Button size="sm" variant="secondary" onClick={props.onReject}>
						<Trans>Reject</Trans>
					</Button>
				</div>
			) : (
				<p
					className={cn(
						"flex items-center gap-2 font-medium text-xs",
						state === "accepted" && "text-accent-text",
						state === "rejected" && "text-ink-3",
						state === "stale" && "text-warn-text",
					)}
				>
					{state === "accepted" && <Trans>Applied</Trans>}
					{state === "rejected" && <Trans>Rejected</Trans>}
					{state === "stale" && (
						<>
							<Trans>Out of date: the text has changed since.</Trans>
							<button type="button" className="text-ink-2 underline underline-offset-2" onClick={props.onSuggestAgain}>
								<Trans>Suggest again</Trans>
							</button>
						</>
					)}
				</p>
			)}
		</li>
	);
}
