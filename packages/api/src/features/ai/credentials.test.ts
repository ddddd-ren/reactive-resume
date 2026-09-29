import { describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({
	ENCRYPTION_SECRET: "test-secret-with-enough-entropy",
}));

vi.mock("@reactive-resume/env/server", () => ({ env: envMock }));

const { decryptCredential, encryptCredential } = await import("./credentials");

describe("AI credential encryption", () => {
	it("encrypts and decrypts provider API keys without storing plaintext", () => {
		const encrypted = encryptCredential("sk-test-secret");

		expect(encrypted.encryptedApiKey).not.toContain("sk-test-secret");
		expect(encrypted.apiKeyPreview).toBe("sk-t...cret");
		expect(decryptCredential(encrypted.encryptedApiKey)).toBe("sk-test-secret");
	});
});
