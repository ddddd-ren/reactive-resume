import type { ResumeData } from "@reactive-resume/schema/resume/data";
import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { customSectionItemDefinitionByType } from "@reactive-resume/schema/resume/data";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import {
	addBuiltinSection,
	addCustomSection,
	CUSTOM_SECTION_TYPES,
	countEntriesToCheck,
	createEntry,
	describeEntry,
	getOutlineRows,
	isDraftEntry,
	isSectionInUse,
	moveSection,
	resolveSection,
} from "./model";

const resume = (edit?: (data: ResumeData) => void) => {
	const data = structuredClone(defaultResumeData);
	data.metadata.layout.pages = [
		{ fullWidth: false, main: ["summary", "experience", "education"], sidebar: ["skills"] },
	];
	edit?.(data);
	return data;
};

const withEntries = (data: ResumeData, ...types: ("experience" | "education" | "skills")[]) => {
	for (const type of types) {
		const entry = createEntry(type) as { name?: string; company?: string; school?: string };
		if (type === "experience") entry.company = "Lumen";
		if (type === "education") entry.school = "UdK";
		if (type === "skills") entry.name = "Figma";
		(data.sections[type].items as unknown[]).push(entry);
	}
};

describe("createEntry", () => {
	it.each(CUSTOM_SECTION_TYPES)("makes a %s entry the schema accepts", (type) => {
		const entry = createEntry(type);
		expect(customSectionItemDefinitionByType[type].schema.safeParse(entry).success).toBe(true);
	});
});

describe("drafts", () => {
	it("treats an entry without its primary field as a draft", () => {
		expect(isDraftEntry("experience", createEntry("experience"))).toBe(true);
		expect(isDraftEntry("experience", { ...createEntry("experience"), company: "Lumen" } as never)).toBe(false);
		expect(isDraftEntry("summary", createEntry("summary"))).toBe(false);
	});
});

describe("describeEntry", () => {
	it("titles experience by position, then company · location · dates", () => {
		const entry = {
			...createEntry("experience"),
			position: "Designer",
			company: "Lumen",
			location: "Berlin",
			period: "Mar 2022 – Present",
		};
		expect(describeEntry("experience", entry as never)).toEqual({
			title: "Designer",
			meta: "Lumen · Berlin · Mar 2022 – Present",
		});
	});
});

describe("outline", () => {
	it("lists sections in use in print order: main, then sidebar", () => {
		const data = resume((draft) => withEntries(draft, "skills", "education"));
		expect(getOutlineRows(data)).toEqual([
			{ id: "education", page: 0, column: "main" },
			{ id: "skills", page: 0, column: "sidebar" },
		]);
	});

	it("keeps just-added and custom sections, and lists unplaced sections last", () => {
		const data = resume((draft) => {
			withEntries(draft, "experience");
			draft.sections.projects.items = [createEntry("projects") as never];
			draft.customSections = [{ ...structuredClone(draft.sections.skills), id: "custom-1", type: "skills" } as never];
		});

		expect(getOutlineRows(data, new Set(["summary"])).map((row) => row.id)).toEqual([
			"summary",
			"experience",
			"projects",
			"custom-1",
		]);
		expect(isSectionInUse(data, "summary")).toBe(false);
	});

	it("moves a section before a row when moving up and after it when moving down", () => {
		const data = resume((draft) => withEntries(draft, "experience", "education", "skills"));
		const up = produce(data, (draft) =>
			moveSection(draft, "education", { id: "experience", page: 0, column: "main" }, "up"),
		);
		expect(up.metadata.layout.pages[0]?.main).toEqual(["summary", "education", "experience"]);

		const down = produce(data, (draft) =>
			moveSection(draft, "experience", { id: "education", page: 0, column: "main" }, "down"),
		);
		expect(down.metadata.layout.pages[0]?.main).toEqual(["summary", "education", "experience"]);
	});

	it("changes column when a section moves across the sidebar divider", () => {
		const data = resume((draft) => withEntries(draft, "experience", "skills"));
		const moved = produce(data, (draft) =>
			moveSection(draft, "skills", { id: "experience", page: 0, column: "main" }, "up"),
		);
		expect(moved.metadata.layout.pages[0]).toMatchObject({
			main: ["summary", "skills", "experience", "education"],
			sidebar: [],
		});
	});
});

describe("add section", () => {
	it("shows and places a built-in section with one draft entry", () => {
		const data = resume((draft) => {
			draft.sections.projects.hidden = true;
		});
		let entryId: string | null = null;
		const next = produce(data, (draft) => {
			entryId = addBuiltinSection(draft, "projects");
		});

		expect(next.sections.projects.hidden).toBe(false);
		expect(next.metadata.layout.pages[0]?.main).toContain("projects");
		expect(next.sections.projects.items).toHaveLength(1);
		expect(next.sections.projects.items[0]?.id).toBe(entryId);
		expect(isDraftEntry("projects", next.sections.projects.items[0] as never)).toBe(true);
	});

	it("creates a custom section of a type, named and placed, with one draft entry", () => {
		let ids = { sectionId: "", entryId: "" };
		const next = produce(resume(), (draft) => {
			ids = addCustomSection(draft, "awards", "Honours");
		});

		expect(resolveSection(next, ids.sectionId)).toEqual({ id: ids.sectionId, kind: "custom", type: "awards" });
		expect(next.customSections[0]).toMatchObject({ title: "Honours", items: [{ id: ids.entryId }] });
		expect(next.metadata.layout.pages[0]?.main.at(-1)).toBe(ids.sectionId);
	});
});

describe("countEntriesToCheck", () => {
	it("counts entries whose dates, or whose roles' dates, still carry text to review", () => {
		const raw = { start: null, end: null, present: false, raw: "Summer 2016" };
		const exact = { start: "2016", end: null, present: false };
		const entries = [
			{ ...createEntry("experience"), dates: raw },
			{
				...createEntry("experience"),
				dates: exact,
				roles: [{ id: "r", position: "", period: "", description: "", dates: raw }],
			},
			{ ...createEntry("experience"), dates: exact },
		];
		expect(countEntriesToCheck(entries as never)).toBe(2);
	});
});
