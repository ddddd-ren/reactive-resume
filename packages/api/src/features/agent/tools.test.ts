import type { AIProvider } from "@reactive-resume/ai/types";
import { describe, expect, it } from "vitest";
import { buildAgentInstructions, buildAgentTools } from "./tools";

const handlers = {
	readDocument: async () => ({ name: "Resume", updatedAt: "2026-05-13T00:00:00.000Z", data: {} }),
	readAttachment: async () => ({
		id: "attachment-1",
		filename: "job.md",
		mediaType: "text/markdown",
		size: 128,
		content: "Job description",
	}),
	proposeEdits: async () => ({ title: "Tighten", edits: [], skipped: [] }),
};

function buildTools(
	provider: AIProvider,
	options?: { model?: string; baseURL?: string; document?: "resume" | "letter" | null },
) {
	return buildAgentTools({
		provider: { provider, model: options?.model ?? "gpt-5-mini", apiKey: "test-key", baseURL: options?.baseURL ?? "" },
		document: options?.document === undefined ? "resume" : options.document,
		handlers,
	});
}

describe("agent tools", () => {
	it("adds provider-native web search for direct OpenAI providers", () => {
		const tools = buildTools("openai");

		expect(tools).toHaveProperty("web_search");
	});

	it("adds provider-native web search for OpenAI providers using the explicit default base URL", () => {
		const tools = buildTools("openai", { baseURL: "https://api.openai.com/v1" });

		expect(tools).toHaveProperty("web_search");
	});

	it("does not add provider-native web search for OpenAI providers with a custom base URL", () => {
		const tools = buildTools("openai", { baseURL: "https://openai-compatible.example.com/v1" });

		expect(tools).not.toHaveProperty("web_search");
	});

	it.each(["https://api.openai.com/v1?proxy=1", "https://api.openai.com/v1#fragment"])(
		"does not add provider-native web search for OpenAI providers with non-exact base URL %s",
		(baseURL) => {
			const tools = buildTools("openai", { baseURL });

			expect(tools).not.toHaveProperty("web_search");
		},
	);

	it("does not add provider-native web search for unsupported OpenAI models", () => {
		const tools = buildTools("openai", { model: "custom-model" });

		expect(tools).not.toHaveProperty("web_search");
	});

	it.each<AIProvider>(["anthropic", "gemini", "vercel-ai-gateway", "openrouter", "ollama", "openai-compatible"])(
		"does not add provider-native web search for %s",
		(provider) => {
			const tools = buildTools(provider);

			expect(tools).not.toHaveProperty("web_search");
		},
	);

	it("offers the document's read tool and propose_edits only while the document is shared", () => {
		expect(Object.keys(buildTools("openai-compatible")).sort()).toEqual([
			"ask_user_question",
			"propose_edits",
			"read_attachment",
			"read_resume",
		]);
		expect(buildTools("openai-compatible", { document: "letter" })).toHaveProperty("read_letter");
		const withoutDocument = buildTools("openai-compatible", { document: null });
		expect(withoutDocument).not.toHaveProperty("propose_edits");
		expect(withoutDocument).not.toHaveProperty("read_resume");
		// Nothing edits the document directly.
		expect(buildTools("openai-compatible")).not.toHaveProperty("apply_resume_patch");
	});

	it("names the document, includes the posting when shared, and is explicit about web search", () => {
		const document = { kind: "resume" as const, name: "Product Designer" };
		const posting = { role: "Designer", company: "Lumen", text: "Scale a design system." };

		const withAll = buildAgentInstructions({ document, posting, hasProviderNativeSearch: true });
		expect(withAll).toContain('the resume "Product Designer"');
		expect(withAll).toContain("`read_resume`");
		expect(withAll).toContain("Designer at Lumen");
		expect(withAll).toContain("<<<POSTING_START>>>\nScale a design system.\n<<<POSTING_END>>>");
		expect(withAll).toContain("Use `web_search`");
		expect(withAll).not.toMatch(/\{\{\w+\}\}/);

		const bare = buildAgentInstructions({ document: null, posting: null, hasProviderNativeSearch: false });
		expect(bare).toContain("chose not to share");
		expect(bare).not.toContain("POSTING_START");
		expect(bare).toContain("can't browse the web");
		expect(
			buildAgentInstructions({
				document: { kind: "letter", name: "Lumen" },
				posting: null,
				hasProviderNativeSearch: false,
			}),
		).toContain("`read_letter`");
	});
});
