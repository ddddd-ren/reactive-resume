import type { Proposal } from "@reactive-resume/resume/proposals";
import type { ResumeData } from "@reactive-resume/schema/resume/data";
import { produce } from "immer";
import { getProposalState, readTarget, splitBlock, splitBlocks, writeTarget } from "@reactive-resume/resume/proposals";

// Colours of the page marks (README §5.9), as the PDF needs them: old text struck through in grey, new text on
// a pale accent highlight.
const OLD_TEXT_COLOR = "#7d7b73";
const NEW_TEXT_BACKGROUND = "#d4efd9";

const struck = (html: string) => `<s style="color: ${OLD_TEXT_COLOR}">${html}</s>`;
const highlighted = (html: string) => `<mark data-color="${NEW_TEXT_BACKGROUND}">${html}</mark>`;

/** The old text struck through, then the new text highlighted, inside the passage's own block. */
export function markChange(before: string, after: string) {
	// An addition keeps the passage and adds a block after it: only the new block is marked.
	if (after.startsWith(before) && after.length > before.length) {
		const added = after.slice(before.length);
		const marked = splitBlocks(added).reduce((html, block) => {
			const parts = splitBlock(block.html);
			return parts ? html.replace(block.html, () => `${parts.open}${highlighted(parts.inner)}${parts.close}`) : html;
		}, added);
		return `${before}${marked === added ? highlighted(added) : marked}`;
	}

	const old = splitBlock(before);
	const next = splitBlock(after);
	if (!old || !next) return `${struck(before)} ${highlighted(after)}`;
	return `${old.open}${struck(old.inner)} ${highlighted(next.inner)}${old.close}`;
}

/** The proposals still waiting on the user (not accepted, rejected or out of date), optionally in one section. */
export const pendingProposals = (data: ResumeData, proposals: readonly Proposal[], sectionId?: string) =>
	proposals.filter(
		(proposal) =>
			(sectionId === undefined || proposal.target.sectionId === sectionId) &&
			getProposalState(data, proposal) === "pending",
	);

/**
 * The page as it would read with the proposals: each passage struck through, followed by its replacement,
 * highlighted. For the preview only; it's never saved.
 */
export function markProposals(data: ResumeData, proposals: readonly Proposal[]): ResumeData {
	const pending = pendingProposals(data, proposals);
	if (pending.length === 0) return data;

	return produce(data, (draft) => {
		for (const proposal of pending) {
			const value = readTarget(draft, proposal.target);
			if (value === undefined || !value.includes(proposal.before)) continue;

			const marked = markChange(proposal.before, proposal.after);
			writeTarget(
				draft,
				proposal.target,
				value.replace(proposal.before, () => marked),
			);
		}
	});
}
