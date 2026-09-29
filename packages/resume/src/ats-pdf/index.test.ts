import { describe, expect, it } from "vitest";
import { PDF_ATS_RULE_CODES } from "./catalog";
import { analyzePdfResume } from "./index";
import { healthyResume, makeRawExtraction } from "./test-fixtures";

const NOW = new Date("2024-06-15T00:00:00Z");

describe("analyzePdfResume", () => {
	it("scores a clean single-column resume at the top of the range", () => {
		const report = analyzePdfResume(healthyResume(), { now: NOW });

		expect(report.score).toBe(100);
		expect(report.findings).toEqual([]);
		expect(report.cappedBy).toEqual([]);
	});

	it("separates unscored tips from scored findings", () => {
		const report = analyzePdfResume(healthyResume({ file: { sizeBytes: 1_500_000 } }), { now: NOW });

		expect(report.tips.map((tip) => tip.code)).toContain("LARGE_FILE_SIZE");
		expect(report.findings.map((finding) => finding.code)).not.toContain("LARGE_FILE_SIZE");
		expect(report.findings.every((finding) => finding.severity !== "tip")).toBe(true);
	});

	it("attaches evidence a reader can check against the file", () => {
		const report = analyzePdfResume(
			makeRawExtraction({
				lines: ["Ada Lovelace analytical engineer at the engines", { text: "ada@example.com", y: 4 }],
			}),
			{ now: NOW },
		);

		const marginFinding = report.findings.find((finding) => finding.code === "TEXT_IN_MARGIN_ZONE");
		expect(marginFinding?.evidence?.snippet).toBe("ada@example.com");
		expect(marginFinding?.evidence?.page).toBe(1);
	});

	it("keeps job-description coverage out of the score", () => {
		const jobDescription = "Requirements\n- Strong Kubernetes and Terraform experience";

		const withJd = analyzePdfResume(healthyResume(), { now: NOW, jobDescription });
		const withoutJd = analyzePdfResume(healthyResume(), { now: NOW });

		expect(withJd.score).toBe(withoutJd.score);
		expect(withJd.jd?.missingTerms).toContain("kubernetes");
		expect(withoutJd.jd).toBeNull();
	});

	it("keeps going when a page is malformed rather than failing the whole report", () => {
		const broken = makeRawExtraction({ lines: ["Ada Lovelace analytical engineer at the engines"] });
		// A page the reader described with nonsense geometry.
		const mutated = {
			...broken,
			pages: broken.pages.map((page) => ({ ...page, width: Number.NaN, height: Number.NaN })),
		};

		const report = analyzePdfResume(mutated, { now: NOW });

		expect(Number.isInteger(report.score)).toBe(true);
		expect(report.checks).toHaveLength(PDF_ATS_RULE_CODES.length);
	});
});
