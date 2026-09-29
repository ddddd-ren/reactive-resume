import type { Application } from "./types";
import { describe, expect, it } from "vitest";
import { getNextStep } from "./next-step";

const NOW = new Date("2026-09-28T12:00:00Z");
const day = (offset: number) => new Date(NOW.getTime() + offset * 86_400_000);

type Source = Parameters<typeof getNextStep>[0];

const application = (patch: Partial<Source> = {}): Source => ({
	status: "applied",
	activity: [{ id: "s1", type: "stage", stage: "applied", at: day(-3) }],
	followUpAt: null,
	followUpNote: null,
	appliedAt: day(-3),
	...patch,
});

const interview = (at: Date, id = "i1"): Application["activity"][number] => ({
	id,
	type: "interview",
	at,
	kind: "onsite",
	durationMinutes: 60,
	location: "",
	notes: "",
});

describe("getNextStep", () => {
	it("puts the earliest interview still to come first", () => {
		const step = getNextStep(
			application({
				status: "interview",
				followUpAt: day(1),
				activity: [interview(day(-2), "past"), interview(day(5), "later"), interview(day(2), "soon")],
			}),
			NOW,
		);
		expect(step).toMatchObject({ kind: "interview", interview: { id: "soon" } });
	});

	it("falls back to the follow-up date, overdue once it has passed", () => {
		expect(getNextStep(application({ followUpAt: day(2), followUpNote: "Email Maya" }), NOW)).toMatchObject({
			kind: "follow-up",
			note: "Email Maya",
			overdue: false,
		});
		const late = getNextStep(application({ followUpAt: day(-1) }), NOW);
		expect(late).toMatchObject({ kind: "follow-up", overdue: true });
	});

	it("suggests a follow-up after ten days without a reply, and counts the wait before that", () => {
		expect(getNextStep(application(), NOW)).toEqual({ kind: "waiting", days: 3 });
		const quiet = application({ activity: [{ id: "s1", type: "stage", stage: "applied", at: day(-12) }] });
		expect(getNextStep(quiet, NOW)).toEqual({ kind: "no-reply", days: 12 });
	});

	it("has nothing next for saved and closed applications beyond their state", () => {
		expect(getNextStep(application({ status: "saved" }), NOW)).toEqual({ kind: "not-applied" });
		expect(getNextStep(application({ status: "closed", followUpAt: day(1) }), NOW)).toEqual({ kind: "closed" });
	});
});
