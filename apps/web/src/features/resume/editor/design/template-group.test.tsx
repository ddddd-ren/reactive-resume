// @vitest-environment happy-dom
import type { Resume } from "@/features/resume/builder/draft";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { parseResumeData } from "@reactive-resume/schema/resume/data";
import { sampleResumeData } from "@reactive-resume/schema/resume/sample";
import { templateLayouts } from "@reactive-resume/schema/templates";
import { useResumeStore } from "@/features/resume/builder/draft";
import { useEditorStore } from "../store";
import { TemplateGroup } from "./template-group";

const toastState = vi.hoisted(() => ({ add: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({ useParams: () => ({ resumeId: "template-group" }) }));
vi.mock("@/libs/orpc/client", () => ({
	orpc: { resume: { update: { call: vi.fn(() => new Promise(() => undefined)) } } },
	streamClient: { resume: { updates: { subscribe: vi.fn() } } },
}));
vi.mock("@reactive-resume/ui/components/toast", () => ({ toast: { add: toastState.add, close: vi.fn() } }));
vi.mock("./thumbnails", () => ({ useTemplateThumbnail: () => ({ data: undefined }) }));

beforeAll(() => {
	i18n.loadAndActivate({ locale: "en-US", messages: {} });
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	useEditorStore.getState().reset();
	toastState.add.mockClear();
});

function renderGroup() {
	const resume: Resume = {
		id: "template-group",
		name: "Template group",
		slug: "template-group",
		tags: [],
		data: parseResumeData(structuredClone(sampleResumeData)),
		isLocked: false,
		updatedAt: new Date("2026-09-28T00:00:00.000Z"),
	};
	useResumeStore.getState().initialize(resume);

	render(
		<QueryClientProvider client={new QueryClient()}>
			<I18nProvider i18n={i18n}>
				<TemplateGroup />
			</I18nProvider>
		</QueryClientProvider>,
	);
}

const card = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}\\b`) });
const template = () => useResumeStore.getState().resume?.data.metadata.template;
const preview = () => useEditorStore.getState().previewTemplate;

describe("TemplateGroup", () => {
	it("previews on hover and restores the page when the pointer leaves the cards", () => {
		renderGroup();

		fireEvent.pointerEnter(card("Bronzor"), { pointerType: "mouse" });
		expect(preview()).toBe("bronzor");

		fireEvent.pointerLeave(card("Bronzor").parentElement as HTMLElement);
		expect(preview()).toBeNull();
	});

	it("restores the page on Escape", () => {
		renderGroup();

		fireEvent.focus(card("Onyx"));
		expect(preview()).toBe("onyx");

		fireEvent.keyDown(card("Onyx"), { key: "Escape" });
		expect(preview()).toBeNull();
	});

	it("applies a template on click, with an Undo toast", () => {
		renderGroup();
		const before = template();

		fireEvent.click(card("Bronzor"));

		expect(template()).toBe("bronzor");
		expect(card("Bronzor")).toHaveAttribute("aria-pressed", "true");
		expect(preview()).toBeNull();
		expect(toastState.add).toHaveBeenCalledWith(
			expect.objectContaining({ description: "Template changed to Bronzor" }),
		);

		act(() => useResumeStore.getState().undo());
		expect(template()).toBe(before);
	});

	it("previews on a touch hold without applying, and applies on a tap", () => {
		vi.useFakeTimers();
		renderGroup();
		const before = template();

		// Touch has no hover: entering doesn't preview.
		fireEvent.pointerEnter(card("Bronzor"), { pointerType: "touch" });
		expect(preview()).toBeNull();

		fireEvent.pointerDown(card("Bronzor"), { pointerType: "touch" });
		act(() => vi.advanceTimersByTime(400));
		expect(preview()).toBe("bronzor");

		fireEvent.pointerUp(card("Bronzor"), { pointerType: "touch" });
		fireEvent.click(card("Bronzor"));
		expect(preview()).toBeNull();
		expect(template()).toBe(before);

		fireEvent.pointerDown(card("Bronzor"), { pointerType: "touch" });
		act(() => vi.advanceTimersByTime(100));
		fireEvent.pointerUp(card("Bronzor"), { pointerType: "touch" });
		fireEvent.click(card("Bronzor"));
		expect(template()).toBe("bronzor");
	});

	it("filters by layout and counts what's shown", () => {
		renderGroup();
		const twoColumn = Object.values(templateLayouts).filter((layout) => layout.columns === 2).length;

		fireEvent.click(screen.getByRole("radio", { name: "Two columns" }));

		expect(screen.getByText(`${twoColumn} of ${Object.keys(templateLayouts).length} shown`)).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /^Bronzor\b/ })).not.toBeInTheDocument();
	});
});
