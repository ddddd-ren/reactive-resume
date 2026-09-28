import { describe, expect, it } from "vitest";
import { formatDate, formatPeriod, formatSingleDate, toRangeDates, toSingleDates, toYearMonth } from "./date";

describe("formatDate", () => {
	it("formats YYYY-MM as 'Month Year'", () => {
		expect(formatDate("2024-03")).toBe("March 2024");
	});

	it("formats YYYY-MM-DD as 'Month Year' by default (day excluded)", () => {
		expect(formatDate("2024-03-15")).toBe("March 2024");
	});

	it("formats YYYY-MM-DD with includeDay=true as 'Month DD, Year'", () => {
		expect(formatDate("2024-03-15", true)).toBe("March 15, 2024");
	});

	it("returns YYYY unchanged when only year provided", () => {
		expect(formatDate("2024")).toBe("2024");
	});

	it("handles January (month 1)", () => {
		expect(formatDate("2024-01")).toBe("January 2024");
	});

	it("handles December (month 12)", () => {
		expect(formatDate("2024-12")).toBe("December 2024");
	});

	it("includes day even with single-digit days", () => {
		expect(formatDate("2024-03-05", true)).toBe("March 05, 2024");
	});

	it("returns 'undefined' month name when out-of-range month is supplied", () => {
		// Defensive: behavior documents what happens with bad input
		expect(formatDate("2024-13")).toBe("undefined 2024");
	});
});

describe("formatPeriod", () => {
	it("returns empty string when both dates missing", () => {
		expect(formatPeriod()).toBe("");
	});

	it("returns end date alone when start is missing", () => {
		expect(formatPeriod(undefined, "2024-05")).toBe("2024-05");
	});

	it("returns start - Present when end is missing", () => {
		expect(formatPeriod("2024-01")).toBe("January 2024 - Present");
	});

	it("formats both ends when both provided", () => {
		expect(formatPeriod("2020-06", "2024-03")).toBe("June 2020 - March 2024");
	});

	it("treats empty string start same as undefined", () => {
		expect(formatPeriod("", "2024-05")).toBe("2024-05");
	});

	it("treats empty string end same as undefined", () => {
		expect(formatPeriod("2024-01", "")).toBe("January 2024 - Present");
	});

	it("returns empty when start empty and end empty", () => {
		expect(formatPeriod("", "")).toBe("");
	});
});

describe("formatSingleDate", () => {
	it("returns empty string when date is undefined", () => {
		expect(formatSingleDate()).toBe("");
	});

	it("returns empty string when date is empty string", () => {
		expect(formatSingleDate("")).toBe("");
	});

	it("formats full date with day included", () => {
		expect(formatSingleDate("2024-03-15")).toBe("March 15, 2024");
	});

	it("formats year-month even with includeDay flag implied", () => {
		expect(formatSingleDate("2024-03")).toBe("March 2024");
	});

	it("returns plain year when only year present", () => {
		expect(formatSingleDate("2024")).toBe("2024");
	});
});

describe("structured dates", () => {
	it("keeps the year and month of ISO dates", () => {
		expect(toYearMonth("2024-01-15")).toBe("2024-01");
		expect(toYearMonth("2024")).toBe("2024");
		expect(toYearMonth("soon")).toBeNull();
	});

	it("marks a start without an end as ongoing", () => {
		expect(toRangeDates("2020-03", undefined)).toEqual({ start: "2020-03", end: null, present: true });
		expect(toRangeDates("2020-03", "2021")).toEqual({ start: "2020-03", end: "2021", present: false });
		expect(toSingleDates("2019-11-02")).toEqual({ start: "2019-11", end: null, present: false });
	});
});
