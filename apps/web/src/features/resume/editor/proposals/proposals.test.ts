import type { Proposal } from "@reactive-resume/resume/proposals";
import type { ResumeData } from "@reactive-resume/schema/resume/data";
import { describe, expect, it } from "vitest";
import { produce } from "immer";
import {
	applyProposal,
	canApply,
	collectPassages,
	getProposalState,
	readTarget,
	replaceBlockText,
	splitBlocks,
} from "@reactive-resume/resume/proposals";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { markProposals, pendingProposals } from "./proposals";

const OLD_BULLET = "<li><p>Responsible for various design tasks</p></li>";

function makeData(): ResumeData {
	const data = structuredClone(defaultResumeData);
	data.summary.content = "<p>Product designer with 8 years in health tools.</p>";
	data.sections.experience.items = [
		{
			id: "kettle",
			hidden: false,
			company: "Studio Kettle",
			position: "Junior Designer",
			location: "Lisbon",
			period: "2016 - 2019",
			website: { url: "", label: "", inlineLink: false },
			description: `<ul>${OLD_BULLET}<li><p>Designed websites &amp; identities for 20+ businesses</p></li></ul>`,
			roles: [],
		} as ResumeData["sections"]["experience"]["items"][number],
	];
	return data;
}

const proposal = (patch: Partial<Proposal> = {}): Proposal => ({
	id: "1",
	target: { sectionId: "experience", itemId: "kettle", field: "description" },
	location: "Experience · Studio Kettle · bullet 1",
	before: "<p>Responsible for various design tasks</p>",
	after: "<p>Produced packaging and print work for local retail clients</p>",
	why: "Names an outcome.",
	status: "pending",
	source: "check",
	...patch,
});

describe("splitBlocks", () => {
	it("reads leaf paragraphs and list items, marking bullets and decoding entities", () => {
		expect(splitBlocks(`<p>Intro</p><ul>${OLD_BULLET}<li>Plain &amp; bare</li></ul><p> </p>`)).toEqual([
			{ html: "<p>Intro</p>", text: "Intro", bullet: false },
			{
				html: "<p>Responsible for various design tasks</p>",
				text: "Responsible for various design tasks",
				bullet: true,
			},
			{ html: "<li>Plain &amp; bare</li>", text: "Plain & bare", bullet: true },
		]);
	});
});

describe("collectPassages", () => {
	const labels = {
		summary: "Summary",
		sectionTitle: () => "Experience",
		entryTitle: (_type: string, entry: Record<string, unknown>) => String(entry.position),
		bullet: (n: number) => `bullet ${n}`,
		paragraph: (n: number) => `paragraph ${n}`,
	};

	it("lists the summary and each visible entry's bullets with where they sit", () => {
		const passages = collectPassages(makeData(), labels);
		expect(passages.map((passage) => [passage.location, passage.text])).toEqual([
			["Summary · paragraph 1", "Product designer with 8 years in health tools."],
			["Experience · Junior Designer · bullet 1", "Responsible for various design tasks"],
			["Experience · Junior Designer · bullet 2", "Designed websites & identities for 20+ businesses"],
		]);
		// Ids come from the passage's place and words: stable while they stay, new once the words change.
		expect(new Set(passages.map((passage) => passage.id)).size).toBe(3);
		expect(collectPassages(makeData(), labels).map((passage) => passage.id)).toEqual(
			passages.map((passage) => passage.id),
		);
		expect(passages[1]?.target).toEqual({ sectionId: "experience", itemId: "kettle", field: "description" });
	});

	it("leaves hidden entries and sections out", () => {
		const data = produce(makeData(), (draft) => {
			draft.summary.hidden = true;
			const entry = draft.sections.experience.items[0];
			if (entry) entry.hidden = true;
		});
		expect(collectPassages(data, labels)).toEqual([]);
	});
});

describe("proposals", () => {
	it("applies while the passage is still in the field, and only then", () => {
		const data = makeData();
		expect(canApply(data, proposal())).toBe(true);

		const next = produce(data, (draft) => {
			expect(applyProposal(draft, proposal())).toBe(true);
		});
		expect(readTarget(next, proposal().target)).toContain("<li><p>Produced packaging and print work");
		expect(getProposalState(next, proposal())).toBe("stale");

		produce(next, (draft) => {
			expect(applyProposal(draft, proposal())).toBe(false);
		});
	});

	it("shows an accepted proposal as pending again once its edit is undone", () => {
		const data = makeData();
		const accepted = proposal({ status: "accepted" });
		expect(getProposalState(data, accepted)).toBe("pending");

		const applied = produce(data, (draft) => {
			applyProposal(draft, accepted);
		});
		expect(getProposalState(applied, accepted)).toBe("accepted");
		expect(getProposalState(applied, proposal({ status: "rejected" }))).toBe("rejected");
	});

	it("keeps dollar signs in the new text literal", () => {
		const next = produce(makeData(), (draft) => {
			applyProposal(draft, proposal({ after: "<p>Cut costs by $& and $1</p>" }));
		});
		expect(readTarget(next, proposal().target)).toContain("<p>Cut costs by $& and $1</p>");
	});

	it("targets the summary", () => {
		const summary = proposal({
			target: { sectionId: "summary", field: "content" },
			before: "<p>Product designer with 8 years in health tools.</p>",
			after: "<p>Product designer for clinicians.</p>",
		});
		const next = produce(makeData(), (draft) => {
			applyProposal(draft, summary);
		});
		expect(next.summary.content).toBe("<p>Product designer for clinicians.</p>");
	});

	it("marks pending proposals on a copy: old text struck through, new text highlighted", () => {
		const data = makeData();
		const marked = markProposals(data, [proposal(), proposal({ id: "2", status: "rejected" })]);

		expect(readTarget(marked, proposal().target)).toContain(
			'<p><s style="color: #7d7b73">Responsible for various design tasks</s> <mark data-color="#d4efd9">Produced packaging and print work for local retail clients</mark></p>',
		);
		expect(readTarget(data, proposal().target)).not.toContain("<s");
		expect(markProposals(data, [proposal({ status: "rejected" })])).toBe(data);
	});

	it("replaces a block's text and escapes it, keeping the tag", () => {
		expect(replaceBlockText('<p class="x">Old</p>', "  New <b>&  bold  ")).toBe(
			'<p class="x">New &lt;b&gt;&amp; bold</p>',
		);
	});

	it("adds a block after a passage, marking only the new one", () => {
		const before = "<li><p>Responsible for various design tasks</p></li>";
		const addition = proposal({
			before,
			after: `${before}<li><p>Introduced monthly accessibility reviews</p></li>`,
		});
		const data = makeData();
		expect(readTarget(markProposals(data, [addition]), addition.target)).toContain(
			`${before}<li><p><mark data-color="#d4efd9">Introduced monthly accessibility reviews</mark></p></li>`,
		);
		const next = produce(data, (draft) => {
			applyProposal(draft, addition);
		});
		expect(readTarget(next, addition.target)).toContain("Introduced monthly accessibility reviews</p></li><li>");
		expect(getProposalState(next, { ...addition, status: "accepted" })).toBe("accepted");
	});
});

describe("pendingProposals", () => {
	it("counts a section's pill: pending only, not rejected, accepted or out of date", () => {
		const data = makeData();
		const summary = proposal({
			id: "s",
			target: { sectionId: "summary", field: "content" },
			before: "<p>Product designer with 8 years in health tools.</p>",
		});
		const proposals = [
			proposal(),
			proposal({ id: "2", status: "rejected" }),
			proposal({ id: "3", before: "<p>Text that isn't there any more</p>" }),
			proposal({
				id: "4",
				status: "accepted",
				before: "<p>Made websites</p>",
				after: "<p>Designed websites &amp; identities for 20+ businesses</p>",
			}),
			summary,
		];

		expect(pendingProposals(data, proposals, "experience").map((item) => item.id)).toEqual(["1"]);
		expect(pendingProposals(data, proposals, "summary").map((item) => item.id)).toEqual(["s"]);
		expect(pendingProposals(data, proposals)).toHaveLength(2);
	});
});
