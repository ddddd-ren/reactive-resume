import { describe, expect, it } from "vitest";
import { applicationDto } from "./application";

describe("applicationDto sourceUrl", () => {
	it("rejects URLs that would be unsafe in anchors", () => {
		expect(() =>
			applicationDto.create.input.parse({
				company: "Stripe",
				role: "Engineer",
				sourceUrl: "javascript:alert(1)",
			}),
		).toThrow("URL must use http or https.");
	});
});

describe("applicationDto contacts", () => {
	it("keeps legacy contacts compatible", () => {
		const parsed = applicationDto.create.input.parse({
			company: "Stripe",
			role: "Engineer",
			contacts: [{ name: "Jane Doe" }],
		});

		expect(parsed.contacts?.[0]).toMatchObject({ email: "", phone: "" });
	});
});

describe("applicationDto zero-argument inputs", () => {
	it("normalizes stats input to an empty object", () => {
		expect(applicationDto.stats.input.parse(undefined)).toEqual({});
	});
});
