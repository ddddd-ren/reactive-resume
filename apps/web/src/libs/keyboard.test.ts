import type { KeyboardEvent } from "react";
import { describe, expect, it } from "vitest";
import { isImeComposing } from "./keyboard";

const keydown = (init: { isComposing?: boolean; keyCode?: number }) =>
	({ nativeEvent: { isComposing: init.isComposing ?? false }, keyCode: init.keyCode ?? 13 }) as KeyboardEvent;

describe("isImeComposing", () => {
	it("is true while composing or for Safari's post-composition Enter", () => {
		expect(isImeComposing(keydown({ isComposing: true }))).toBe(true);
		expect(isImeComposing(keydown({ keyCode: 229 }))).toBe(true);
	});

	it("is false for a plain Enter", () => {
		expect(isImeComposing(keydown({}))).toBe(false);
	});
});
