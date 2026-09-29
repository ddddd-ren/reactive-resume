import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { moveItem } from "./move-item";

const company = (id: string) => ({
	id,
	hidden: false,
	company: `Company ${id}`,
	position: `Position ${id}`,
	location: "",
	period: "",
	description: "",
	roles: [],
	website: { url: "", label: "", inlineLink: false },
});
const base = () =>
	produce(defaultResumeData, (draft) => {
		draft.sections.experience.items = [company("1"), company("2")];
		draft.metadata.layout.pages = [{ fullWidth: false, main: ["experience"], sidebar: [] }];
	});
const split = () =>
	produce(base(), (draft) => {
		moveItem(draft, { itemId: "2", type: "experience", target: { type: "new-page", title: "Experience" } });
	});

describe("moving the last custom-section item (#3180)", () => {
	it("restores the original JSON after moving an experience item to a new page and back", () => {
		const initial = base();
		const moved = split();
		expect(moved.metadata.layout.pages).toHaveLength(2);
		const restored = produce(moved, (draft) => {
			moveItem(draft, {
				itemId: "2",
				type: "experience",
				customSectionId: moved.customSections[0].id,
				target: { type: "section", sectionId: "experience" },
			});
		});
		expect(restored).toEqual(initial);
	});
	it("preserves unrelated blank pages and pages with other section references", () => {
		const moved = produce(split(), (draft) => {
			draft.metadata.layout.pages.push({ fullWidth: true, main: [], sidebar: [] });
			draft.metadata.layout.pages[1].sidebar.push("skills");
		});
		const restored = produce(moved, (draft) => {
			moveItem(draft, {
				itemId: "2",
				type: "experience",
				customSectionId: moved.customSections[0].id,
				target: { type: "section", sectionId: "experience" },
			});
		});
		expect(restored.customSections).toEqual([]);
		expect(restored.metadata.layout.pages).toEqual([
			{ fullWidth: false, main: ["experience"], sidebar: [] },
			{ fullWidth: false, main: [], sidebar: ["skills"] },
			{ fullWidth: true, main: [], sidebar: [] },
		]);
	});
	it("preserves the first page when its only custom section becomes empty", () => {
		const moved = produce(split(), (draft) => {
			draft.metadata.layout.pages.reverse();
		});
		const restored = produce(moved, (draft) => {
			moveItem(draft, {
				itemId: "2",
				type: "experience",
				customSectionId: moved.customSections[0].id,
				target: { type: "section", sectionId: "experience" },
			});
		});
		expect(restored.metadata.layout.pages).toEqual([
			{ fullWidth: false, main: [], sidebar: [] },
			{ fullWidth: false, main: ["experience"], sidebar: [] },
		]);
	});
	it("inserts into the selected later page before pruning the source page", () => {
		const moved = produce(split(), (draft) => {
			draft.metadata.layout.pages.push({ fullWidth: true, main: [], sidebar: ["skills"] });
		});
		const restored = produce(moved, (draft) => {
			moveItem(draft, {
				itemId: "2",
				type: "experience",
				customSectionId: moved.customSections[0].id,
				target: { type: "new-section", pageIndex: 2, title: "Later" },
			});
		});
		expect(restored.metadata.layout.pages).toHaveLength(2);
		expect(restored.customSections).toHaveLength(1);
		expect(restored.customSections[0]).toMatchObject({ title: "Later", items: [company("2")] });
		expect(restored.metadata.layout.pages[1]).toEqual({
			fullWidth: true,
			main: [restored.customSections[0].id],
			sidebar: ["skills"],
		});
	});
	it("keeps a custom section with hidden remaining items", () => {
		const moved = produce(split(), (draft) => {
			draft.customSections[0].items.push({ ...company("3"), hidden: true });
		});
		const restored = produce(moved, (draft) => {
			moveItem(draft, {
				itemId: "2",
				type: "experience",
				customSectionId: moved.customSections[0].id,
				target: { type: "section", sectionId: "experience" },
			});
		});
		expect(restored.customSections[0].items).toEqual([{ ...company("3"), hidden: true }]);
		expect(restored.metadata.layout.pages).toHaveLength(2);
	});
	it.each([
		{ type: "section", sectionId: "missing" },
		{ type: "section", sectionId: "skills" },
		{ type: "new-section", pageIndex: 99, title: "Missing" },
	] as const)("leaves data intact for an invalid destination $type", (target) => {
		const moved = split();
		expect(
			produce(moved, (draft) => {
				moveItem(draft, { itemId: "2", type: "experience", customSectionId: moved.customSections[0].id, target });
			}),
		).toEqual(moved);
	});
});
