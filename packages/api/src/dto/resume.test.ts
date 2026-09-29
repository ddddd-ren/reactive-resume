import { describe, expect, it } from "vitest";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { resumeDto } from "./resume";

describe("resume DTO output validation", () => {
	it("normalizes ordinary PUT data without losing compatible custom-section overlap", () => {
		const parsed = resumeDto.update.input.parse({
			id: "resume-id",
			data: {
				...structuredClone(defaultResumeData),
				customSections: [
					{
						id: "custom-experience",
						type: "experience",
						title: "Experience",
						icon: "",
						columns: 1,
						hidden: false,
						keepTogether: false,
						startOnNewPage: false,
						items: [
							{
								id: "experience-item",
								hidden: false,
								company: "Analytical Engines",
								position: "Programmer",
								location: "London",
								period: "1842–1843",
								description: "<p>Wrote the first algorithm.</p>",
								content: "<p>Compatible overlap</p>",
							},
						],
					},
				],
			},
		});

		expect(parsed.data?.customSections[0]?.items[0]).toMatchObject({
			content: "<p>Compatible overlap</p>",
			roles: [],
			website: { url: "", label: "", inlineLink: false },
		});
	});

	it("continues to accept metadata-only updates without resume data", () => {
		expect(resumeDto.update.input.parse({ id: "resume-id", name: "Renamed" })).toEqual({
			id: "resume-id",
			name: "Renamed",
		});
	});
});
