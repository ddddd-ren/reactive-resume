import { beforeAll, describe, expect, it } from "vitest";
import { i18n } from "@lingui/core";
import { formatTimeSince, formatVersionTime, getVersionTitle, summarizeViews } from "./format";

beforeAll(() => i18n.loadAndActivate({ locale: "en-US", messages: {} }));

const day = (date: string, views: number, downloads = 0) => ({ date, views, downloads });

describe("summarizeViews", () => {
	it("totals the last 30 days and scales each day against the peak", () => {
		const daily = [
			day("2026-08-01", 50),
			...Array.from({ length: 29 }, (_, index) => day(`d${index}`, 1, 1)),
			day("today", 4, 2),
		];

		const summary = summarizeViews(daily);

		expect(summary.bars).toHaveLength(30);
		expect(summary.views).toBe(29 + 4);
		expect(summary.downloads).toBe(29 + 2);
		expect(summary.peak).toBe(4);
		expect(summary.bars.at(-1)?.height).toBe(1);
		expect(summary.bars[0]?.height).toBe(0.25);
	});

	it("draws flat bars when nobody has looked yet", () => {
		expect(summarizeViews([day("a", 0), day("b", 0)])).toMatchObject({
			views: 0,
			peak: 0,
			bars: [{ height: 0 }, { height: 0 }],
		});
	});
});

describe("formatTimeSince", () => {
	const now = new Date("2026-09-28T12:00:00Z").getTime();
	const ago = (ms: number) => new Date(now - ms);

	it.each([
		[5 * 60 * 1000, "5m"],
		[2 * 60 * 60 * 1000, "2h"],
		[3 * 24 * 60 * 60 * 1000, "3d"],
		[20 * 24 * 60 * 60 * 1000, "2w"],
		[400 * 24 * 60 * 60 * 1000, "1y"],
	])("writes %i ms as %s", (elapsed, expected) => {
		expect(formatTimeSince(ago(elapsed), "en-US", now)).toBe(expected);
	});
});

describe("formatVersionTime", () => {
	const now = new Date(2026, 8, 28, 15, 0);

	it("names today and yesterday, then dates, with the year only when it differs", () => {
		expect(formatVersionTime(new Date(2026, 8, 28, 14, 2), "en-US", now)).toMatch(/^Today 0?2:02 PM$|^Today 14:02$/);
		expect(formatVersionTime(new Date(2026, 8, 27, 9, 15), "en-US", now)).toMatch(/^Yesterday/);
		expect(formatVersionTime(new Date(2026, 8, 16), "en-US", now)).toBe("Sep 16");
		expect(formatVersionTime(new Date(2025, 8, 16), "en-US", now)).toBe("Sep 16, 2025");
	});
});

describe("getVersionTitle", () => {
	it("uses the user's name for a named version and the kind otherwise", () => {
		expect(getVersionTitle({ kind: "named", name: "Sent to Lumen" })).toBe("Sent to Lumen");
		expect(getVersionTitle({ kind: "import", name: null })).toBe("Imported");
		expect(getVersionTitle({ kind: "auto", name: null })).toBe("Editing session");
	});
});
