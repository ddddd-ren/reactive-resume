import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { Proposal } from "./proposals";
import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { collectPassages, splitBlocks } from "./passages";
import { applyProposal, canApply, getProposalState, markProposals, readTarget, replaceBlockText } from "./proposals";

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
		bullet: (n: number) => `bullet ${n}`,
		paragraph: (n: number) => `paragraph ${n}`,
	};

	it("lists the summary and each visible entry's bullets with where they sit", () => {
		const passages = collectPassages(makeData(), labels);
		expect(passages.map((passage) => [passage.id, passage.location, passage.text])).toEqual([
			["p1", "Summary · paragraph 1", "Product designer with 8 years in health tools."],
			["p2", "Experience · Junior Designer · bullet 1", "Responsible for various design tasks"],
			["p3", "Experience · Junior Designer · bullet 2", "Designed websites & identities for 20+ businesses"],
		]);
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
});
