import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { buildAccountZip } from "./export";

describe("buildAccountZip", () => {
	it("puts the account, each document and the applications in their own files", () => {
		const zip = buildAccountZip({
			exportedAt: "2026-09-29T00:00:00.000Z",
			user: { id: "u1", name: "Dana" },
			resumes: [
				{ id: "resume-aaaaaaaa-1", name: "Product Designer" },
				{ id: "resume-bbbbbbbb-2", name: "Product Designer" },
			],
			coverLetters: [{ id: "letter-cccccccc", name: "Lumen letter" }],
			applications: [{ id: "app-1", company: "Lumen", role: "Designer" }],
		} as never);

		const files = unzipSync(zip);
		expect(Object.keys(files).sort()).toEqual([
			"account.json",
			"applications.json",
			"letters/lumen-letter-letter-c.json",
			"resumes/product-designer-resume-a.json",
			"resumes/product-designer-resume-b.json",
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
