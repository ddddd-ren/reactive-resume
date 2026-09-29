import type { ResumeData, StyleRule } from "@reactive-resume/schema/resume/data";
import type { Template } from "@reactive-resume/schema/templates";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import pixelmatch from "pixelmatch";
import { createElement } from "react";
import { styleRulesSchema } from "@reactive-resume/schema/resume/data";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { ResumeDocument } from "../document";
import { renderToBuffer } from "../forme/testing";
import { convertLegacyStyleRules } from "./legacy-converter";
import { rasterizePdf } from "./test/rasterize-pdf";

const templates = [
	"azurill",
	"bronzor",
	"chikorita",
	"ditgar",
	"ditto",
	"gengar",
	"glalie",
	"kakuna",
	"lapras",
	"leafish",
	"meowth",
	"onyx",
	"pikachu",
	"rhyhorn",
	"scizor",
] as const satisfies readonly Template[];

const fixtureNames = [
	"all-templates-smoke",
	"array-order-tie",
	"award-unbold",
	"clamped-spacing",
	"combined-text-host",
	"custom-section-type",
	"disabled-rules",
	"icon-level-size",
	"link-underline-3134",
	"merge-specificity",
	"primary-text-bold-3146",
	"rich-text-all-slots",
	"sanitized-intent-3199",
	"section-id-uuid",
] as const;

const readRules = (name: string): StyleRule[] =>
	styleRulesSchema.parse(
		JSON.parse(readFileSync(new URL(`./__fixtures__/legacy/${name}.json`, import.meta.url), "utf8")),
	);

const buildFixture = (rules: StyleRule[]): ResumeData => {
	const data = structuredClone(defaultResumeData);
	data.picture.hidden = true;
	data.basics.name = "Ada Lovelace";
	data.basics.headline = "Engineer";
	data.basics.email = "ada@example.com";
	data.summary.hidden = false;
	data.summary.content =
		'<p>Paragraph <strong>bold</strong> <mark>mark</mark> <a href="https://example.com">link</a></p><ul><li>List item</li></ul>';
	data.sections.skills.items = [
		{
			id: "skill-1",
			hidden: false,
			icon: "code",
			iconColor: "",
			name: "Mathematics",
			proficiency: "Expert",
			level: 3,
			keywords: ["Analysis"],
		},
	];
	data.sections.experience.items = [
		{
			id: "experience",
			hidden: false,
			company: "Analytical Engines",
			position: "Engineer",
			location: "London",
			period: "1842",
			website: { url: "", label: "", inlineLink: false },
			description: "<p>Built engines.</p>",
			roles: [
				{
					id: "role-1",
					position: "Senior Engineer",
					period: "1843",
					description: "<p>Led the engine team.</p>",
				},
			],
		},
	];
	data.sections.education.items = [
		{
			id: "education-1",
			hidden: false,
			school: "University of London",
			degree: "BSc",
			area: "Mathematics",
			grade: "First",
			location: "London",
			period: "1835",
			website: { url: "", label: "", inlineLink: false },
			description: "<p>Studied analytical engines.</p>",
		},
	];
	data.sections.awards.items = [
		{
			id: "award-1",
			hidden: false,
			title: "Prize",
			awarder: "Society",
			date: "1843",
			website: { url: "", label: "", inlineLink: false },
			description: "<p>First programmer.</p>",
		},
	];
	data.customSections = [
		{
			id: "1d7312cb-9ba2-4d42-9ca8-2a9ca05f9f37",
			type: "experience",
			title: "Consulting",
			icon: "briefcase",
			columns: 1,
			hidden: false,
			keepTogether: false,
			showHeading: true,
			startOnNewPage: false,
			items: [
				{
					id: "custom-experience-1",
					hidden: false,
					company: "Difference Engines",
					position: "Consultant",
					location: "London",
					period: "1844",
					website: { url: "", label: "", inlineLink: false },
					description: "<p>Advised builders.</p>",
					roles: [],
				},
			],
		},
	];
	data.metadata.layout.pages = [
		{
			fullWidth: true,
			main: ["summary", "experience", "education", "skills", "awards", "1d7312cb-9ba2-4d42-9ca8-2a9ca05f9f37"],
			sidebar: [],
		},
	];
	data.metadata.styleRules = [...rules];
	return data;
};

const render = async (data: ResumeData, template: Template): Promise<Uint8Array> => {
	const document = createElement(ResumeDocument, { data, template }) as unknown as Parameters<typeof renderToBuffer>[0];
	return new Uint8Array(await renderToBuffer(document));
};

// What the API stores on read/write: the legacy rules converted into the resume's Semantic CSS stylesheet.
const adopt = (data: ResumeData): ResumeData => {
	const conversion = convertLegacyStyleRules(data);
	const adopted = structuredClone(data);
	adopted.metadata.styleRules = [...conversion.sanitizedRules];
	adopted.metadata.stylesheet = { mode: "semantic", source: conversion.source };
	return adopted;
};

const comparePdfRasters = async (before: Uint8Array, after: Uint8Array): Promise<string[]> => {
	const beforePages = await rasterizePdf(before);
	const afterPages = await rasterizePdf(after);
	const mismatches: string[] = [];
	if (beforePages.length !== afterPages.length) {
		mismatches.push(`page count: ${beforePages.length} -> ${afterPages.length}`);
	}
	for (const [index, beforePage] of beforePages.entries()) {
		const afterPage = afterPages[index];
		if (!afterPage) continue;
		if (afterPage.width !== beforePage.width || afterPage.height !== beforePage.height) {
			mismatches.push(`page ${index + 1} dimensions changed`);
			continue;
		}
		const changed = pixelmatch(beforePage.data, afterPage.data, undefined, beforePage.width, beforePage.height, {
			threshold: 0,
		});
		if (changed > 0) mismatches.push(`page ${index + 1} pixels: changed=${changed}`);
	}
	return mismatches;
};

// Rules with no visible effect on this fixture: disabled, or restating the award title's existing weight.
const noOpFixtures = new Set<string>(["award-unbold", "disabled-rules"]);

// Unconverted rules no longer render, so the fixture itself is the unstyled baseline.
const drift = async (data: ResumeData, template: Template) =>
	comparePdfRasters(await render(data, template), await render(adopt(data), template));

describe("adopted legacy rules in the rendered PDF", () => {
	it.each(fixtureNames)(
		"renders the converted %s stylesheet",
		async (fixture) => {
			const mismatches = await drift(buildFixture(readRules(fixture)), "onyx");

			if (noOpFixtures.has(fixture)) expect(mismatches).toEqual([]);
			else expect(mismatches).not.toEqual([]);
		},
		30_000,
	);

	it.each(templates)(
		"renders the converted smoke stylesheet on %s",
		async (template) => {
			expect(await drift(buildFixture(readRules("all-templates-smoke")), template)).not.toEqual([]);
		},
		30_000,
	);
});
