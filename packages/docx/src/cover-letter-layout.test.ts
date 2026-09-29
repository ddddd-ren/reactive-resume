import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const builderSource = readFileSync(fileURLToPath(new URL("./builder.ts", import.meta.url)), "utf8");

describe("cover letter DOCX layout", () => {
	it("gates resume headers for cover-letter-only documents", () => {
		expect(builderSource).toContain("shouldShowResumeHeader(data)");
		expect(builderSource).toContain('layout.headerPlacement === "full-width" && showHeader');
		expect(builderSource).toContain('layout.headerPlacement === "main-only" && showHeader');
		expect(builderSource).toContain('layout.headerPlacement === "sidebar-only" && showHeader');
	});
});
