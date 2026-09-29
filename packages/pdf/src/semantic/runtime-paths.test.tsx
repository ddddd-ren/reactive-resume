import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { RenderResumeInput } from "../forme/render";
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { createResumePdfBlob } from "../browser";
import { ResumeDocument } from "../document";
import { pdf } from "../forme/testing";
import { createResumePdfFile } from "../server";

// Each entry point hands its input to the engine; the last one to render is the one captured.
const captured = vi.hoisted(() => ({ inputs: [] as unknown[] }));

vi.mock("../forme/render", () => ({
	renderResume: (_engine: unknown, input: unknown) => {
		captured.inputs.push(input);
		return Promise.resolve({
			pdf: new TextEncoder().encode("%PDF"),
			pageMap: { pages: [], nodes: [] },
			layout: { pages: [] },
			missingFonts: [],
			warnings: [],
		});
	},
}));
vi.mock("@formepdf/core/worker", () => ({ init: () => Promise.resolve() }));

type HostNode = {
	type: string;
	props?: Readonly<Record<string, unknown>>;
	style?: unknown;
	children?: HostNode[];
};

const findFirst = (node: HostNode, predicate: (candidate: HostNode) => boolean): HostNode | undefined => {
	if (predicate(node)) return node;
	for (const child of node.children ?? []) {
		const match = findFirst(child, predicate);
		if (match) return match;
	}
};

const buildFixture = (): ResumeData => {
	const data = structuredClone(defaultResumeData);
	const source = {
		languageVersion: 1,
		text: `
			@version 1;
			page { size: LETTER; }
			header { -resume-fixed: true; background-color: #1e293b; }
		`,
	};
	data.picture.hidden = true;
	data.basics.name = "Ada Lovelace";
	data.metadata.layout.pages = [{ fullWidth: true, main: [], sidebar: [] }];
	data.metadata.stylesheet = { mode: "semantic", source };
	return data;
};

const buildNodeBudgetFixture = (mode: "legacy" | "semantic"): ResumeData => {
	const data = structuredClone(defaultResumeData);
	const source = { languageVersion: 1, text: "@version 1;\n" };
	data.metadata.layout.pages = [{ fullWidth: true, main: ["skills"], sidebar: [] }];
	data.metadata.stylesheet = { mode, source };
	data.sections.skills.items = Array.from({ length: 2_000 }, (_, index) => ({
		id: `skill-${index}`,
		hidden: false,
		icon: "",
		iconColor: "",
		name: `Skill ${index}`,
		proficiency: "Advanced",
		level: 5,
		keywords: ["TypeScript"],
	}));
	return data;
};

const buildFatalSourceFixture = (): ResumeData => {
	const data = structuredClone(defaultResumeData);
	data.metadata.layout.pages = [{ fullWidth: true, main: [], sidebar: [] }];
	data.metadata.stylesheet = { mode: "semantic", source: { languageVersion: 2, text: "@version 2;" } };
	return data;
};

const renderFinalProps = (input: unknown) => {
	const { data, template, renderOptions, resolveSectionTitle } = input as RenderResumeInput;
	const element = createElement(ResumeDocument, {
		data,
		template: template ?? data.metadata.template,
		...(renderOptions ? { renderOptions } : {}),
		resolveSectionTitle,
	});
	const document = pdf(element).container.document as HostNode;
	const page = findFirst(document, ({ type }) => type === "PAGE");
	const fixed = findFirst(document, ({ props }) => props?.fixed === true);

	return {
		page: { size: page?.props?.size, style: page?.style },
		fixed: { type: fixed?.type, fixed: fixed?.props?.fixed, style: fixed?.style },
	};
};

describe("browser/server semantic runtime identity", () => {
	it("delivers identical final primitive props through ResumeDocument", async () => {
		const data = buildFixture();
		captured.inputs.length = 0;
		await createResumePdfBlob({ data, template: "onyx" });
		await createResumePdfFile({ data, filename: "resume.pdf", template: "onyx" });

		const [browserProps, serverProps] = captured.inputs.map(renderFinalProps);

		expect(captured.inputs).toHaveLength(2);
		expect(browserProps).toEqual(serverProps);
		expect(browserProps?.page.size).toBe("LETTER");
		expect(browserProps?.fixed).toMatchObject({ type: "VIEW", fixed: true });
	}, 30_000);

	it("renders browser and server PDFs with base styles when the stylesheet is fatal", async () => {
		const data = buildFatalSourceFixture();

		captured.inputs.length = 0;
		const blob = await createResumePdfBlob({ data, template: "onyx" });
		const file = await createResumePdfFile({ data, filename: "resume.pdf", template: "onyx" });

		expect(blob.type).toBe("application/pdf");
		expect(file.type).toBe("application/pdf");
		const [browserProps, serverProps] = captured.inputs.map(renderFinalProps);
		expect(browserProps).toEqual(serverProps);
	}, 15_000);

	it("keeps legacy PDF rendering unaffected by the semantic node budget", async () => {
		const data = buildNodeBudgetFixture("legacy");

		const blob = await createResumePdfBlob({ data, template: "onyx" });
		const file = await createResumePdfFile({ data, filename: "resume.pdf", template: "onyx" });

		expect(blob.type).toBe("application/pdf");
		expect(file.type).toBe("application/pdf");
	}, 15_000);
});
