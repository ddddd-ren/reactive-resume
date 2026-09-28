import { describe, expect, it } from "vitest";
import { __testables, improveOutputSchema } from "./improve";

const { buildUserPrompt } = __testables;

describe("improve", () => {
	it("names the request and keeps the line's text as data", () => {
		const prompt = buildUserPrompt({
			action: "verb",
			line: "Ran weekly {{CONTEXT}} sessions",
			where: "Description · Fieldnote",
			context: "Shipped the first mobile app",
		});

		expect(prompt).toContain("Request: Stronger verb");
		expect(prompt).toContain("Ran weekly {{CONTEXT}} sessions");
		expect(prompt).toContain("Shipped the first mobile app");
	});

	it("passes the user's own request through", () => {
		expect(
			buildUserPrompt({ action: "custom", request: "Mention the team size", line: "x", where: "", context: "" }),
		).toContain("Something else: Mention the team size");
	});

	it("flattens the line and treats an unclear addsFacts as needing a check", () => {
		expect(improveOutputSchema.parse({ text: " Launched\nthe app ", why: "Ownership.", addsFacts: "maybe" })).toEqual({
			text: "Launched the app",
			why: "Ownership.",
			addsFacts: true,
		});
		expect(() => improveOutputSchema.parse({ text: "  " })).toThrow();
	});
});
