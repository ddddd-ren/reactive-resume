import { describe, expect, it } from "vitest";
import { templateLayouts } from "@reactive-resume/schema/templates";
import { TEMPLATE_CONFIGS } from "./builder";

describe("DOCX template configs", () => {
	it("put the sidebar and header where the PDF does for two-column templates", () => {
		for (const [template, layout] of Object.entries(templateLayouts)) {
			if (layout.columns !== 2) continue;
			const config = TEMPLATE_CONFIGS[template as keyof typeof TEMPLATE_CONFIGS];
			expect({ sidebarSide: config.sidebarSide, headerPosition: config.headerPosition }, template).toEqual({
				sidebarSide: layout.sidebarSide,
				headerPosition: layout.headerPlacement,
			});
		}
	});
});
