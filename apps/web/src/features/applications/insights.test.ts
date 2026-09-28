import type { StageCount } from "./insights";
import { describe, expect, it } from "vitest";
import { computeInsights, computeOutcomes } from "./insights";

const byStage: StageCount[] = [
	{ status: "saved", count: 2 },
	{ status: "applied", count: 3 },
	{ status: "screening", count: 2 },
	{ status: "interview", count: 1 },
	{ status: "offer", count: 1 },
	{ status: "closed", count: 2 },
];

describe("computeInsights", () => {
	it("totals every stage including closed", () => {
		expect(computeInsights(byStage).total).toBe(11);
	});

	it("computes cumulative reach down the forward funnel", () => {
		const { funnel } = computeInsights(byStage);
		// saved reached = all forward stages = 2+3+2+1+1 = 9
		expect(funnel[0]?.reached).toBe(9);
		// offer reached = 1 (just the offer bucket)
		expect(funnel.at(-1)?.reached).toBe(1);
	});

	it("derives tiles (applied past saved, interviews, offers)", () => {
		const tiles = Object.fromEntries(computeInsights(byStage).tiles.map((tile) => [tile.label, tile.value]));
		expect(tiles.Applied).toBe("7"); // everything past saved
		expect(tiles.Interviews).toBe("2"); // interview + offer
		expect(tiles.Offers).toBe("1");
	});

	it("handles an empty pipeline without dividing by zero", () => {
		const empty = computeInsights([]);
		expect(empty.total).toBe(0);
		expect(empty.funnel[0]?.pct).toBe(0);
	});
});

describe("computeOutcomes", () => {
	const at = (day: number) => new Date(Date.UTC(2026, 8, day, 12));
	const stage = (stage: StageCount["status"], day: number) => ({
		id: `${stage}${day}`,
		type: "stage" as const,
		stage,
		at: at(day),
	});

	const applications = [
		// Sent on the 1st, heard back (screening) on the 5th, then turned down.
		{
			status: "closed" as const,
			closedReason: "not-selected" as const,
			resumeId: "tailored",
			appliedAt: at(1),
			activity: [stage("applied", 1), stage("screening", 5), stage("closed", 9)],
		},
		// Sent on the 2nd, interview on the 12th.
		{
			status: "interview" as const,
			closedReason: null,
			resumeId: "base",
			appliedAt: at(2),
			activity: [stage("saved", 1), stage("applied", 2), stage("interview", 12)],
		},
		// Sent, no reply yet.
		{
			status: "applied" as const,
			closedReason: null,
			resumeId: "base",
			appliedAt: at(3),
			activity: [stage("applied", 3)],
		},
		// Never sent.
		{ status: "saved" as const, closedReason: null, resumeId: null, appliedAt: at(4), activity: [stage("saved", 4)] },
	];

	const outcomes = computeOutcomes(applications, (application) => application.resumeId === "tailored");

	it("counts every application that reached each stage, closed ones included", () => {
		expect(outcomes.funnel).toEqual([
			{ status: "applied", reached: 3 },
			{ status: "screening", reached: 2 },
			{ status: "interview", reached: 1 },
			{ status: "offer", reached: 0 },
		]);
	});

	it("measures replies and the median days to the first one", () => {
		expect(outcomes.sent).toBe(3);
		expect(outcomes.heardBack).toBe(2);
		expect(outcomes.medianDaysToReply).toBe(7); // 4 and 10 days
	});

	it("compares resumes made for the job with the base resume", () => {
		expect(outcomes.tailored).toEqual({ sent: 1, replied: 1 });
		expect(outcomes.base).toEqual({ sent: 2, replied: 1 });
	});
});
