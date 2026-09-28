import { describe, expect, it } from "vitest";
import {
	agentMessageMetadataSchema,
	askUserQuestionInputSchema,
	proposeEditsInputSchema,
} from "./agent-tool-contracts";

describe("askUserQuestionInputSchema", () => {
	it("accepts a question with up to four choices", () => {
		expect(
			askUserQuestionInputSchema.safeParse({ question: "Which tone?", choices: ["Formal", "Casual"] }).success,
		).toBe(true);
	});

	it("rejects an empty question and too many choices", () => {
		expect(askUserQuestionInputSchema.safeParse({ question: " " }).success).toBe(false);
		expect(askUserQuestionInputSchema.safeParse({ question: "?", choices: ["a", "b", "c", "d", "e"] }).success).toBe(
			false,
		);
	});
});

describe("proposeEditsInputSchema", () => {
	it("takes a titled set of edits, each on a passage with a reason", () => {
		expect(
			proposeEditsInputSchema.safeParse({
				title: "Tighten",
				edits: [{ passageId: "p_1", text: "Led the redesign", why: "Stronger verb." }],
			}).success,
		).toBe(true);
		expect(proposeEditsInputSchema.safeParse({ title: "Tighten", edits: [] }).success).toBe(false);
		expect(
			proposeEditsInputSchema.safeParse({ title: "Tighten", edits: [{ passageId: "p_1", text: " ", why: "x" }] })
				.success,
		).toBe(false);
	});
});

describe("agentMessageMetadataSchema", () => {
	it("accepts missing metadata, empty metadata, and unknown extra fields", () => {
		expect(agentMessageMetadataSchema.safeParse(undefined).success).toBe(true);
		expect(agentMessageMetadataSchema.safeParse({}).success).toBe(true);
		expect(
			agentMessageMetadataSchema.safeParse({ model: "gpt-5", usage: { totalTokens: 12, custom: true }, extra: 1 })
				.success,
		).toBe(true);
	});
});
