// @vitest-environment happy-dom

import type { SemanticNode } from "@reactive-resume/resume/stylesheet";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { compileStylesheet } from "@reactive-resume/resume/stylesheet";
import { collectCompiledColorTokens } from "./color-tokens";
import {
	completionLabels,
	compositionAwareDocumentListener,
	copySourceToClipboard,
	createSemanticCssEditorExtensions,
	getSemanticCssHoverDocumentation,
	revealStyleRule,
} from "./editor-extensions";

const semanticTree: SemanticNode = {
	key: "resume",
	kind: "resume",
	attributes: { template: "onyx" },
	roles: [],
	children: [
		{
			key: "section",
			kind: "section",
			id: "section-experience",
			attributes: { type: "experience", placement: "main" },
			roles: [],
			children: [
				{
					key: "item",
					kind: "item",
					id: "item-current",
					attributes: {},
					roles: [],
					children: [
						{
							key: "field",
							kind: "field",
							attributes: { name: "company" },
							roles: ["primary-text"],
							children: [],
						},
					],
				},
			],
		},
	],
};

const metadata = {
	semanticTree,
	templateParts: ["timeline-line", "timeline-marker"],
} as const;
const borderShorthands = ["border", "border-top", "border-right", "border-bottom", "border-left"] as const;

const views: EditorView[] = [];

afterEach(() => {
	for (const view of views.splice(0)) view.destroy();
});

describe("Semantic CSS editor extensions", () => {
	it("uses only Semantic CSS registries and the current resume for completion", async () => {
		const selectorLabels = await completionLabels("", 0, metadata);
		const propertyLabels = await completionLabels("section {\n\tco", 13, metadata);
		const variableSource = "resume { --brand-accent: #f00; color: var(--br";
		const variableLabels = await completionLabels(variableSource, variableSource.length, metadata);
		// The cursor has to sit at the end of the typed prefix; mid-token it reads as a selector context.
		const systemSource = "--resume-";
		const systemLabels = await completionLabels(systemSource, systemSource.length, metadata);
		const directiveLabels = await completionLabels("@", 1, metadata);

		expect(selectorLabels).toEqual(
			expect.arrayContaining([
				"section",
				"#section-experience",
				"#item-current",
				'[name="company"]',
				'[role~="primary-text"]',
				'template-part[name="timeline-marker"]',
			]),
		);
		expect(propertyLabels).toContain("color");
		expect(propertyLabels).toContain("-resume-fixed");
		expect(propertyLabels).not.toContain("cursor");
		expect(propertyLabels).not.toContain("font-family");
		expect(variableLabels).toEqual(expect.arrayContaining(["--brand-accent", "--resume-primary-color"]));
		expect(systemLabels).toEqual(expect.arrayContaining(["--resume-primary-color", "--resume-sidebar-width"]));
		expect(systemLabels).not.toContain("--resume-font-family");
		expect(directiveLabels).toEqual(["@media"]);
	});

	it("offers only the current property's registered compiler vocabulary", () => {
		const displaySource = "section { display: f";
		const borderStyleSource = "section { border-style: d";
		const fontSizeSource = "section { font-size: 1";

		const displayLabels = completionLabels(displaySource, displaySource.length, metadata);
		const borderStyleLabels = completionLabels(borderStyleSource, borderStyleSource.length, metadata);
		const fontSizeLabels = completionLabels(fontSizeSource, fontSizeSource.length, metadata);

		expect(displayLabels).toEqual(expect.arrayContaining(["flex", "none", "inherit"]));
		expect(displayLabels).not.toEqual(expect.arrayContaining(["portrait", "dashed", "pt"]));
		expect(borderStyleLabels).toEqual(expect.arrayContaining(["dashed", "dotted", "solid"]));
		expect(borderStyleLabels).not.toContain("double");
		expect(fontSizeLabels).toEqual(expect.arrayContaining(["pt", "rem"]));
		expect(fontSizeLabels).not.toEqual(expect.arrayContaining(["none", "normal", "max-content"]));
	});

	it.each(borderShorthands)("offers complete %s shorthand values instead of bare units", (property) => {
		const source = `section { ${property}: `;
		const labels = completionLabels(source, source.length, metadata);

		expect(labels).toEqual(expect.arrayContaining(["1pt dotted", "1pt dashed", "1pt solid"]));
		expect(labels).not.toEqual(expect.arrayContaining(["pt", "px", "in", "mm", "cm", "%", "em", "rem"]));
	});

	it("escapes dynamic IDs and attribute values before inserting selectors", () => {
		const unsafeMetadata = {
			semanticTree: {
				...semanticTree,
				children: [
					{
						key: "unsafe",
						kind: "field",
						id: "123 current#item",
						attributes: { name: 'company"lead\n' },
						roles: [],
						children: [],
					},
				],
			},
			templateParts: ['timeline"marker\n'],
		} as const;

		const labels = completionLabels("", 0, unsafeMetadata);

		// IDs that need escaping aren't offered as `#…` at all: entries are offered by name instead.
		expect(labels.filter((label) => label.startsWith("#1") || label.startsWith("#\\"))).toEqual([]);
		expect(labels).toEqual(
			expect.arrayContaining(['[name="company\\"lead\\a "]', 'template-part[name="timeline\\"marker\\a "]']),
		);
		expect(labels).not.toContain("#123 current#item");
		expect(labels).not.toContain('[name="company"lead\n"]');
	});

	it("builds hover text from the same registries", () => {
		expect(getSemanticCssHoverDocumentation("section", metadata)).toMatch(
			/semantic element.*placement.*featured-summary/i,
		);
		const colorDocumentation = getSemanticCssHoverDocumentation("color", metadata);
		expect(colorDocumentation).toMatch(/property.*inherited.*field/i);
		expect(colorDocumentation?.match(/section-heading/g)).toHaveLength(1);
		expect(getSemanticCssHoverDocumentation("--resume-primary-color", metadata)).toMatch(
			/read-only.*builder primary color/i,
		);
		expect(getSemanticCssHoverDocumentation("#section-experience", metadata)).toMatch(/current resume.*section/i);
		expect(getSemanticCssHoverDocumentation('template-part[name="timeline-line"]', metadata)).toMatch(
			/current template part/i,
		);
	});

	it("only decorates compiler-confirmed color values", () => {
		const source = "@version 1;\nsection { color: #ff0000; background-color: rgb(0 0 0); }\n";
		const compiled = compileStylesheet({ languageVersion: 1, text: source });
		expect(compiled.program).not.toBeNull();
		const tokens = collectCompiledColorTokens(source, compiled.program);
		expect(tokens).toEqual([
			{ from: source.indexOf("#ff0000"), to: source.indexOf("#ff0000") + 7, value: "#ff0000" },
			{
				from: source.indexOf("rgb(0 0 0)"),
				to: source.indexOf("rgb(0 0 0)") + "rgb(0 0 0)".length,
				value: "rgb(0 0 0)",
			},
		]);

		const selected = vi.fn();
		const view = new EditorView({
			doc: source,
			extensions: createSemanticCssEditorExtensions({
				metadata,
				colorTokens: tokens,
				onColorSelect: selected,
			}),
		});
		views.push(view);
		const swatches = view.dom.querySelectorAll<HTMLButtonElement>(".semantic-css-color-swatch");
		expect(swatches).toHaveLength(2);
		swatches[0]?.click();
		expect(selected).toHaveBeenCalledWith(tokens[0], expect.any(DOMRect));
	});

	it("preserves exact clipboard text and emits one change for an IME composition", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
		const source = "@version 1;\n/*  exact spacing  */\n";
		await copySourceToClipboard(source);
		expect(writeText).toHaveBeenCalledWith(source);

		const onChange = vi.fn();
		const view = new EditorView({
			doc: "",
			extensions: compositionAwareDocumentListener(onChange),
		});
		views.push(view);
		view.contentDOM.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "" }));
		view.dispatch({
			changes: { from: 0, insert: "セク" },
			annotations: Transaction.userEvent.of("input.type.compose"),
		});
		view.dispatch({
			changes: { from: 0, to: 2, insert: "セクション" },
			annotations: Transaction.userEvent.of("input.type.compose"),
		});
		view.contentDOM.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "セクション" }));
		await Promise.resolve();

		expect(view.state.doc.toString()).toBe("セクション");
		expect(onChange).toHaveBeenCalledOnce();
		expect(onChange).toHaveBeenCalledWith("セクション");
	});

	it("opens the built-in search and replace panel", () => {
		const view = new EditorView({
			doc: "section { color: red; }",
			extensions: createSemanticCssEditorExtensions({
				metadata,
				colorTokens: [],
				onColorSelect: vi.fn(),
			}),
		});
		views.push(view);
		view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "f" }));

		expect(view.dom.querySelector("[name=search]")).not.toBeNull();
		expect(view.dom.querySelector("[name=replace]")).not.toBeNull();
	});

	it("adds a rule for a picked element once, then moves the cursor into it", () => {
		const view = new EditorView({ doc: "header { color: red; }" });
		views.push(view);
		const target = { selector: 'section[id="experience"] item[id="a"]', label: "Experience › Lead */ dev" };

		revealStyleRule(view, target);
		expect(view.state.doc.toString()).toBe(
			'header { color: red; }\n\n/* Experience › Lead *\\/ dev */\nsection[id="experience"] item[id="a"] {\n\t\n}\n',
		);
		const inside = view.state.selection.main.head;
		expect(view.state.doc.sliceString(inside - 1, inside + 2)).toBe("\t\n}");

		view.dispatch({ selection: { anchor: 0 } });
		revealStyleRule(view, target);
		expect(view.state.doc.toString().match(/item\[id="a"\]/g)).toHaveLength(1);
		expect(view.state.selection.main.head).toBe(inside);
	});
});
