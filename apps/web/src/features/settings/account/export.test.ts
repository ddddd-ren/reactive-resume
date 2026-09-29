import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { buildAccountZip } from "./export";

describe("buildAccountZip", () => {
	it("puts the account, each document and the applications in their own files", () => {
		const zip = buildAccountZip({
			exportedAt: "2026-09-29T00:00:00.000Z",
			user: { id: "u1", name: "Dana" },
			// UUIDv7 ids created seconds apart share their leading (timestamp) characters.
			resumes: [
				{ id: "01a0ec71-03e8-77b1-a5e4-ce04be126204", name: "Product Designer" },
				{ id: "01a0ec71-32c8-728b-b43b-b760a673b825", name: "Product Designer" },
			],
			coverLetters: [{ id: "01a0ec71-a410-71da-9156-b347210cf72b", name: "Product Designer" }],
			applications: [{ id: "app-1", company: "Lumen", role: "Designer" }],
		} as never);

		const files = unzipSync(zip);
		expect(Object.keys(files).sort()).toEqual([
			"account.json",
			"applications.json",
			"letters/product-designer-01a0ec71-a410-71da-9156-b347210cf72b.json",
			"resumes/product-designer-01a0ec71-03e8-77b1-a5e4-ce04be126204.json",
			"resumes/product-designer-01a0ec71-32c8-728b-b43b-b760a673b825.json",
		]);
		expect(JSON.parse(strFromU8(files["account.json"] as Uint8Array))).toEqual({
			exportedAt: "2026-09-29T00:00:00.000Z",
			user: { id: "u1", name: "Dana" },
		});
		expect(JSON.parse(strFromU8(files["applications.json"] as Uint8Array))).toEqual([
			{ id: "app-1", company: "Lumen", role: "Designer" },
		]);
	});
});
