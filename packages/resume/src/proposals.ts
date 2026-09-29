import type { ResumeData } from "@reactive-resume/schema/resume/data";
import { escapeHtml } from "@reactive-resume/utils/string";

/**
 * Suggested edits to a document's text, shared by Check, the assistant and Improve. A proposal replaces one passage
 * (a whole `<p>` or `<li>` block) of a rich-text field and is never applied until accepted.
 */

/** A field that holds rich text: the summary's content, an entry's description, or a letter's body. */
export type ProposalTarget = { sectionId: string; itemId?: string; field: string };

type ProposalSource = "check" | "assistant" | "improve";

export type Proposal = {
	id: string;
	target: ProposalTarget;
	/** Where it lands, for people: "Experience · Studio Kettle · bullet 1". */
	location: string;
	/** The passage as it is now: a whole `<p>` or `<li>` block, exactly as stored in the field. */
	before: string;
	/** The block to put in its place. An addition keeps `before` and adds the new block after it. */
	after: string;
	/** One line on why. */
	why: string;
	status: "pending" | "accepted" | "rejected";
	source: ProposalSource;
};

/** Out of date is not stored: it's whenever the passage is no longer in the field. */
export type ProposalState = Proposal["status"] | "stale";

/** The section id a letter's body goes by, so letters share the proposal shape. */
export const LETTER_SECTION_ID = "letter";

type Entry = { id: string } & Record<string, unknown>;

function findEntry(data: ResumeData, sectionId: string, itemId: string): Entry | undefined {
	const builtin = (data.sections as Record<string, { items: Entry[] } | undefined>)[sectionId];
	const items = builtin?.items ?? data.customSections.find((section) => section.id === sectionId)?.items;
	return (items as Entry[] | undefined)?.find((entry) => entry.id === itemId);
}

export function readTarget(data: ResumeData, target: ProposalTarget): string | undefined {
	if (!target.itemId)
		return target.sectionId === "summary" && target.field === "content" ? data.summary.content : undefined;

	const value = findEntry(data, target.sectionId, target.itemId)?.[target.field];
	return typeof value === "string" ? value : undefined;
}

export function writeTarget(draft: ResumeData, target: ProposalTarget, value: string) {
	if (!target.itemId) {
		draft.summary.content = value;
		return;
	}

	const entry = findEntry(draft, target.sectionId, target.itemId);
	if (entry) entry[target.field] = value;
}

/** A pending proposal can be applied only while its passage is still in the text, word for word. */
export const canApplyTo = (value: string | undefined, proposal: Pick<Proposal, "before">) =>
	value?.includes(proposal.before) ?? false;

export const canApply = (data: ResumeData, proposal: Proposal) =>
	canApplyTo(readTarget(data, proposal.target), proposal);

/**
 * What a proposal shows as, given the text it targets. Pending ones whose passage has changed are out of date;
 * accepted ones whose edit was undone (the passage is back, the new text gone) are pending again.
 */
export function getStateIn(value: string, proposal: Proposal): ProposalState {
	if (proposal.status === "rejected") return "rejected";
	if (proposal.status === "accepted")
		return value.includes(proposal.before) && !value.includes(proposal.after) ? "pending" : "accepted";
	return value.includes(proposal.before) ? "pending" : "stale";
}

export const getProposalState = (data: ResumeData, proposal: Proposal): ProposalState =>
	getStateIn(readTarget(data, proposal.target) ?? "", proposal);

/** The text with `after` in place of `before`, or `undefined` when the proposal is out of date. */
export function applyTo(value: string | undefined, proposal: Pick<Proposal, "before" | "after">) {
	if (value === undefined || !value.includes(proposal.before)) return undefined;
	// A replacer function, so "$&" or "$1" in the new text stay literal.
	return value.replace(proposal.before, () => proposal.after);
}

/** Puts `after` in place of `before`. Returns false (changing nothing) when the proposal is out of date. */
export function applyProposal(draft: ResumeData, proposal: Proposal): boolean {
	const next = applyTo(readTarget(draft, proposal.target), proposal);
	if (next === undefined) return false;
	writeTarget(draft, proposal.target, next);
	return true;
}

const BLOCK = /^(<(p|li)(?:\s[^>]*)?>)([\s\S]*)(<\/\2>)$/i;

/** A block's opening tag, contents and closing tag; `undefined` for anything else. */
export function splitBlock(html: string) {
	const match = BLOCK.exec(html);
	return match ? { open: match[1] ?? "", inner: match[3] ?? "", close: match[4] ?? "" } : undefined;
}

/**
 * The block with its text replaced by plain text (a model's rewrite), keeping the tag and its attributes. An empty
 * field's "block" becomes a paragraph.
 */
export function replaceBlockText(block: string, text: string): string {
	const html = escapeHtml(text.trim().replace(/\s+/g, " "));
	const parts = splitBlock(block);
	if (parts) return `${parts.open}${html}${parts.close}`;
	return block === "" ? `<p>${html}</p>` : html;
}

/**
 * An addition after a passage, as a replacement: the passage (with its list item's end, for a bullet) stays, and a
 * new block of the same kind follows it, so a new bullet lands as its own list item.
 */
export function additionAfter(value: string, passageHtml: string, text: string) {
	const index = value.indexOf(passageHtml);
	if (index < 0) return undefined;

	const block = replaceBlockText(passageHtml, text);
	const closing = /^\s*<\/li>/i.exec(value.slice(index + passageHtml.length));
	if (!closing) return { before: passageHtml, after: `${passageHtml}${block}` };

	const before = `${passageHtml}${closing[0]}`;
	return { before, after: `${before}<li>${block}</li>` };
}

// A paragraph or list item with no paragraph or list item inside it: `<li><p>…</p></li>` yields the `<p>`.
const LEAF_BLOCK = /<(p|li)(?:\s[^>]*)?>((?:(?!<\/?(?:p|li)[\s>])[\s\S])*?)<\/\1>/gi;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

const decodeEntities = (text: string) =>
	text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
		if (name.startsWith("#x") || name.startsWith("#X")) return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
		if (name.startsWith("#")) return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
		return ENTITIES[name.toLowerCase()] ?? entity;
	});

/** The visible text of some HTML, on one line. */
export const blockText = (html: string) =>
	decodeEntities(html.replace(/<[^>]*>/g, ""))
		.replace(/\s+/g, " ")
		.trim();

export type Block = { html: string; text: string; bullet: boolean };

/** The leaf paragraphs and list items of rich text, in order, skipping empty ones. */
export function splitBlocks(html: string): Block[] {
	const blocks: Block[] = [];

	for (const match of html.matchAll(LEAF_BLOCK)) {
		const text = blockText(match[2] ?? "");
		if (!text) continue;

		// Inside a list when more <li> have opened than closed before this block.
		const preceding = html.slice(0, match.index);
		const opened = preceding.match(/<li[\s>]/gi)?.length ?? 0;
		const closed = preceding.match(/<\/li>/gi)?.length ?? 0;
		blocks.push({ html: match[0], text, bullet: match[1]?.toLowerCase() === "li" || opened > closed });
	}

	return blocks;
}

/** A bullet or paragraph an edit can target, with where it sits. */
export type Passage = {
	/** Derived from where the passage is and what it says, so an edit made against older text can't land. */
	id: string;
	target: ProposalTarget;
	/** "Experience · Studio Kettle · bullet 1". */
	location: string;
	/** The whole block (`<p>…</p>` or `<li>…</li>`) exactly as stored, so a proposal can find it again. */
	html: string;
	text: string;
};

export type PassageLabels = {
	/** Also list an empty (visible) summary or letter body, so something can be written into it. */
	includeEmpty?: boolean;
	summary: string;
	sectionTitle: (sectionId: string) => string;
	/** The entry as people know it: its company, school or name. */
	entryTitle: (sectionType: string, entry: Record<string, unknown>) => string;
	bullet: (n: number) => string;
	paragraph: (n: number) => string;
};

// FNV-1a: short and stable. The text is part of the key, so ids never outlive the words they name.
function hash(value: string) {
	let h = 0x811c9dc5;
	for (let index = 0; index < value.length; index++) {
		h ^= value.charCodeAt(index);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0).toString(36);
}

function passagesOf(
	html: string,
	target: ProposalTarget,
	where: string[],
	labels: Pick<PassageLabels, "bullet" | "paragraph" | "includeEmpty">,
	seen: Map<string, number>,
): Passage[] {
	let bullets = 0;
	let paragraphs = 0;
	const blocks = splitBlocks(html);

	// An empty field is one empty passage, written into by replacing "".
	if (blocks.length === 0 && labels.includeEmpty && !html.trim()) {
		return [
			{
				id: `p_${hash(`${target.sectionId}|${target.itemId ?? ""}|${target.field}|`)}`,
				target,
				location: where.join(" · "),
				html: "",
				text: "",
			},
		];
	}

	return blocks.map((block) => {
		const place = block.bullet ? labels.bullet(++bullets) : labels.paragraph(++paragraphs);
		const base = `p_${hash(`${target.sectionId}|${target.itemId ?? ""}|${target.field}|${block.text}`)}`;
		const count = (seen.get(base) ?? 0) + 1;
		seen.set(base, count);
		return {
			id: count === 1 ? base : `${base}_${count}`,
			target,
			location: [...where, place].join(" · "),
			html: block.html,
			text: block.text,
		};
	});
}

/**
 * Every passage an edit can target, in page order: the summary's paragraphs, then each visible entry's description,
 * section by section. Hidden sections and entries don't print, so they're left out.
 */
export function collectPassages(data: ResumeData, labels: PassageLabels): Passage[] {
	const seen = new Map<string, number>();
	const passages: Passage[] = [];

	if (!data.summary.hidden)
		passages.push(
			...passagesOf(data.summary.content, { sectionId: "summary", field: "content" }, [labels.summary], labels, seen),
		);

	type Section = { id: string; type: string; hidden: boolean; items: Entry[] };
	const sections: Section[] = [
		...Object.entries(data.sections).map(([id, section]) => ({
			id,
			type: id,
			hidden: section.hidden,
			items: section.items as unknown as Entry[],
		})),
		...data.customSections.map((section) => ({
			id: section.id,
			type: section.type as string,
			hidden: section.hidden,
			items: section.items as unknown as Entry[],
		})),
	];

	for (const section of sections) {
		if (section.hidden || section.type === "cover-letter") continue;

		for (const entry of section.items) {
			if (entry.hidden || typeof entry.description !== "string") continue;
			const title = labels.entryTitle(section.type, entry);
			passages.push(
				...passagesOf(
					entry.description,
					{ sectionId: section.id, itemId: entry.id, field: "description" },
					[labels.sectionTitle(section.id), ...(title ? [title] : [])],
					labels,
					seen,
				),
			);
		}
	}

	return passages;
}

/** A letter's body, passage by passage. */
export const collectLetterPassages = (
	content: string,
	labels: Pick<PassageLabels, "bullet" | "paragraph" | "includeEmpty"> & { body: string },
) => passagesOf(content, { sectionId: LETTER_SECTION_ID, field: "content" }, [labels.body], labels, new Map());
