import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";

const mocks = vi.hoisted(() => ({
	letter: { sourceResumeId: "resume" as string | null, sourceApplicationId: "application" as string | null },
	parts: [] as unknown[],
	prompt: "",
}));

vi.mock("ai", () => ({
	streamText: (options: { prompt: string }) => {
		mocks.prompt = options.prompt;
		return {
			stream: (async function* () {
				yield* mocks.parts;
			})(),
		};
	},
}));
vi.mock("../ai/service", () => ({ getModel: () => ({}) }));
vi.mock("../ai-providers/service", () => ({
	aiProvidersService: {
		getDefaultRunnable: async () => ({ label: "OpenAI", provider: "openai", model: "m", apiKey: "k", baseURL: "" }),
	},
}));
vi.mock("./service", () => ({ coverLetterService: { getById: async () => mocks.letter } }));
vi.mock("../resume/service", () => ({ resumeService: { getById: async () => ({ data: defaultResumeData }) } }));
vi.mock("../applications/service", () => ({
	applicationService: {
		getById: async () => ({
			role: "Senior Product Designer",
			company: "Lumen Health",
			jobDescription: "",
			requirements: ["Scale a design system"],
		}),
	},
}));

const { buildLetterDraftPrompt, draftLetterBody } = await import("./draft");

const collect = async (variant: "draft" | "shorter" = "draft") => {
	const chunks: string[] = [];
	for await (const chunk of draftLetterBody({ id: "letter", userId: "user", variant, previous: "Earlier draft" })) {
		chunks.push(chunk);
	}
	return chunks;
};

describe("letter drafts", () => {
	beforeEach(() => {
		mocks.letter = { sourceResumeId: "resume", sourceApplicationId: "application" };
		mocks.parts = [];
	});

	it("asks for a revision only when there's a draft to revise", () => {
		expect(buildLetterDraftPrompt({ variant: "shorter", previous: "  " })).toBe("Write the body of the letter.");
		const revision = buildLetterDraftPrompt({ variant: "personal", job: "Designer at Lumen", previous: "Hello" });
		expect(revision).toContain("More personal: revise the previous draft.");
		expect(revision).toContain("<<<DRAFT_START>>>\nHello\n<<<DRAFT_END>>>");
		expect(buildLetterDraftPrompt({ variant: "draft", previous: "Hello" })).not.toContain("Hello");
	});

	it("streams the text, drawing on the posting's requirements when it has no description", async () => {
		mocks.parts = [
			{ type: "text-start", id: "1" },
			{ type: "text-delta", id: "1", text: "I'm applying" },
			{ type: "text-delta", id: "1", text: " for the role." },
		];
		expect(await collect("shorter")).toEqual(["I'm applying", " for the role."]);
		expect(mocks.prompt).toContain("Shorter: revise the previous draft.");
		expect(mocks.prompt).toContain("Senior Product Designer at Lumen Health");
		expect(mocks.prompt).toContain("- Scale a design system");
	});

	it("stops with the provider's name when the provider fails mid-stream", async () => {
		mocks.parts = [
			{ type: "text-delta", id: "1", text: "Partial" },
			{ type: "error", error: new Error("timeout") },
		];
		await expect(collect()).rejects.toMatchObject({ code: "BAD_GATEWAY", data: { provider: "OpenAI" } });
	});

	it("needs a resume or an application to draw on", async () => {
		mocks.letter = { sourceResumeId: null, sourceApplicationId: null };
		await expect(collect()).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});
