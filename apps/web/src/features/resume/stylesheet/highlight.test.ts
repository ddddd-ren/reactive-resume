import type { SemanticNode } from "@reactive-resume/resume/stylesheet";
import { describe, expect, it } from "vitest";
import { matchedNodeKeys, ruleSpans } from "./highlight";

const node = (key: string, kind: SemanticNode["kind"], id?: string, children: SemanticNode[] = []): SemanticNode => ({
	key,
	kind,
	...(id ? { id } : {}),
	attributes: {},
	roles: [],
	children,
});

const tree = node("resume", "resume", undefined, [
	node("s-exp", "section", "experience", [node("s-exp/a", "item", "a"), node("s-exp/b", "item", "b")]),
	node("s-edu", "section", "education", [node("s-edu/c", "item", "c")]),
]);

describe("ruleSpans", () => {
	it("finds rules, including the ones inside @media, and ignores braces in comments and strings", () => {
		const text = `/* a { } */\nsection { color: red; }\n@media (width > 1pt) { item { content: "}"; } }`;
		expect(ruleSpans(text).map(({ selector }) => selector)).toEqual(["section", "item"]);
	});
});

describe("matchedNodeKeys", () => {
	const text = `/* Experience › A */\nsection[id="experience"] item[id="a"] {\n\tcolor: red;\n}\n\nitem { margin: 0; }`;

	it("matches the rule the cursor is in, from its comment to its closing brace", () => {
		expect(matchedNodeKeys(text, 3, tree)).toEqual(["s-exp/a"]);
		expect(matchedNodeKeys(text, text.indexOf("color"), tree)).toEqual(["s-exp/a"]);
		expect(matchedNodeKeys(text, text.indexOf("margin"), tree)).toEqual(["s-exp/a", "s-exp/b", "s-edu/c"]);
	});

	it("matches nothing between rules or for a selector that doesn't parse", () => {
		expect(matchedNodeKeys(text, text.indexOf("}\n\n") + 2, tree)).toEqual([]);
		expect(matchedNodeKeys("item[ { color: red; }", 10, tree)).toEqual([]);
	});
});
