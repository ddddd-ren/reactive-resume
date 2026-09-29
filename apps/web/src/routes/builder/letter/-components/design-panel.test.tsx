// @vitest-environment happy-dom
import type { CoverLetter } from "@reactive-resume/schema/cover-letter/data";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { copyCoverLetterStyle } from "@reactive-resume/resume/cover-letter";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { useLetterEditorStore } from "@/features/letters/store";
import { LetterDesignPanel } from "./design-panel";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-router")>()),
	Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
	useParams: () => ({}),
}));
vi.mock("@/libs/orpc/client", () => ({
	client: { coverLetters: { update: vi.fn() } },
	streamClient: {},
	orpc: { resume: { list: { queryOptions: () => ({ queryKey: ["resumes"], queryFn: () => [] }) } } },
}));

beforeAll(() => {
	i18n.loadAndActivate({ locale: "en-US", messages: {} });
});

afterEach(() => {
	cleanup();
	useLetterEditorStore.getState().reset();
});

const letter = (designLinked: boolean): CoverLetter => ({
	id: "letter",
	name: "Letter",
	recipient: "",
	content: "",
	style: copyCoverLetterStyle(defaultResumeData),
	layout: "structured",
	recipientName: "",
	recipientCompany: "",
	letterDate: null,
	sourceResumeId: "resume",
	sourceApplicationId: null,
	senderLinked: true,
	designLinked,
	isLocked: false,
	revision: 1,
	createdAt: new Date(),
	updatedAt: new Date(),
});

const renderPanel = () =>
	render(
		<I18nProvider i18n={i18n}>
			<QueryClientProvider client={new QueryClient()}>
				<LetterDesignPanel />
			</QueryClientProvider>
		</I18nProvider>,
	);

describe("LetterDesignPanel", () => {
	it("leaves type, color and page to the resume while the design is linked", () => {
		useLetterEditorStore.getState().load(letter(true));
		renderPanel();
		expect(screen.queryByRole("heading", { name: "Type" })).toBeNull();
		expect(screen.queryByRole("radiogroup", { name: "Accent colour" })).toBeNull();
	});

	it("edits the letter's own type, color and page once it keeps its own design", () => {
		useLetterEditorStore.getState().load(letter(false));
		renderPanel();
		expect(screen.getByRole("heading", { name: "Type" })).toBeTruthy();
		expect(screen.getByRole("heading", { name: "Page" })).toBeTruthy();

		fireEvent.click(screen.getByRole("radio", { name: "Teal" }));
		expect(useLetterEditorStore.getState().pending.metadata?.design?.colors.primary).toMatch(/^rgba\(/);
		expect(useLetterEditorStore.getState().letter?.style.metadata.design.colors.primary).toBe(
			useLetterEditorStore.getState().pending.metadata?.design?.colors.primary,
		);
	});
});
