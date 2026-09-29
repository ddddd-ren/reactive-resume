import { beforeEach, describe, expect, it, vi } from "vitest";
import { APICallError, generateText, RetryError } from "ai";
import { z } from "zod";

const protectedProcedureMock = vi.hoisted(() => {
	const chain = {
		route: vi.fn(() => chain),
		input: vi.fn(() => chain),
		use: vi.fn(() => chain),
		output: vi.fn(() => chain),
		errors: vi.fn(() => chain),
		handler: vi.fn(() => chain),
	};
	return chain;
});

vi.mock("ai", async (importOriginal) => ({
	...(await importOriginal<typeof import("ai")>()),
	generateText: vi.fn(),
}));
vi.mock("../../context", () => ({ protectedProcedure: protectedProcedureMock }));
vi.mock("../../middleware/rate-limit", () => ({ aiRequestRateLimit: vi.fn() }));
vi.mock("../ai/service", () => ({ getModel: vi.fn() }));
vi.mock("../ai-providers/service", () => ({ aiProvidersService: { getDefaultRunnable: vi.fn() } }));
vi.mock("../resume/service", () => ({ resumeService: { getById: vi.fn(), create: vi.fn() } }));
vi.mock("../cover-letters/service", () => ({ coverLetterService: { create: vi.fn() } }));
vi.mock("./service", () => ({
	applicationService: { getById: vi.fn(), setAiResult: vi.fn(), update: vi.fn(), addNote: vi.fn() },
}));

const { generateJson, generatePlainText } = await import("./ai");

describe("copilot provider-failure translation", () => {
	const schema = z.object({ summary: z.string() });

	beforeEach(() => {
		vi.mocked(generateText).mockReset();
	});

	it("translates APICallError provider failures to BAD_GATEWAY in generateJson", async () => {
		vi.mocked(generateText).mockRejectedValue(
			new APICallError({
				message: "Model not found",
				url: "https://api.openai.com/v1/chat/completions",
				requestBodyValues: undefined,
				statusCode: 404,
			}),
		);

		await expect(generateJson({} as never, { prompt: "prompt" }, schema)).rejects.toMatchObject({
			code: "BAD_GATEWAY",
		});
	});

	it("translates RetryError with maxRetriesExceeded to BAD_GATEWAY", async () => {
		const providerError = new APICallError({
			message: "Provider returned 500",
			url: "https://api.openai.com/v1/chat/completions",
			requestBodyValues: undefined,
			statusCode: 500,
		});
		vi.mocked(generateText).mockRejectedValue(
			new RetryError({
				message: "Failed to generate text after 3 attempts",
				reason: "maxRetriesExceeded",
				errors: [providerError],
			}),
		);

		await expect(generatePlainText({} as never, "prompt")).rejects.toMatchObject({ code: "BAD_GATEWAY" });
	});

	it("preserves the provider error as the BAD_GATEWAY cause", async () => {
		const providerError = new APICallError({
			message: "quota exceeded",
			url: "https://api.openai.com/v1/chat/completions",
			requestBodyValues: undefined,
			statusCode: 429,
		});
		vi.mocked(generateText).mockRejectedValue(providerError);

		const error: { code?: string; cause?: unknown } = await generatePlainText({} as never, "prompt").catch(
			(thrown) => thrown,
		);
		expect(error.code).toBe("BAD_GATEWAY");
		expect(error.cause).toBe(providerError);
	});
});
