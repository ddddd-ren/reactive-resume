import type { ResumeData } from "@reactive-resume/schema/resume/data";
import { produce } from "immer";
import { findEntry } from "../write/model";

/** A field that holds rich text: the summary's content, or an entry's description. */
export type ProposalTarget = { sectionId: string; itemId?: string; field: string };

type ProposalSource = "check" | "assistant" | "improve";

/**
 * A suggested edit: replace one passage of a field (a bullet or a paragraph) with another. It is never applied
 * until accepted. Out of date is not stored: it's whenever the passage is no longer in the field.
 */
export type Proposal = {
	id: string;
	target: ProposalTarget;
	/** Where it lands, for people: "Experience · Studio Kettle · bullet 1". */
	location: string;
	/** The passage as it is now: a whole `<p>` or `<li>` block, exactly as stored in the field. */
	before: string;
	/** The block to put in its place. */
	after: string;
	/** One line on why. */
	why: string;
	status: "pending" | "accepted" | "rejected";
	source: ProposalSource;
};

export type ProposalState = Proposal["status"] | "stale";

export function readTarget(data: ResumeData, target: ProposalTarget): string | undefined {
	if (!target.itemId)
		return target.sectionId === "summary" && target.field === "content" ? data.summary.content : undefined;

	const value = (findEntry(data, target.sectionId, target.itemId) as Record<string, unknown> | undefined)?.[
		target.field
	];
	return typeof value === "string" ? value : undefined;
}

function writeTarget(draft: ResumeData, target: ProposalTarget, value: string) {
	if (!target.itemId) {
		draft.summary.content = value;
		return;
	}

	const entry = findEntry(draft, target.sectionId, target.itemId) as Record<string, unknown> | undefined;
	if (entry) entry[target.field] = value;
}

/** A pending proposal can be applied only while its passage is still in the field, word for word. */
export const canApply = (data: ResumeData, proposal: Proposal) =>
	readTarget(data, proposal.target)?.includes(proposal.before) ?? false;

/**
 * What a proposal shows as. Pending ones whose passage has changed are out of date; accepted ones whose edit was
 * undone (the passage is back, the new text gone) are pending again.
 */
export function getProposalState(data: ResumeData, proposal: Proposal): ProposalState {
	if (proposal.status === "rejected") return "rejected";

	const value = readTarget(data, proposal.target) ?? "";
	if (proposal.status === "accepted")
		return value.includes(proposal.before) && !value.includes(proposal.after) ? "pending" : "accepted";
	return value.includes(proposal.before) ? "pending" : "stale";
}

/** Puts `after` in place of `before`. Returns false (changing nothing) when the proposal is out of date. */
export function applyProposal(draft: ResumeData, proposal: Proposal): boolean {
	const value = readTarget(draft, proposal.target);
	if (value === undefined || !value.includes(proposal.before)) return false;

	// A replacer function, so "$&" or "$1" in the new text stay literal.
	writeTarget(
		draft,
		proposal.target,
		value.replace(proposal.before, () => proposal.after),
	);
	return true;
}

// Colours of the page marks (README §5.9), as the PDF needs them: old text struck through in grey, new text on
// a pale accent highlight.
const OLD_TEXT_COLOR = "#7d7b73";
const NEW_TEXT_BACKGROUND = "#d4efd9";

const BLOCK = /^(<(p|li)(?:\s[^>]*)?>)([\s\S]*)(<\/\2>)$/i;

/** A block's opening tag, contents and closing tag; `undefined` for anything else. */
function splitBlock(html: string) {
	const match = BLOCK.exec(html);
	return match ? { open: match[1] ?? "", inner: match[3] ?? "", close: match[4] ?? "" } : undefined;
}

/** The old text struck through, then the new text highlighted, inside the passage's own block. */
function markChange(before: string, after: string) {
	const old = splitBlock(before);
	const next = splitBlock(after);
	const struck = (html: string) => `<s style="color: ${OLD_TEXT_COLOR}">${html}</s>`;
	const highlighted = (html: string) => `<mark data-color="${NEW_TEXT_BACKGROUND}">${html}</mark>`;

	if (!old || !next) return `${struck(before)} ${highlighted(after)}`;
	return `${old.open}${struck(old.inner)} ${highlighted(next.inner)}${old.close}`;
}

/**
 * The page as it would read with the proposals: each passage struck through, followed by its replacement,
 * highlighted. For the preview only; it's never saved.
 */
export function markProposals(data: ResumeData, proposals: readonly Proposal[]): ResumeData {
	const pending = proposals.filter((proposal) => getProposalState(data, proposal) === "pending");
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

const escapeHtml = (text: string) =>
	text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The block with its text replaced by plain text (a model's rewrite), keeping the tag and its attributes. */
export function replaceBlockText(block: string, text: string): string {
	const html = escapeHtml(text.trim().replace(/\s+/g, " "));
	const parts = splitBlock(block);
	return parts ? `${parts.open}${html}${parts.close}` : html;
}
