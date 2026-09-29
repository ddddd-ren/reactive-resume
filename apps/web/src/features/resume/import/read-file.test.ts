import { beforeAll, describe, expect, it } from "vitest";
import { i18n } from "@lingui/core";
import { sampleResumeData } from "@reactive-resume/schema/resume/sample";
import { detectImportKind, detectJsonImportKind, parseResumeJson } from "./read-file";

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
});

describe("detectImportKind", () => {
	const file = (bytes: BlobPart, name: string, type = "") => new File([bytes], name, { type });

	it("prefers LinkedIn for .zip and Word for other ZIP containers", async () => {
		const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
		expect(await detectImportKind(file(zip, "Basic_LinkedInDataExport.zip"))).toBe("linkedin");
		expect(await detectImportKind(file(zip, "resume.docx"))).toBe("docx");
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
