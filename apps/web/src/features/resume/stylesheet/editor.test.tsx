// @vitest-environment happy-dom

import type { SemanticCssDiagnostic, StyleProgram } from "@reactive-resume/resume/stylesheet";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorView } from "@codemirror/view";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { compileStylesheet } from "@reactive-resume/resume/stylesheet";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { TooltipProvider } from "@reactive-resume/ui/components/tooltip";
import { collectCompiledColorTokens } from "./color-tokens";
import StylesheetEditorShell, { StylesheetCodeEditor } from "./editor";

const media = vi.hoisted(() => ({ mobile: false }));
const compileWorker = vi.hoisted(() => ({
	program: { languageVersion: 1, rules: [] } as StyleProgram | null,
	diagnostics: [] as SemanticCssDiagnostic[],
}));
const builder = vi.hoisted(() => ({
	canUndo: false,
	canRedo: false,
	data: undefined as typeof defaultResumeData | undefined,
	isLocked: false,
	undo: vi.fn(),
	redo: vi.fn(),
}));

vi.mock("@reactive-resume/ui/hooks/use-mobile", () => ({
	useIsMobile: () => media.mobile,
}));

vi.mock("@/features/theme/provider", () => ({
	useTheme: () => ({ theme: "light" }),
}));

vi.mock("@/features/resume/builder/draft", () => ({
	useResumeData: () => builder.data,
	useIsResumeLocked: () => builder.isLocked,
	useUpdateResumeData: () => (update: (draft: typeof defaultResumeData) => void) => {
		if (builder.data) update(builder.data);
	},
	useResumeStore: (selector: (state: object) => unknown) =>
		selector({ canUndo: builder.canUndo, canRedo: builder.canRedo, undo: builder.undo, redo: builder.redo }),
}));

vi.mock("./worker-client", () => ({
	createCompileWorkerClient: () => ({
		compile: vi.fn(async ({ editGeneration }: { editGeneration: number }) => ({
			type: "compile_result",
			requestId: editGeneration,
			editGeneration,
			program: compileWorker.program,
			diagnostics: compileWorker.diagnostics,
			colorTokens: [],
		})),
		destroy: vi.fn(),
	}),
}));

const guideName = /read the applying custom styles guide.*opens in new tab/i;

const expectGuideLink = (root: HTMLElement) => {
	const link = within(root).getByRole("link", { name: guideName });
	expect(link).toHaveAttribute("href", "https://docs.rxresu.me/applying-custom-styles");
	expect(link).toHaveAttribute("target", "_blank");
	expect(link).toHaveAttribute("rel", "noopener noreferrer");
};

beforeAll(() => {
	i18n.loadAndActivate({ locale: "en", messages: {} });
	Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] });
});

beforeEach(() => {
	media.mobile = false;
	builder.data = structuredClone(defaultResumeData);
	builder.isLocked = false;
	builder.canUndo = false;
	builder.canRedo = false;
	builder.undo.mockReset();
	builder.redo.mockReset();
	compileWorker.program = { languageVersion: 1, rules: [] };
	compileWorker.diagnostics = [];
});

const renderWithI18n = (element: React.ReactNode) => render(<I18nProvider i18n={i18n}>{element}</I18nProvider>);

function renderColorEditor(source: string) {
	const onChange = vi.fn();
	const editor = (value: string) => (
		<I18nProvider i18n={i18n}>
			<StylesheetCodeEditor
				value={value}
				colorTokens={collectCompiledColorTokens(value, compileStylesheet({ languageVersion: 1, text: value }).program)}
				theme="light"
				onChange={onChange}
				onUndo={vi.fn()}
				onRedo={vi.fn()}
			/>
		</I18nProvider>
	);
	const result = render(editor(source));
	return { ...result, onChange, replaceSource: (value: string) => result.rerender(editor(value)) };
}

describe("StylesheetCodeEditor", () => {
	it("preserves contextual currentcolor without exposing an editable literal swatch", () => {
		const source = "@version 1;\nsection { color: red; border-color: currentcolor; }";
		expect(compileStylesheet({ languageVersion: 1, text: source }).diagnostics).toEqual([]);
		const { onChange } = renderColorEditor(source);

		expect(screen.getByRole("button", { name: "Edit color red" })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Edit color currentcolor" })).not.toBeInTheDocument();
		expect(screen.getByRole("textbox", { name: "Semantic CSS stylesheet" })).toHaveTextContent(
			"border-color: currentcolor",
		);
		expect(onChange).not.toHaveBeenCalled();
	});

	it("removes the temporary color trigger when the picker closes", async () => {
		const { container } = renderColorEditor("@version 1;\nsection { color: #f00; }");
		fireEvent.click(screen.getByRole("button", { name: "Edit color #f00" }));
		fireEvent.click(await screen.findByRole("button", { name: "Use color rgba(231, 0, 11, 1)" }));
		fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

		await waitFor(() => expect(screen.queryByText("Presets")).not.toBeInTheDocument());
		expect(container.querySelector("[data-semantic-css-color-picker-trigger]")).not.toBeInTheDocument();
	});

	it("keeps the picker open for successive presets without replacing the next color", async () => {
		const source = "@version 1;\nsection { color: #f00; background-color: #fff; }";
		const { onChange, replaceSource } = renderColorEditor(source);
		fireEvent.click(screen.getByRole("button", { name: "Edit color #f00" }));
		fireEvent.click(await screen.findByRole("button", { name: "Use color rgba(0, 0, 0, 1)" }));
		const first = source.replace("#f00", "#000000");
		expect(onChange).toHaveBeenLastCalledWith(first);
		replaceSource(first);

		fireEvent.click(screen.getByRole("button", { name: "Use color rgba(231, 0, 11, 1)" }));
		expect(onChange).toHaveBeenLastCalledWith(source.replace("#f00", "#e7000b"));
		expect(screen.getByText("Presets")).toBeInTheDocument();
	});

	it.each([
		["undo", "rgba(231, 0, 11, 1)", "#f00"],
		["redo", "#f00", "rgba(231, 0, 11, 1)"],
	])("closes a stale selection when %s replaces the document", async (_action, initial, replacement) => {
		const source = `@version 1;\nsection { color: ${initial}; background-color: #fff; }`;
		const { container, onChange, replaceSource } = renderColorEditor(source);
		fireEvent.click(screen.getByRole("button", { name: `Edit color ${initial}` }));
		await screen.findByText("Presets");
		const nextSource = source.replace(initial, replacement);
		replaceSource(nextSource);

		await waitFor(() => expect(screen.queryByText("Presets")).not.toBeInTheDocument());
		expect(container.querySelector("[data-semantic-css-color-picker-trigger]")).not.toBeInTheDocument();
		expect(onChange).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: "Edit color #fff" }));
		fireEvent.click(await screen.findByRole("button", { name: "Use color rgba(0, 0, 0, 1)" }));
		expect(onChange).toHaveBeenLastCalledWith(nextSource.replace("#fff", "#000000"));
	});

	it("closes the picker after text edits and rejects stale compiler color ranges", async () => {
		const source = "@version 1;\nsection { color: #f00; background-color: #fff; }";
		const { container, onChange } = renderColorEditor(source);
		fireEvent.click(screen.getByRole("button", { name: "Edit color #f00" }));
		await screen.findByText("Presets");
		const view = EditorView.findFromDOM(screen.getByRole("textbox", { name: "Semantic CSS stylesheet" }));
		if (!view) throw new Error("Missing editor view");
		const from = source.indexOf("#f00");
		act(() => view.dispatch({ changes: { from, to: from + 4, insert: "#00f" } }));

		await waitFor(() => expect(screen.queryByText("Presets")).not.toBeInTheDocument());
		expect(container.querySelector("[data-semantic-css-color-picker-trigger]")).not.toBeInTheDocument();
		onChange.mockClear();

		// The compile worker has not sent updated tokens yet; the old swatch must not overwrite the edited color.
		fireEvent.click(screen.getByRole("button", { name: "Edit color #f00" }));
		fireEvent.click(await screen.findByRole("button", { name: "Use color rgba(0, 0, 0, 1)" }));
		expect(view.state.doc.toString()).toBe(source.replace("#f00", "#00f"));
		expect(onChange).not.toHaveBeenCalled();
	});

	it("owns one LTR EditorView and ignores externally replaced documents", () => {
		const onChange = vi.fn();
		const destroy = vi.spyOn(EditorView.prototype, "destroy");
		const props = {
			theme: "light" as const,
			onChange,
			onUndo: vi.fn(),
			onRedo: vi.fn(),
		};
		const { container, rerender, unmount } = render(
			<div style={{ height: 200 }}>
				<StylesheetCodeEditor value="@version 1;\n" {...props} />
			</div>,
		);

		expect(container.querySelectorAll(".cm-editor")).toHaveLength(1);
		expect(container.querySelector(".cm-editor")).toHaveAttribute("dir", "ltr");
		expect(screen.getByRole("textbox", { name: "Semantic CSS stylesheet" })).toHaveAttribute("dir", "ltr");

		rerender(
			<div style={{ height: 200 }}>
				<StylesheetCodeEditor value={"@version 1;\nsection { color: red; }\n"} {...props} />
			</div>,
		);

		expect(onChange).not.toHaveBeenCalled();
		expect(screen.getByRole("textbox", { name: "Semantic CSS stylesheet" })).toHaveTextContent("color: red");

		rerender(
			<div style={{ height: 200 }}>
				<StylesheetCodeEditor value={"@version 1;\nsection { color: red; }\n"} {...props} theme="dark" readOnly />
			</div>,
		);

		expect(screen.getByRole("textbox", { name: "Semantic CSS stylesheet" })).toHaveAttribute(
			"contenteditable",
			"false",
		);

		unmount();
		expect(destroy).toHaveBeenCalledOnce();
		destroy.mockRestore();
	});

	it("reuses one React color picker for compiler-confirmed swatches", async () => {
		const source = "section { color: #f00; background-color: #fff; }";
		const first = source.indexOf("#f00");
		const second = source.indexOf("#fff");
		const { container } = renderWithI18n(
			<StylesheetCodeEditor
				value={source}
				colorTokens={[
					{ from: first, to: first + 4, value: "#f00" },
					{ from: second, to: second + 4, value: "#fff" },
				]}
				theme="light"
				onChange={vi.fn()}
				onUndo={vi.fn()}
				onRedo={vi.fn()}
			/>,
		);
		const swatches = container.querySelectorAll<HTMLButtonElement>(".semantic-css-color-swatch");
		expect(swatches).toHaveLength(2);

		if (!swatches[0] || !swatches[1]) throw new Error("Missing color swatches");
		fireEvent.click(swatches[0]);
		await waitFor(() => expect(container.querySelectorAll("[data-semantic-css-color-picker-trigger]")).toHaveLength(1));
		fireEvent.click(swatches[1]);
		await waitFor(() => expect(container.querySelectorAll("[data-semantic-css-color-picker-trigger]")).toHaveLength(1));
	});
});

describe("StylesheetEditorShell", () => {
	it("links desktop editor help to the Semantic CSS language reference", () => {
		media.mobile = false;
		const { container } = render(
			<I18nProvider i18n={i18n}>
				<TooltipProvider>
					<StylesheetEditorShell />
				</TooltipProvider>
			</I18nProvider>,
		);

		expectGuideLink(container);
	});

	it("has no apply or save action for an already-semantic stylesheet", () => {
		if (!builder.data) throw new Error("Missing resume fixture");
		builder.data.metadata.stylesheet = {
			mode: "semantic",
			source: { languageVersion: 1, text: "@version 1;\n" },
		};

		render(
			<I18nProvider i18n={i18n}>
				<TooltipProvider>
					<StylesheetEditorShell />
				</TooltipProvider>
			</I18nProvider>,
		);

		expect(screen.queryByRole("button", { name: /save|apply/i })).not.toBeInTheDocument();
	});

	it("writes semantic edits into the ordinary resume draft immediately", () => {
		if (!builder.data) throw new Error("Missing resume fixture");
		builder.data.metadata.stylesheet = {
			mode: "semantic",
			source: { languageVersion: 1, text: "@version 1;\n" },
		};

		render(
			<I18nProvider i18n={i18n}>
				<TooltipProvider>
					<StylesheetEditorShell />
				</TooltipProvider>
			</I18nProvider>,
		);
		const textbox = screen.getByRole("textbox", { name: "Semantic CSS stylesheet" });
		const view = EditorView.findFromDOM(textbox);
		if (!view) throw new Error("Missing editor view");

		act(() => view.dispatch({ changes: { from: view.state.doc.length, insert: "name { color: blue; }\n" } }));

		expect(builder.data.metadata.stylesheet.source.text).toBe("name { color: blue; }\n");
	});

	it("writes a first edit to a resume without a stylesheet as Semantic CSS", () => {
		render(
			<I18nProvider i18n={i18n}>
				<TooltipProvider>
					<StylesheetEditorShell />
				</TooltipProvider>
			</I18nProvider>,
		);
		const view = EditorView.findFromDOM(screen.getByRole("textbox", { name: "Semantic CSS stylesheet" }));
		if (!view) throw new Error("Missing editor view");

		act(() => view.dispatch({ changes: { from: 0, insert: "name { color: blue; }\n" } }));

		expect(builder.data?.metadata.stylesheet).toEqual({
			mode: "semantic",
			source: { languageVersion: 1, text: "name { color: blue; }\n" },
		});
	});

	it("makes editor mutation controls read-only while the resume is locked", () => {
		builder.isLocked = true;
		builder.canUndo = true;
		builder.canRedo = true;

		render(
			<I18nProvider i18n={i18n}>
				<TooltipProvider>
					<StylesheetEditorShell />
				</TooltipProvider>
			</I18nProvider>,
		);

		expect(screen.getByRole("textbox", { name: "Semantic CSS stylesheet" })).toHaveAttribute(
			"contenteditable",
			"false",
		);
		expect(screen.getByRole("button", { name: "Undo stylesheet edit" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Redo stylesheet edit" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Format stylesheet" })).toBeDisabled();
	});

	it("moves the only visible editor into a titled mobile sheet", async () => {
		media.mobile = true;

		const { container } = render(
			<I18nProvider i18n={i18n}>
				<TooltipProvider>
					<StylesheetEditorShell />
				</TooltipProvider>
			</I18nProvider>,
		);

		expect(container.querySelectorAll(".cm-editor")).toHaveLength(1);
		fireEvent.click(screen.getByRole("button", { name: "Open focus mode" }));

		const sheet = await screen.findByRole("dialog");
		expect(within(sheet).getByRole("heading", { name: "Semantic CSS stylesheet" })).toBeInTheDocument();
		expect(within(sheet).getByRole("toolbar", { name: "Stylesheet editor" })).toBeInTheDocument();
		expectGuideLink(sheet);
		expect(document.querySelectorAll(".cm-editor")).toHaveLength(1);
		media.mobile = false;
	});
});
