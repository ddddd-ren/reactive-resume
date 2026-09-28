import { describe, expect, it } from "vitest";
import { repairAgentToolCall, repairProposeEditsInput } from "./repair";

const VALID_INPUT = JSON.stringify({
	title: "Tighten",
	edits: [{ passageId: "p_1", text: "Led the redesign", why: "Stronger verb." }],
});

describe("repairProposeEditsInput", () => {
	it("repairs sloppy JSON (single quotes, trailing commas)", () => {
		const sloppy = `{'title': 'Tighten', 'edits': [{'passageId': 'p_1', 'text': 'Led it', 'why': 'Verb.'},]}`;
		expect(JSON.parse(repairProposeEditsInput(sloppy) ?? "")).toMatchObject({ title: "Tighten" });
	});

	it("returns null when the input cannot be made schema-valid", () => {
		expect(repairProposeEditsInput(`{"title": "Tighten", "edits": []}`)).toBeNull();
		expect(repairProposeEditsInput("not even close {{{")).toBeNull();
	});
});

describe("repairAgentToolCall", () => {
	const call = (toolName: string, input: string) =>
		({ type: "tool-call" as const, toolCallId: "call-1", toolName, input }) as never;

	it("repairs propose_edits and leaves other tools and valid input alone", async () => {
		const repaired = await repairAgentToolCall({
			toolCall: call("propose_edits", `${VALID_INPUT.slice(0, -1)},}`),
		} as never);
		expect(repaired?.input).toBe(VALID_INPUT);
		expect(await repairAgentToolCall({ toolCall: call("propose_edits", VALID_INPUT) } as never)).toBeNull();
		expect(await repairAgentToolCall({ toolCall: call("read_resume", "{") } as never)).toBeNull();
	});
});
