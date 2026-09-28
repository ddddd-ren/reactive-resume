import { describe, expect, it } from "vitest";
import { additionAfter, applyTo, collectLetterPassages, getStateIn } from "./proposals";

const labels = { body: "Letter", bullet: (n: number) => `bullet ${n}`, paragraph: (n: number) => `paragraph ${n}` };

describe("additionAfter", () => {
	it("adds a bullet as its own list item after the passage's item", () => {
		const value = "<ul><li><p>First</p></li><li><p>Second</p></li></ul>";
		const addition = additionAfter(value, "<p>First</p>", "New & improved");

		expect(addition).toEqual({
			before: "<p>First</p></li>",
			after: "<p>First</p></li><li><p>New &amp; improved</p></li>",
		});
		expect(applyTo(value, addition ?? { before: "", after: "" })).toBe(
			"<ul><li><p>First</p></li><li><p>New &amp; improved</p></li><li><p>Second</p></li></ul>",
		);
	});

	it("adds a paragraph after a paragraph, and nothing for a passage that's gone", () => {
		expect(additionAfter("<p>One</p><p>Two</p>", "<p>One</p>", "Between")).toEqual({
			before: "<p>One</p>",
			after: "<p>One</p><p>Between</p>",
		});
		expect(additionAfter("<p>One</p>", "<p>Gone</p>", "x")).toBeUndefined();
	});
});

describe("collectLetterPassages", () => {
	it("lists the body's paragraphs with stable ids that change with the text", () => {
		const passages = collectLetterPassages("<p>Hello there.</p><p>Hello there.</p><p>Bye.</p>", labels);

		expect(passages.map((passage) => passage.location)).toEqual([
			"Letter · paragraph 1",
			"Letter · paragraph 2",
			"Letter · paragraph 3",
		]);
		expect(passages[1]?.id).toBe(`${passages[0]?.id}_2`);
		expect(collectLetterPassages("<p>Hello, there.</p>", labels)[0]?.id).not.toBe(passages[0]?.id);
	});

	it("offers an empty body as one empty passage only when asked", () => {
		expect(collectLetterPassages("", labels)).toEqual([]);
		const [empty] = collectLetterPassages("", { ...labels, includeEmpty: true });
		expect(empty).toMatchObject({ html: "", text: "", location: "Letter" });
		// Writing into it replaces the empty text.
		expect(applyTo("", { before: "", after: "<p>Dear team</p>" })).toBe("<p>Dear team</p>");
	});
});

describe("proposal lifecycle", () => {
	const proposal = {
		id: "1",
		target: { sectionId: "letter", field: "content" },
		location: "Letter · paragraph 1",
		before: "<p>Old</p>",
		after: "<p>New</p>",
		why: "",
		status: "pending" as const,
		source: "assistant" as const,
	};

	it("goes out of date after a manual edit, and back to pending when an accepted edit is undone", () => {
		expect(getStateIn("<p>Old</p>", proposal)).toBe("pending");
		expect(getStateIn("<p>Old, edited by hand</p>", proposal)).toBe("stale");
		expect(getStateIn("<p>New</p>", { ...proposal, status: "accepted" })).toBe("accepted");
		expect(getStateIn("<p>Old</p>", { ...proposal, status: "accepted" })).toBe("pending");
		expect(getStateIn("<p>Old</p>", { ...proposal, status: "rejected" })).toBe("rejected");
	});
});
