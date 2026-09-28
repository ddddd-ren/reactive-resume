import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import {
	ACCENTS,
	applyFontPairing,
	applyTextSize,
	contrastOnWhite,
	darkenForWhite,
	fitToPages,
	hexToRgba,
	matchDensity,
	matchFontPairing,
	matchMargins,
	nextFitStep,
	rgbaToHex,
} from "./presets";

const metadata = () => structuredClone(defaultResumeData.metadata);

describe("presets", () => {
	it("calibrates Normal density and margins to today's defaults, so existing resumes don't change", () => {
		expect(matchDensity(metadata())).toBe("normal");
		expect(matchMargins(metadata())).toBe("normal");
	});

	it("applies a font pairing and recognises it", () => {
		const next = produce(metadata(), (draft) => applyFontPairing(draft, "classic"));
		expect(next.typography).toMatchObject({ heading: { fontFamily: "Lora" }, body: { fontFamily: "Source Sans 3" } });
		expect(matchFontPairing(next)).toBe("classic");
		// Today's default (Plex Serif for both) is no pairing, so nothing shows as selected.
		expect(matchFontPairing(metadata())).toBeNull();
	});

	it("scales the heading with the text size", () => {
		const next = produce(metadata(), (draft) => applyTextSize(draft, 11));
		expect(next.typography.body.fontSize).toBe(11);
		expect(next.typography.heading.fontSize).toBe(15.5);
	});
});

describe("colour", () => {
	it("measures contrast against white", () => {
		expect(contrastOnWhite("#FFFFFF")).toBeCloseTo(1, 5);
		expect(contrastOnWhite("#000000")).toBeCloseTo(21, 0);
		for (const accent of ACCENTS) expect(contrastOnWhite(accent.hex)).toBeGreaterThanOrEqual(4.5);
	});

	it("darkens a light colour until it reads on white", () => {
		const darker = darkenForWhite("#8FD18F");
		expect(contrastOnWhite(darker)).toBeGreaterThanOrEqual(4.6);
		expect(darkenForWhite("#3E6B4F")).toBe("#3E6B4F");
	});

	it("converts between hex and the stored rgba", () => {
		expect(hexToRgba("#3E6B4F")).toBe("rgba(62, 107, 79, 1)");
		expect(rgbaToHex("rgba(62, 107, 79, 1)")).toBe("#3E6B4F");
		expect(rgbaToHex("not a colour")).toBeNull();
	});
});

describe("Fit to one page", () => {
	it("tightens density, then margins, then size, never below 9 pt", () => {
		expect(nextFitStep({ density: "roomy", margins: "wide", size: 10 })).toEqual({ density: "normal" });
		expect(nextFitStep({ density: "compact", margins: "wide", size: 10 })).toEqual({ margins: "normal" });
		expect(nextFitStep({ density: "compact", margins: "narrow", size: 10 })).toEqual({ size: 9.5 });
		expect(nextFitStep({ density: "compact", margins: "narrow", size: 9 })).toBeNull();
		// Values that match no preset jump straight to the tightest one.
		expect(nextFitStep({ density: null, margins: null, size: 10 })).toEqual({ density: "compact" });
	});

	it("stops as soon as the page fits", async () => {
		const applied: unknown[] = [];
		let pagesLeft = 2;
		const result = await fitToPages(
			{ density: "normal", margins: "normal", size: 10 },
			(step) => applied.push(step),
			async () => pagesLeft-- <= 0,
		);
		expect(result.fits).toBe(true);
		expect(applied).toEqual([{ density: "compact" }, { margins: "narrow" }]);
		expect(result.state).toEqual({ density: "compact", margins: "narrow", size: 10 });
	});

	it("gives up at 9 pt", async () => {
		const result = await fitToPages(
			{ density: "compact", margins: "narrow", size: 9.5 },
			() => undefined,
			async () => false,
		);
		expect(result).toEqual({ fits: false, state: { density: "compact", margins: "narrow", size: 9 } });
	});
});
