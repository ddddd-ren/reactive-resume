import { describe, expect, it } from "vitest";
import { describeTest, keyEnding, providerOptions } from "./catalog";

const labels = { connected: "Connected", failed: "Failed" };

describe("provider rows", () => {
	it("says how long a passing test took, rounded to the millisecond", () => {
		expect(describeTest({ testStatus: "success", testError: null }, 419.6, labels)).toEqual({
			ok: true,
			label: "Connected · 420 ms",
			error: null,
		});
	});

	it("keeps the provider's own error for a failing test", () => {
		expect(describeTest({ testStatus: "failure", testError: " 401 Incorrect API key " }, 90, labels)).toEqual({
			ok: false,
			label: "Failed",
			error: "401 Incorrect API key",
		});
		expect(describeTest({ testStatus: "failure", testError: null }, 90, labels).error).toBeNull();
	});

	it("shows only the key's last four characters", () => {
		expect(keyEnding("sk-a...9f2a")).toBe("…9f2a");
		expect(keyEnding("••••")).toBe("••••");
	});

	it("offers all sixteen providers", () => {
		expect(providerOptions).toHaveLength(16);
	});
});
