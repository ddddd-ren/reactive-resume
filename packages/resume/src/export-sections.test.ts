import { describe, expect, it } from "vitest";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { sampleResumeData } from "@reactive-resume/schema/resume/sample";
import { copyCoverLetterStyle, createCoverLetterResumeData } from "./cover-letter";
import { getResumeExportData, resumeHasCoverLetter } from "./export-sections";

// Letters render through the same templates: a letter's document is resume data with one cover-letter section.
// Here the sample resume carries one too, as resumes did before letters became documents of their own.
const LETTER_ID = "letter-section";
const withLetter = () => {
	const data = structuredClone(sampleResumeData);
	const letter = createCoverLetterResumeData({
		name: "Cover Letter",
		recipient: "<p>Hiring Manager</p>",
		content: "<p>Dear Hiring Manager,</p>",
		style: copyCoverLetterStyle(data, LETTER_ID, "letter-item"),
	});
	data.customSections.push(...letter.customSections);
	data.metadata.layout.pages.push({ fullWidth: true, main: [LETTER_ID], sidebar: [] });
	return data;
};

describe("resume export sections", () => {
	it("detects visible cover letter sections", () => {
		expect(resumeHasCoverLetter(defaultResumeData)).toBe(false);
		expect(resumeHasCoverLetter(sampleResumeData)).toBe(false);
		expect(resumeHasCoverLetter(withLetter())).toBe(true);
	});

	it("removes cover letter sections from resume-only exports", () => {
		const data = getResumeExportData(withLetter(), "resume");

		expect(data.customSections.some((section) => section.type === "cover-letter")).toBe(false);
		expect(data.metadata.layout.pages.flatMap((page) => [...page.main, ...page.sidebar])).not.toContain(LETTER_ID);
	});

	it("keeps only cover letter sections for cover-letter exports", () => {
		const data = getResumeExportData(withLetter(), "cover-letter");

		expect(data.customSections).toHaveLength(1);
		expect(data.customSections[0]?.type).toBe("cover-letter");
		expect(data.metadata.layout.pages).toEqual([{ fullWidth: true, main: [LETTER_ID], sidebar: [] }]);
	});
});
