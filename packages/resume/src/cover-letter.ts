import type { CoverLetter, CoverLetterStyle } from "@reactive-resume/schema/cover-letter/data";
import type { ResumeData } from "@reactive-resume/schema/resume/data";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";

export function copyCoverLetterStyle(
	data: ResumeData,
	sectionId = "library-cover-letter",
	itemId = "library-cover-letter-item",
): CoverLetterStyle {
	const { notes: _notes, layout: _layout, ...metadata } = data.metadata;
	return structuredClone({ basics: data.basics, picture: data.picture, metadata, sectionId, itemId });
}

export function createCoverLetterResumeData(
	letter: Pick<CoverLetter, "name" | "recipient" | "content" | "style">,
): ResumeData {
	const data = structuredClone(defaultResumeData);
	const style = structuredClone(letter.style);
	data.basics = style.basics;
	data.picture = style.picture;
	data.metadata = {
		...style.metadata,
		notes: "",
		layout: { sidebarWidth: 35, pages: [{ fullWidth: true, main: [style.sectionId], sidebar: [] }] },
	};
	data.customSections = [
		{
			id: style.sectionId,
			type: "cover-letter",
			title: letter.name,
			icon: "envelope",
			columns: 1,
			hidden: false,
			keepTogether: false,
			startOnNewPage: false,
			items: [{ id: style.itemId, hidden: false, recipient: letter.recipient, content: letter.content }],
		},
	];
	return data;
}

const escapeHtml = (text: string) =>
	text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");

export function coverLetterTextToHtml(text: string): string {
	return text
		.trim()
		.split(/\n\s*\n/)
		.filter(Boolean)
		.map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`)
		.join("");
}

const HONORIFIC = /^(mr|mrs|ms|mx|dr|prof)\.?$/i;

/**
 * Who a structured letter's greeting addresses: a first name ("Dana Reyes" → "Dana"), a title with the surname
 * ("Dr. Dana Reyes" → "Dr. Reyes") or a team as written ("Design team"). Null without a name, or for "Hiring team",
 * which greets the hiring team.
 */
export function greetingName(recipientName: string): string | null {
	const words = recipientName.trim().split(/\s+/).filter(Boolean);
	const [first, ...rest] = words;
	if (!first || words.join(" ").toLowerCase() === "hiring team") return null;
	if (rest.at(-1)?.toLowerCase() === "team") return words.join(" ");
	if (HONORIFIC.test(first) && rest.length > 0) return `${first} ${rest.at(-1)}`;
	return first;
}

/** The words a structured letter is composed with, in the reader's language. */
export type LetterWords = {
	/** "Dear {name}," */
	greeting: (name: string) => string;
	/** "Dear hiring team," */
	teamGreeting: string;
	/** The recipient shown when there's no name: "Hiring team". */
	hiringTeam: string;
	/** "Kind regards," */
	signOff: string;
	/** The letter's date (YYYY-MM-DD) as written on the page. */
	formatDate: (date: string) => string;
};

type ComposableLetter = Pick<
	CoverLetter,
	"layout" | "recipient" | "content" | "recipientName" | "recipientCompany" | "letterDate" | "style"
>;

/**
 * A letter's recipient block and body as the page shows them. Structured letters compose the recipient (name or
 * team, company) and the date, then a greeting from the name, the body and a sign-off over the sender's name.
 * Freeform letters read exactly as written.
 */
export function composeCoverLetter(letter: ComposableLetter, words: LetterWords) {
	if (letter.layout === "freeform") return { recipient: letter.recipient, content: letter.content };

	const to = [letter.recipientName.trim() || words.hiringTeam, letter.recipientCompany.trim()]
		.filter(Boolean)
		.map(escapeHtml)
		.join("<br />");
	const date = letter.letterDate ? `<p>${escapeHtml(words.formatDate(letter.letterDate))}</p>` : "";
	const name = greetingName(letter.recipientName);
	const sender = letter.style.basics.name.trim();

	return {
		recipient: `<p>${to}</p>${date}`,
		content: [
			`<p>${escapeHtml(name ? words.greeting(name) : words.teamGreeting)}</p>`,
			letter.content,
			`<p>${escapeHtml(words.signOff)}${sender ? `<br />${escapeHtml(sender)}` : ""}</p>`,
		].join(""),
	};
}
