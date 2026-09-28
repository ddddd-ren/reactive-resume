// @vitest-environment happy-dom
import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { Resume } from "@/features/resume/builder/draft";
import type { Proposal } from "./proposals";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { useResumeStore } from "@/features/resume/builder/draft";
import { useEditorStore } from "../store";
import { ProposalList } from "./proposal-list";
import { readTarget } from "./proposals";

const routerParams = vi.hoisted(() => ({ resumeId: "proposals" }));
const toastState = vi.hoisted(() => ({ add: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({ useParams: () => routerParams }));
vi.mock("@/libs/orpc/client", () => ({
	orpc: {},
	streamClient: { resume: { updates: { subscribe: vi.fn() } } },
}));
vi.mock("@reactive-resume/ui/components/toast", () => ({ toast: { add: toastState.add, close: vi.fn() } }));

beforeAll(() => {
	i18n.loadAndActivate({ locale: "en-US", messages: {} });
});

afterEach(() => {
	cleanup();
	useEditorStore.getState().reset();
	toastState.add.mockClear();
});

const TARGET = { sectionId: "experience", itemId: "kettle", field: "description" };

const proposals: Proposal[] = [
	{
		id: "w1",
		target: TARGET,
		location: "Experience · Studio Kettle · bullet 1",
		before: "<p>Responsible for design tasks</p>",
		after: "<p>Produced packaging for retail clients</p>",
		why: "Names an outcome.",
		status: "pending",
		source: "check",
	},
	{
		id: "w2",
		target: TARGET,
		location: "Experience · Studio Kettle · bullet 2",
		before: "<p>Worked on websites</p>",
		after: "<p>Designed websites for 20+ businesses</p>",
		why: "Adds scale.",
		status: "pending",
		source: "check",
	},
];

function setup() {
	const data = structuredClone(defaultResumeData) as ResumeData;
	data.sections.experience.items = [
		{
			id: "kettle",
			hidden: false,
			company: "Studio Kettle",
			position: "Junior Designer",
			location: "",
			period: "",
			website: { url: "", label: "", inlineLink: false },
			description: "<ul><li><p>Responsible for design tasks</p></li><li><p>Worked on websites</p></li></ul>",
			roles: [],
		} as ResumeData["sections"]["experience"]["items"][number],
	];
	const resume: Resume = {
		id: routerParams.resumeId,
		name: "Proposals",
		slug: "proposals",
		tags: [],
		data,
		isLocked: false,
		updatedAt: new Date("2026-09-28T00:00:00.000Z"),
	};
	useResumeStore.getState().initialize(resume);
	useEditorStore.getState().setProposals(proposals);

	const Harness = () => {
		const current = useResumeStore((state) => state.resume?.data);
		const list = useEditorStore((state) => state.proposals);
		return current ? <ProposalList proposals={list} data={current} onSuggestAgain={vi.fn()} /> : null;
	};

	render(
		<I18nProvider i18n={i18n}>
			<Harness />
		</I18nProvider>,
	);
}

const description = () => readTarget(useResumeStore.getState().resume?.data as ResumeData, TARGET);

describe("ProposalList", () => {
	it("accepts with A and rejects with R on the focused edit, moving with the arrow keys", () => {
		setup();
		const [first] = screen.getAllByRole("listitem");
		first?.focus();

		fireEvent.keyDown(first as HTMLElement, { key: "a" });
		expect(description()).toContain("<p>Produced packaging for retail clients</p>");
		expect(screen.getByText("Applied")).toBeTruthy();

		fireEvent.keyDown(first as HTMLElement, { key: "ArrowDown" });
		const second = screen.getAllByRole("listitem")[1] as HTMLElement;
		expect(document.activeElement).toBe(second);
		fireEvent.keyDown(second, { key: "r" });
		expect(screen.getByText("Rejected")).toBeTruthy();
		expect(description()).toContain("<p>Worked on websites</p>");
	});

	it("accepts all pending edits as one undo step, and undoing shows them as pending again", () => {
		setup();
		fireEvent.click(screen.getByRole("button", { name: "Accept all" }));

		expect(description()).toBe(
			"<ul><li><p>Produced packaging for retail clients</p></li><li><p>Designed websites for 20+ businesses</p></li></ul>",
		);
		expect(screen.getAllByText("Applied")).toHaveLength(2);

		act(() => useResumeStore.getState().undo());
		expect(description()).toContain("<p>Responsible for design tasks</p>");
		expect(screen.getAllByRole("button", { name: "Accept" })).toHaveLength(2);
	});

	it("marks an edit out of date once its text changes", () => {
		setup();
		act(() =>
			useResumeStore.getState().updateResumeData((draft) => {
				const entry = draft.sections.experience.items[0];
				if (entry) entry.description = "<p>Rewritten by hand</p>";
			}),
		);

		expect(screen.getAllByText(/Out of date/)).toHaveLength(2);
		expect(screen.queryByRole("button", { name: "Accept all" })).toBeNull();
	});
});
