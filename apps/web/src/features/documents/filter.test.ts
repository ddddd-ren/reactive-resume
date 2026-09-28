import type { DocumentSummary } from "./filter";
import { describe, expect, it } from "vitest";
import { collectTags, daysLeftInTrash, filterDocuments } from "./filter";

const document = (patch: Partial<DocumentSummary>): DocumentSummary => ({
	type: "resume",
	id: patch.name ?? "id",
	name: "Resume",
	tags: [],
	isLocked: false,
	trashedAt: null,
	createdAt: new Date(2026, 0, 1),
	updatedAt: new Date(2026, 0, 1),
	application: null,
	...patch,
});

const documents = [
	document({
		name: "Product Designer",
		tags: ["design"],
		updatedAt: new Date(2026, 8, 3),
		createdAt: new Date(2026, 1, 1),
	}),
	document({
		name: "Letter to Lumen",
		type: "letter",
		updatedAt: new Date(2026, 8, 5),
		application: { id: "a1", company: "Lumen", role: "Designer" },
	}),
	document({
		name: "backend engineer",
		tags: ["design", "tech"],
		updatedAt: new Date(2026, 8, 1),
		createdAt: new Date(2026, 5, 1),
	}),
];

const all = { type: "all" as const, q: "", tags: [], sort: "edited" as const };
const names = (list: DocumentSummary[]) => list.map((item) => item.name);

describe("filterDocuments", () => {
	it("shows the newest edit first by default", () => {
		expect(names(filterDocuments(documents, all))).toEqual(["Letter to Lumen", "Product Designer", "backend engineer"]);
	});

	it("filters by type and by every chosen tag", () => {
		expect(names(filterDocuments(documents, { ...all, type: "letter" }))).toEqual(["Letter to Lumen"]);
		expect(names(filterDocuments(documents, { ...all, tags: ["design", "tech"] }))).toEqual(["backend engineer"]);
	});

	it("searches titles, tags and linked applications, ignoring case", () => {
		expect(names(filterDocuments(documents, { ...all, q: "lumen" }))).toEqual(["Letter to Lumen"]);
		expect(names(filterDocuments(documents, { ...all, q: "TECH" }))).toEqual(["backend engineer"]);
		expect(names(filterDocuments(documents, { ...all, q: "designer" }))).toEqual([
			"Letter to Lumen",
			"Product Designer",
		]);
	});

	it("sorts by name without regard to case, or by newest creation", () => {
		expect(names(filterDocuments(documents, { ...all, sort: "name" }))).toEqual([
			"backend engineer",
			"Letter to Lumen",
			"Product Designer",
		]);
		expect(names(filterDocuments(documents, { ...all, sort: "created" }))[0]).toBe("backend engineer");
	});
});

describe("collectTags", () => {
	it("lists each tag once, alphabetically", () => {
		expect(collectTags(documents)).toEqual(["design", "tech"]);
	});
});

describe("daysLeftInTrash", () => {
	it("counts down from 30 days and stops at 0", () => {
		const now = new Date(2026, 8, 28).getTime();
		expect(daysLeftInTrash(new Date(2026, 8, 25), now)).toBe(27);
		expect(daysLeftInTrash(new Date(2026, 6, 1), now)).toBe(0);
	});
});
