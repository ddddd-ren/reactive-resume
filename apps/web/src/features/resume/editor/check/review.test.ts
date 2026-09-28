import type { Passage } from "@reactive-resume/resume/proposals";
import { describe, expect, it } from "vitest";
import { mapWritingReview } from "./review";

const passage: Passage = {
	id: "p1",
	target: { sectionId: "experience", itemId: "kettle", field: "description" },
	location: "Experience · Studio Kettle · bullet 1",
	html: "<p>Responsible for various design tasks</p>",
	text: "Responsible for various design tasks",
};

const suggestion = (patch: Partial<Parameters<typeof mapWritingReview>[0][number]>) => ({
	section: "Experience",
	passageId: "p1",
	issue: "Names a duty, not an outcome.",
	rewrite: "Produced packaging and print work for local retail clients",
	impact: "high" as const,
	...patch,
});

describe("mapWritingReview", () => {
	it("turns a rewrite of a passage it was sent into a proposal for that passage", () => {
		const { proposals, notes } = mapWritingReview([suggestion({})], [passage]);

		expect(notes).toEqual([]);
		expect(proposals).toEqual([
			{
				id: "w1",
				target: passage.target,
				location: passage.location,
				before: "<p>Responsible for various design tasks</p>",
				after: "<p>Produced packaging and print work for local retail clients</p>",
				why: "Names a duty, not an outcome.",
				status: "pending",
				source: "check",
			},
		]);
	});

	it("keeps advice, unchanged rewrites and unknown passages as notes", () => {
		const { proposals, notes } = mapWritingReview(
			[
				suggestion({ rewrite: null }),
				suggestion({ rewrite: " Responsible for various design tasks " }),
				suggestion({ passageId: "p9", section: "Summary", impact: "low" }),
			],
			[passage],
		);

		expect(proposals).toEqual([]);
		expect(notes.map((note) => [note.location, note.quote, note.target])).toEqual([
			[passage.location, passage.text, { kind: "item", sectionId: "experience", itemId: "kettle" }],
			[passage.location, passage.text, { kind: "item", sectionId: "experience", itemId: "kettle" }],
			["Summary", "", null],
		]);
	});
});
