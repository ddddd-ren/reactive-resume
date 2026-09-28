import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBreakpoint } from "./use-breakpoint";

let width = 1440;
const listeners = new Set<() => void>();

Object.defineProperty(window, "matchMedia", {
	writable: true,
	configurable: true,
	value: vi.fn().mockImplementation((query: string) => {
		const min = Number(/min-width: (\d+)px/.exec(query)?.[1] ?? 0);
		return {
			get matches() {
				return width >= min;
			},
			media: query,
			addEventListener: (_: string, listener: () => void) => listeners.add(listener),
			removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
		};
	}),
});

afterEach(() => {
	width = 1440;
});

describe("useBreakpoint", () => {
	it.each([
		[390, "mobile"],
		[639, "mobile"],
		[640, "tablet"],
		[1023, "tablet"],
		[1024, "desktop"],
		[1279, "desktop"],
		[1280, "wide"],
	] as const)("maps %ipx to %s", (nextWidth, expected) => {
		width = nextWidth;
		const { result } = renderHook(() => useBreakpoint());
		expect(result.current).toBe(expected);
	});

	it("updates when the viewport crosses a breakpoint", () => {
		const { result } = renderHook(() => useBreakpoint());
		expect(result.current).toBe("wide");

		act(() => {
			width = 800;
			for (const listener of listeners) listener();
		});

		expect(result.current).toBe("tablet");
	});
});
