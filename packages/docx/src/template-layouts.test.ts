import { describe, expect, it } from "vitest";
import { templateLayouts } from "@reactive-resume/schema/templates";
import { planPageColumns, TEMPLATE_CONFIGS } from "./builder";

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

describe("planPageColumns", () => {
	const page = { fullWidth: false, main: ["experience"], sidebar: ["skills"] };

	it("splits the page only for a two-column template with sidebar sections", () => {
		expect(planPageColumns(page, "azurill")).toEqual({ kind: "split" });
		expect(planPageColumns({ ...page, sidebar: [] }, "azurill")).toEqual({ kind: "single", sections: ["experience"] });
	});

	it("prints a one-column template's sidebar after the main sections, as the PDF does", () => {
		expect(planPageColumns(page, "onyx")).toEqual({ kind: "single", sections: ["experience", "skills"] });
	});

	it("prints no sidebar on a full-width page, as the PDF does", () => {
		expect(planPageColumns({ ...page, fullWidth: true }, "azurill")).toEqual({
			kind: "single",
			sections: ["experience"],
		});
		expect(planPageColumns({ ...page, fullWidth: true }, "onyx")).toEqual({ kind: "single", sections: ["experience"] });
	});
});
