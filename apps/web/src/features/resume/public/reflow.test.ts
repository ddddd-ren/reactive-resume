import { describe, expect, it } from "vitest";
import { sampleResumeData } from "@reactive-resume/schema/resume/sample";
import { reflowOrder } from "./reflow";

const clone = () => structuredClone(sampleResumeData);

describe("reflowOrder", () => {
	it("follows the print order: each page's main column, then its sidebar", () => {
		const data = clone();
		const order = reflowOrder(data).map((section) => section.sectionId);
		const pages = data.metadata.layout.pages;
		const printed = pages.flatMap((page) => [...page.main, ...(page.fullWidth ? [] : page.sidebar)]);

		// Every reflowed section is printed, in the same relative order.
		expect(order.length).toBeGreaterThan(0);
		expect(order).toEqual(printed.filter((id) => order.includes(id)));
	});

	it("leaves out hidden sections and hidden entries", () => {
		const data = clone();
		data.sections.skills.hidden = true;
		const [first, second] = data.sections.projects.items;
		if (first) first.hidden = true;

		const order = reflowOrder(data);
		expect(order.map((section) => section.sectionId)).not.toContain("skills");
		const projects = order.find((section) => section.sectionId === "projects")?.itemIds ?? [];
		expect(projects).not.toContain(first?.id);
		expect(projects).toContain(second?.id);
	});
});
