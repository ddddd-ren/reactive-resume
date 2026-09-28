// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/resume/editor/store";
import { useEditorMode } from "./use-editor-mode";

const router = vi.hoisted(() => ({
	search: {} as { mode?: "write" | "design" | "check" },
	navigations: [] as { mode?: string; resolve: () => void }[],
}));

vi.mock("@tanstack/react-router", () => ({
	getRouteApi: () => ({
		useSearch: () => router.search,
		useNavigate: () => (options: { search: (current: typeof router.search) => { mode?: string } }) =>
			new Promise<void>((resolve) => {
				router.navigations.push({ mode: options.search(router.search).mode, resolve });
			}),
	}),
}));

afterEach(() => {
	router.search = {};
	router.navigations = [];
	useEditorStore.getState().reset();
});

describe("useEditorMode", () => {
	it("follows ?mode=, defaulting to write", () => {
		router.search = { mode: "check" };
		expect(renderHook(() => useEditorMode()).result.current[0]).toBe("check");

		router.search = {};
		expect(renderHook(() => useEditorMode()).result.current[0]).toBe("write");
	});

	it("shows a picked mode before the URL catches up, then hands over to the URL", async () => {
		const { result, rerender } = renderHook(() => useEditorMode());

		act(() => result.current[1]("design"));
		expect(result.current[0]).toBe("design");
		expect(router.navigations.map((navigation) => navigation.mode)).toEqual(["design"]);

		router.search = { mode: "design" };
		await act(async () => router.navigations[0]?.resolve());
		rerender();
		expect(useEditorStore.getState().pendingMode).toBeNull();
		expect(result.current[0]).toBe("design");
	});

	it("keeps the latest pick when an earlier navigation settles first", async () => {
		const { result } = renderHook(() => useEditorMode());

		act(() => result.current[1]("design"));
		act(() => result.current[1]("write"));
		expect(router.navigations.map((navigation) => navigation.mode)).toEqual(["design", undefined]);

		await act(async () => router.navigations[0]?.resolve());
		expect(result.current[0]).toBe("write");

		await act(async () => router.navigations[1]?.resolve());
		expect(useEditorStore.getState().pendingMode).toBeNull();
		expect(result.current[0]).toBe("write");
	});
});
