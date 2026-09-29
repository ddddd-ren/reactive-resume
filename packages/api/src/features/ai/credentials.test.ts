import { describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({
	ENCRYPTION_SECRET: "test-secret-with-enough-entropy",
	REDIS_URL: "redis://localhost:6379",
}));

vi.mock("@reactive-resume/env/server", () => ({ env: envMock }));

const { assertAgentEnvironment, decryptCredential, encryptCredential, fingerprintCredential } = await import(
	"./credentials"
);

describe("AI credential encryption", () => {
	it("encrypts and decrypts provider API keys without storing plaintext", () => {
		const encrypted = encryptCredential("sk-test-secret");

		expect(encrypted.encryptedApiKey).not.toContain("sk-test-secret");
		expect(encrypted.apiKeyPreview).toBe("sk-t...cret");
		expect(decryptCredential(encrypted.encryptedApiKey)).toBe("sk-test-secret");
	});

	it("generates salted non-revealable fingerprints", () => {
		const first = fingerprintCredential("sk-test-secret", "salt-a");
		const again = fingerprintCredential("sk-test-secret", "salt-a");
		const differentSalt = fingerprintCredential("sk-test-secret", "salt-b");

		expect(first).toBe(again);
		expect(first).not.toBe(differentSalt);
		expect(first).not.toContain("sk-test-secret");
	});
});

describe("AI agent environment", () => {
	it("needs the encryption secret, and works without Redis", () => {
		expect(() => assertAgentEnvironment()).not.toThrow();

		envMock.REDIS_URL = "";
		expect(() => assertAgentEnvironment()).not.toThrow();

		envMock.ENCRYPTION_SECRET = "";
		expect(() => assertAgentEnvironment()).toThrow("AGENT_ENVIRONMENT_UNAVAILABLE");
	});
});
