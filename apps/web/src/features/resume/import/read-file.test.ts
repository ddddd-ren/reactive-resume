import { beforeAll, describe, expect, it } from "vitest";
import { i18n } from "@lingui/core";
import { parseResumeData } from "@reactive-resume/schema/resume/data";
import { sampleResumeData } from "@reactive-resume/schema/resume/sample";
import { detectImportKind, detectJsonImportKind, parseResumeJson, summarizeImport } from "./read-file";

beforeAll(() => i18n.loadAndActivate({ locale: "en-US", messages: {} }));

describe("detectJsonImportKind", () => {
	it("detects JSON Resume by a top-level basics without Reactive Resume sections/metadata", () => {
		expect(detectJsonImportKind({ basics: { name: "A" }, work: [] })).toBe("json-resume-json");
	});

	it("detects the current Reactive Resume schema by metadata.page", () => {
		expect(detectJsonImportKind({ basics: {}, sections: {}, metadata: { page: { locale: "en-US" } } })).toBe(
			"reactive-resume-json",
		);
	});

	it("detects the legacy v4 schema by metadata without a page key, or by a v4 layout", () => {
		expect(detectJsonImportKind({ basics: {}, sections: {}, metadata: { template: "azurill" } })).toBe(
			"reactive-resume-v4-json",
		);
		expect(
			detectJsonImportKind({
				basics: {},
				sections: {},
				metadata: { layout: [[["experience"], ["skills"]]], page: { margin: 14, format: "a4" } },
			}),
		).toBe("reactive-resume-v4-json");
	});

	it("detects a saved cover letter", () => {
		expect(detectJsonImportKind({ format: "reactive-resume-cover-letter", version: 1, name: "Letter" })).toBe(
			"cover-letter-json",
		);
	});

	it("returns null for unrecognized shapes", () => {
		expect(detectJsonImportKind({})).toBeNull();
		expect(detectJsonImportKind({ foo: "bar" })).toBeNull();
		expect(detectJsonImportKind(null)).toBeNull();
		expect(detectJsonImportKind("nope")).toBeNull();
	});
});

describe("detectImportKind", () => {
	const file = (bytes: BlobPart, name: string, type = "") => new File([bytes], name, { type });

	it("reads PDFs by their magic bytes, whatever the name", async () => {
		expect(await detectImportKind(file("%PDF-1.7", "resume"))).toBe("pdf");
	});

	it("prefers LinkedIn for .zip and Word for other ZIP containers", async () => {
		const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
		expect(await detectImportKind(file(zip, "Basic_LinkedInDataExport.zip"))).toBe("linkedin");
		expect(await detectImportKind(file(zip, "resume.docx"))).toBe("docx");
	});

	it("reads JSON by its shape", async () => {
		expect(await detectImportKind(file(JSON.stringify({ basics: {}, work: [] }), "resume.json"))).toBe(
			"json-resume-json",
		);
		expect(await detectImportKind(file("{nope", "broken.json"))).toBeNull();
		// Downloads can arrive without an extension or a type; the first character gives JSON away.
		expect(await detectImportKind(file(`  {"format":"reactive-resume-cover-letter"}`, "33ae6e21"))).toBe(
			"cover-letter-json",
		);
	});
});

describe("parseResumeJson", () => {
	it("keeps a selected v4 import from falling back to JSON Resume", () => {
		expect(() => parseResumeJson("{}", "reactive-resume-v4-json")).toThrow(/v4/i);
	});
});

describe("parseResumeJson (legacy styles)", () => {
	it("converts an old export's legacy style rules into its stylesheet", () => {
		const data = structuredClone(sampleResumeData);
		data.metadata.stylesheet = undefined;
		data.metadata.styleRules = [
			{
				id: "r",
				label: "Teal headings",
				enabled: true,
				target: { scope: "global" },
				slots: { heading: { color: "#0f766e" } },
			},
		];

		const imported = parseResumeJson(JSON.stringify(data), "reactive-resume-json");

		expect(imported.metadata.stylesheet?.mode).toBe("semantic");
		expect(imported.metadata.stylesheet?.source.text).toContain("color: #0f766e;");
	});
});

describe("summarizeImport", () => {
	it("counts sections with content, their entries and dates flagged for a look", () => {
		const data = parseResumeData(structuredClone(sampleResumeData));
		const experience = data.sections.experience.items[0];
		if (experience?.dates) experience.dates = { ...experience.dates, raw: "Summer 2016" };

		const summary = summarizeImport(data);

		expect(summary.sections).toBeGreaterThan(3);
		expect(summary.entries).toBeGreaterThanOrEqual(summary.sections - 1);
		expect(summary.flagged).toBe(1);
	});
});
