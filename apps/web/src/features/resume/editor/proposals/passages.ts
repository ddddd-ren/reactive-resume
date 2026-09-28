import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { ProposalTarget } from "./proposals";
import { stripHtml } from "@reactive-resume/utils/string";
import { describeEntry, getEntries, resolveSection } from "../write/model";

/** A bullet or paragraph a reviewer can suggest rewriting, with where it sits. */
export type Passage = {
	id: string;
	target: ProposalTarget;
	/** "Experience · Studio Kettle · bullet 1". */
	location: string;
	/** The whole block (`<p>…</p>` or `<li>…</li>`) exactly as stored, so a proposal can find it again. */
	html: string;
	text: string;
};

// A paragraph or list item with no paragraph or list item inside it: `<li><p>…</p></li>` yields the `<p>`.
const LEAF_BLOCK = /<(p|li)(?:\s[^>]*)?>((?:(?!<\/?(?:p|li)[\s>])[\s\S])*?)<\/\1>/gi;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

const decodeEntities = (text: string) =>
	text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
		if (name.startsWith("#x") || name.startsWith("#X")) return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
		if (name.startsWith("#")) return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
		return ENTITIES[name.toLowerCase()] ?? entity;
	});

const toText = (html: string) => decodeEntities(stripHtml(html)).replace(/\s+/g, " ").trim();

type Block = { html: string; text: string; bullet: boolean };

/** The leaf paragraphs and list items of rich text, in order, skipping empty ones. */
export function splitBlocks(html: string): Block[] {
	const blocks: Block[] = [];

	for (const match of html.matchAll(LEAF_BLOCK)) {
		const text = toText(match[2] ?? "");
		if (!text) continue;

		// Inside a list when more <li> have opened than closed before this block.
		const preceding = html.slice(0, match.index);
		const opened = preceding.match(/<li[\s>]/gi)?.length ?? 0;
		const closed = preceding.match(/<\/li>/gi)?.length ?? 0;
		blocks.push({ html: match[0], text, bullet: match[1]?.toLowerCase() === "li" || opened > closed });
	}

	return blocks;
}

type Labels = {
	summary: string;
	sectionTitle: (sectionId: string) => string;
	bullet: (n: number) => string;
	paragraph: (n: number) => string;
};

/**
 * Every passage a writing review can target, in page order: the summary's paragraphs, then each visible
 * entry's description, section by section. Hidden sections and entries don't print, so they're left out.
 */
export function collectPassages(data: ResumeData, labels: Labels): Passage[] {
	const passages: Passage[] = [];

	const add = (target: ProposalTarget, where: string[], html: string) => {
		let bullets = 0;
		let paragraphs = 0;

		for (const block of splitBlocks(html)) {
			const place = block.bullet ? labels.bullet(++bullets) : labels.paragraph(++paragraphs);
			passages.push({
				id: `p${passages.length + 1}`,
				target,
				location: [...where, place].join(" · "),
				html: block.html,
				text: block.text,
			});
		}
	};

	if (!data.summary.hidden) add({ sectionId: "summary", field: "content" }, [labels.summary], data.summary.content);

	const sectionIds = [...Object.keys(data.sections), ...data.customSections.map((section) => section.id)];

	for (const sectionId of sectionIds) {
		const section = resolveSection(data, sectionId);
		if (!section || section.type === "cover-letter") continue;

		const hidden =
			section.kind === "custom"
				? data.customSections.find((custom) => custom.id === sectionId)?.hidden
				: data.sections[sectionId as keyof ResumeData["sections"]].hidden;
		if (hidden) continue;

		for (const entry of getEntries(data, section)) {
			const { hidden: entryHidden, description } = entry as { hidden?: boolean; description?: unknown };
			if (entryHidden || typeof description !== "string") continue;

			const title = describeEntry(section.type, entry).title;
			add(
				{ sectionId, itemId: entry.id, field: "description" },
				[labels.sectionTitle(sectionId), ...(title ? [title] : [])],
				description,
			);
		}
	}

	return passages;
}
