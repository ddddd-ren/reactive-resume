// @vitest-environment happy-dom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveTheme } from "@/libs/theme";

vi.mock("@tanstack/react-router", () => ({
	useRouter: () => ({ invalidate: vi.fn() }),
}));

const { ThemeProvider, useTheme } = await import("./provider");

let systemIsDark = false;
const listeners = new Set<() => void>();
Object.defineProperty(window, "matchMedia", {
	writable: true,
	configurable: true,
	value: vi.fn().mockImplementation((query: string) => ({
		get matches() {
			return query.includes("prefers-color-scheme: dark") && systemIsDark;
		},
		media: query,
		addEventListener: (_: string, listener: () => void) => listeners.add(listener),
		removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
	})),
});

afterEach(() => {
	systemIsDark = false;
	document.documentElement.classList.remove("dark");
});

describe("resolveTheme", () => {
	it("follows the system only for the system preference", () => {
		expect(resolveTheme("system", true)).toBe("dark");
		expect(resolveTheme("system", false)).toBe("light");
		expect(resolveTheme("light", true)).toBe("light");
		expect(resolveTheme("dark", false)).toBe("dark");
	});
});

describe("useTheme", () => {
	it("throws when used outside ThemeProvider", () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(() => renderHook(() => useTheme())).toThrow(/useTheme must be used within a ThemeProvider/);
		consoleError.mockRestore();
	});

	it("returns the chosen and resolved theme with helpers", () => {
		const { result } = renderHook(() => useTheme(), {
			wrapper: ({ children }) => <ThemeProvider theme="dark">{children}</ThemeProvider>,
		});

		expect(result.current.theme).toBe("dark");
		expect(result.current.resolvedTheme).toBe("dark");
		expect(typeof result.current.setTheme).toBe("function");
		expect(typeof result.current.toggleTheme).toBe("function");
	});

	it("switches the whole app live when the system appearance changes", () => {
		const { result } = renderHook(() => useTheme(), {
			wrapper: ({ children }) => <ThemeProvider theme="system">{children}</ThemeProvider>,
		});
		expect(result.current.resolvedTheme).toBe("light");
		expect(document.documentElement.classList.contains("dark")).toBe(false);

		act(() => {
			systemIsDark = true;
			for (const listener of listeners) listener();
		});

		expect(result.current.resolvedTheme).toBe("dark");
		expect(document.documentElement.classList.contains("dark")).toBe(true);
	});
});
