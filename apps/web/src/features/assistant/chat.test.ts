import type { UIMessage } from "ai";
import { describe, expect, it, vi } from "vitest";
import { transcriptOf } from "./chat";

vi.mock("@/libs/orpc/client", () => ({ streamClient: {} }));

describe("transcriptOf", () => {
	it("names each speaker and leaves tool steps out", () => {
		const messages = [
			{ id: "1", role: "user", parts: [{ type: "text", text: "Tighten my summary" }] },
			{
				id: "2",
				role: "assistant",
				parts: [
					{ type: "tool-read_resume", toolCallId: "t", state: "output-available", input: {}, output: {} },
					{ type: "text", text: "Done. " },
					{ type: "text", text: "Accept it if it reads right." },
				],
			},
			{ id: "3", role: "assistant", parts: [{ type: "step-start" }] },
		] as UIMessage[];

		expect(transcriptOf(messages, { user: "You", assistant: "Assistant" })).toBe(
			"You: Tighten my summary\n\nAssistant: Done. Accept it if it reads right.",
		);
	});
});
