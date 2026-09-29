// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfirmDialogProvider } from "@/hooks/use-confirm";
import { RichTextEditor } from "./rich-text-editor";

const media = vi.hoisted(() => ({ mobile: false }));

vi.mock("@reactive-resume/ui/hooks/use-mobile", () => ({ useIsMobile: () => media.mobile }));
vi.mock("@/libs/orpc/client", () => ({
	orpc: {
		aiProviders: { list: { queryOptions: () => ({ queryKey: ["aiProviders"], queryFn: () => [] }) } },
		ai: { improve: { mutationOptions: () => ({}) } },
	},
}));

beforeAll(() => {
	i18n.loadAndActivate({ locale: "en-US", messages: {} });
});

afterEach(() => {
	cleanup();
	media.mobile = false;
});

const renderEditor = () =>
	render(
		<I18nProvider i18n={i18n}>
			<QueryClientProvider client={new QueryClient()}>
				<ConfirmDialogProvider>
					<RichTextEditor label="Description" value="<p>Shipped the redesign.</p>" onChange={() => {}} />
				</ConfirmDialogProvider>
			</QueryClientProvider>
		</I18nProvider>,
	);

const focusText = async (container: HTMLElement) => {
	const text = await waitFor(() => {
		const element = container.querySelector<HTMLElement>('[role="textbox"]');
		if (!element) throw new Error("Editor not mounted");
		return element;
	});
	act(() => text.focus());
	return text;
};

describe("RichTextEditor toolbar", () => {
	it("shows the toolbar inside the field on larger screens", async () => {
		const { container } = renderEditor();
		await focusText(container);

		const toolbar = await waitFor(() => {
			const element = document.querySelector('[role="toolbar"]');
			if (!element) throw new Error("No toolbar");
			return element;
		});
		expect(container.contains(toolbar)).toBe(true);
		expect(toolbar.textContent).not.toContain("Done");
	});

	it("docks the toolbar above the keyboard on phones, and Done puts it away", async () => {
		media.mobile = true;
		const { container } = renderEditor();
		await focusText(container);

		const toolbar = await waitFor(() => {
			const element = document.querySelector<HTMLElement>('[role="toolbar"]');
			if (!element) throw new Error("No toolbar");
			return element;
		});
		expect(container.contains(toolbar)).toBe(false);
		expect(toolbar.className).toContain("fixed");
		expect(toolbar.textContent).toContain("Improve");

		const done = [...toolbar.querySelectorAll("button")].find((button) => button.textContent === "Done");
		if (!done) throw new Error("No Done button");
		fireEvent.click(done);
		await waitFor(() => expect(document.querySelector('[role="toolbar"]')).toBeNull());
	});
});
