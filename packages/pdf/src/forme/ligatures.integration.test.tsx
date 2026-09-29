import { describe, expect, it } from "vitest";
import * as forme from "@formepdf/core";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { renderResume } from "./render";

const words = "Profiles efficient office affluent flourish";

const extractedText = async (fontFamily: string) => {
	const data = structuredClone(defaultResumeData);
	data.picture.hidden = true;
	data.basics.name = "Ligature Probe";
	data.summary.content = `<p>${words}</p>`;
	data.metadata.layout.pages = [{ fullWidth: true, main: ["summary"], sidebar: [] }];
	data.metadata.typography.body.fontFamily = fontFamily;
	data.metadata.typography.heading.fontFamily = fontFamily;
	const { pdf } = await renderResume(forme, { data, template: "onyx" });
	const document = await getDocument({ data: pdf }).promise;
	const page = await document.getPage(1);
	return (await page.getTextContent()).items.map((item) => ("str" in item ? item.str : "")).join(" ");
};

// Forme 0.25 keeps only the first letter of a ligature in the text layer (#156), so ligatures are switched off in
// the font bytes. A font with fi/fl/ff ligatures must still extract every letter.
describe("ligatures", () => {
	it.each(["Fira Sans", "IBM Plex Serif"])("extract whole words in %s", { timeout: 60_000 }, async (family) => {
		const text = (await extractedText(family)).replaceAll(/\s+/g, " ");
		for (const word of words.split(" ")) expect(text).toContain(word);
	});
});
