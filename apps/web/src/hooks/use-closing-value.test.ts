// @vitest-environment happy-dom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useClosingValue } from "./use-closing-value";

describe("useClosingValue", () => {
	it("holds the last value while closing and drops it once the exit completes", () => {
		const { result, rerender } = renderHook(({ value }: { value: string | null }) => useClosingValue(value), {
			initialProps: { value: "a" as string | null },
		});
		expect(result.current[0]).toBe("a");

		rerender({ value: null });
		expect(result.current[0]).toBe("a");

		act(() => result.current[1](false));
		expect(result.current[0]).toBeNull();
	});

	it("follows a new value at once and ignores an open completion", () => {
		const { result, rerender } = renderHook(({ value }: { value: string | null }) => useClosingValue(value), {
			initialProps: { value: "a" as string | null },
		});
		rerender({ value: "b" });
		expect(result.current[0]).toBe("b");

		act(() => result.current[1](true));
		expect(result.current[0]).toBe("b");
	});
});
