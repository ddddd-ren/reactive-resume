// @vitest-environment happy-dom
import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { Resume } from "@/features/resume/builder/draft";
import { act, cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { parseResumeData } from "@reactive-resume/schema/resume/data";
import { sampleResumeData } from "@reactive-resume/schema/resume/sample";
import { useResumeStore } from "@/features/resume/builder/draft";
import { PromptDialogProvider } from "@/hooks/use-prompt";
import { useEditorStore } from "../store";
import { WritePanel } from "./write-panel";

const routerParams = vi.hoisted(() => ({ resumeId: "write-panel" }));
const toastState = vi.hoisted(() => ({ add: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({ useParams: () => routerParams, useNavigate: () => vi.fn() }));
vi.mock("@/libs/orpc/client", () => ({
	orpc: {
		resume: {
			setLocked: { mutationOptions: () => ({}) },
			update: { call: vi.fn(() => new Promise(() => undefined)) },
		},
		coverLetters: { copyEmbedded: { mutationOptions: () => ({}) } },
		aiProviders: { list: { queryOptions: () => ({ queryKey: ["aiProviders"], queryFn: () => [] }) } },
		ai: { improve: { mutationOptions: () => ({}) } },
	},
	streamClient: { resume: { updates: { subscribe: vi.fn() } } },
}));
vi.mock("@reactive-resume/ui/components/toast", () => ({ toast: { add: toastState.add, close: vi.fn() } }));

beforeAll(() => {
	i18n.loadAndActivate({ locale: "en-US", messages: {} });
	vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
});

afterEach(() => {
	cleanup();
	useEditorStore.getState().reset();
	toastState.add.mockClear();
});

function renderPanel(edit?: (data: ResumeData) => void) {
	const data = parseResumeData(structuredClone(sampleResumeData));
	edit?.(data);
	const resume: Resume = {
		id: routerParams.resumeId,
		name: "Write panel",
		slug: "write-panel",
		tags: [],
		data,
		isLocked: false,
		updatedAt: new Date("2026-09-28T00:00:00.000Z"),
	};
	useResumeStore.getState().initialize(resume);

	render(
		<QueryClientProvider client={new QueryClient()}>
			<I18nProvider i18n={i18n}>
				<PromptDialogProvider>
					<WritePanel />
				</PromptDialogProvider>
			</I18nProvider>
		</QueryClientProvider>,
	);
}

const data = () => useResumeStore.getState().resume?.data as ResumeData;
const sectionRow = (id: string) => document.getElementById(`sidebar-${id}`) as HTMLElement;

describe("WritePanel", () => {
	it("lists sections in print order and opens a section's entries", () => {
		renderPanel();
		const experience = sectionRow("experience");

		fireEvent.click(within(experience).getAllByRole("button", { name: "Experience" })[0] as HTMLElement);

		expect(within(experience).getByText("Cascade Studios", { exact: false })).toBeInTheDocument();
		expect(within(experience).getByRole("button", { name: "Add experience" })).toBeInTheDocument();
	});

	it("adds a draft entry, open and focused on its first field, that prints once it has a company", async () => {
		renderPanel();
		const experience = sectionRow("experience");
		fireEvent.click(within(experience).getAllByRole("button", { name: "Experience" })[0] as HTMLElement);

		fireEvent.click(within(experience).getByRole("button", { name: "Add experience" }));

		await waitFor(() => expect(within(experience).getByText("Draft · not printed")).toBeInTheDocument());
		expect(document.activeElement).toHaveAttribute("data-entry-field", "position");

		fireEvent.change(within(experience).getByRole("textbox", { name: "Company" }), { target: { value: "Lumen" } });

		expect(within(experience).queryByText("Draft · not printed")).not.toBeInTheDocument();
		expect(data().sections.experience.items.at(-1)).toMatchObject({ company: "Lumen" });
	});

	it("deletes an entry at once and offers Undo", () => {
		renderPanel();
		const [first] = data().sections.education.items;
		act(() => useEditorStore.getState().select({ kind: "item", sectionId: "education", itemId: first?.id ?? "" }));
		act(() => useEditorStore.getState().setSectionOpen("education", true));

		fireEvent.click(within(sectionRow("education")).getByRole("button", { name: "Delete entry" }));

		expect(data().sections.education.items).toHaveLength(0);
		const toast = toastState.add.mock.calls.at(-1)?.[0];
		expect(toast).toMatchObject({ description: "Entry deleted", actionProps: { children: "Undo" } });

		act(() => toast.actionProps.onClick());
		expect(data().sections.education.items).toHaveLength(1);
	});

	it("moves a section with ⌥↑ on its title, changing the print order", () => {
		renderPanel();
		const before = data().metadata.layout.pages[0]?.main ?? [];
		const index = before.indexOf("education");
		const title = within(sectionRow("education")).getAllByRole("button", { name: "Education" })[0] as HTMLElement;

		fireEvent.keyDown(title, { key: "ArrowUp", altKey: true });

		const after = data().metadata.layout.pages[0]?.main ?? [];
		expect(after.indexOf("education")).toBe(index - 1);
	});

	it("keeps hidden sections listed, struck through, with the eye to show them", () => {
		renderPanel((draft) => {
			draft.sections.skills.hidden = true;
		});

		fireEvent.click(within(sectionRow("skills")).getByRole("button", { name: "Show Skills on the page" }));

		expect(data().sections.skills.hidden).toBe(false);
	});
});
