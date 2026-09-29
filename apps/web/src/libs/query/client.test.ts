import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { getQueryClient } from "./client";

describe("getQueryClient", () => {
	it("returns a QueryClient instance", () => {
		const client = getQueryClient();
		expect(client).toBeInstanceOf(QueryClient);
	});

	it("returns a fresh client on each call", () => {
		const a = getQueryClient();
		const b = getQueryClient();
		expect(a).not.toBe(b);
	});

	it("hashes the query key into a deterministic JSON string", () => {
		const client = getQueryClient();
		const fn = client.getDefaultOptions().queries?.queryKeyHashFn;
		expect(typeof fn).toBe("function");

		const hashA = fn?.(["resumes", { id: "abc" }]);
		const hashB = fn?.(["resumes", { id: "abc" }]);
		const hashC = fn?.(["resumes", { id: "xyz" }]);

		expect(hashA).toBe(hashB);
		expect(hashA).not.toBe(hashC);
		expect(typeof hashA).toBe("string");
		// json/meta envelope is included
		expect(hashA).toContain('"json"');
	});
});
