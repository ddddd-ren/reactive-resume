import { describe, expect, it } from "vitest";
import { copyCoverLetterStyle, createCoverLetterResumeData } from "@reactive-resume/resume/cover-letter";
import { sampleResumeData } from "@reactive-resume/schema/resume/sample";
import { shouldShowResumeHeader } from "./cover-letter";

// A letter's document: resume data with one cover-letter section, as the letter export builds it.
const createCoverLetterOnlyData = () =>
	createCoverLetterResumeData({
		name: "Cover Letter",
		recipient: "<p>Hiring Manager</p>",
		content: "<p>Dear Hiring Manager,</p>",
		style: copyCoverLetterStyle(sampleResumeData, "letter-section", "letter-item"),
	});

describe("shouldShowResumeHeader", () => {
	it("hides the header when every visible layout section is a cover letter", () => {
		expect(shouldShowResumeHeader(createCoverLetterOnlyData(), 0)).toBe(false);
	});

	it("can keep the first-page header for cover letter documents", () => {
		const data = { ...createCoverLetterOnlyData(), renderOptions: { includeCoverLetterHeader: true } };

		expect(shouldShowResumeHeader(data, 0)).toBe(true);
		expect(shouldShowResumeHeader(data, 1)).toBe(false);
	});

	it("keeps the first-page header for normal resume documents", () => {
		expect(shouldShowResumeHeader(sampleResumeData, 0)).toBe(true);
		expect(shouldShowResumeHeader(sampleResumeData, 1)).toBe(false);
	});
});
