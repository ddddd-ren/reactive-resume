import type { CoverLetter } from "@reactive-resume/schema/cover-letter/data";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ORPCError } from "@orpc/client";
import { copyCoverLetterStyle } from "@reactive-resume/resume/cover-letter";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";

const mocks = vi.hoisted(() => ({ update: vi.fn(), draft: vi.fn() }));
vi.mock("@/libs/orpc/client", () => ({
	client: { coverLetters: { update: mocks.update } },
	streamClient: { coverLetters: { draft: mocks.draft } },
}));

const { discardLetterDraft, startLetterDraft, useLetterEditorStore } = await import("./store");

const letter: CoverLetter = {
	id: "letter",
	name: "Letter",
	recipient: "",
	content: "<p>Mine</p>",
	style: copyCoverLetterStyle(defaultResumeData),
	layout: "structured",
	recipientName: "",
	recipientCompany: "",
	letterDate: null,
	sourceResumeId: "resume",
	sourceApplicationId: null,
	senderLinked: true,
	designLinked: true,
	isLocked: false,
	revision: 1,
	createdAt: new Date(),
	updatedAt: new Date(),
};

const store = () => useLetterEditorStore.getState();

function* chunks(...parts: unknown[]) {
	for (const part of parts) {
		if (part instanceof Error) throw part;
		yield part as string;
	}
}

beforeEach(() => {
	vi.resetAllMocks();
	store().load(letter);
});

describe("saving", () => {
	it("keeps what was typed while the server's copy comes back trimmed, and bumps the revision", async () => {
		mocks.update.mockImplementation(async (input: { recipientName: string }) => ({
			...letter,
			recipientName: input.recipientName.trim(),
			revision: 2,
		}));
		store().edit({ recipientName: "Dana " });
		await store().flush();
		expect(mocks.update).toHaveBeenCalledWith(
			expect.objectContaining({ id: "letter", expectedRevision: 1, recipientName: "Dana " }),
		);
		expect(store().letter).toMatchObject({ recipientName: "Dana ", revision: 2 });
		expect(store().status).toBe("saved");
	});

	it("stops saving after a conflict and keeps the edits", async () => {
		mocks.update.mockRejectedValue(new ORPCError("CONFLICT"));
		store().edit({ content: "<p>Changed</p>" });
		await store().flush();
		expect(store().status).toBe("conflict");
		expect(store().pending).toEqual({ content: "<p>Changed</p>" });
		store().edit({ content: "<p>More</p>" });
		await store().flush();
		expect(mocks.update).toHaveBeenCalledTimes(1);
	});
});

describe("drafts", () => {
	it("streams a draft beside the body, which only changes when the draft is kept", async () => {
		mocks.draft.mockResolvedValue(chunks("I'm applying", " for the role."));
		await startLetterDraft();
		expect(mocks.draft).toHaveBeenCalledWith({ id: "letter", variant: "draft" }, expect.anything());
		expect(store().draft).toEqual({ phase: "ready", text: "I'm applying for the role." });
		expect(store().letter?.content).toBe("<p>Mine</p>");

		discardLetterDraft();
		expect(store().draft).toEqual({ phase: "idle" });
		expect(store().letter?.content).toBe("<p>Mine</p>");
	});

	it("revises the draft it's given and names the provider when it stops", async () => {
		mocks.draft.mockResolvedValue(chunks("Partial", new ORPCError("BAD_GATEWAY", { data: { provider: "OpenAI" } })));
		await startLetterDraft("shorter", "The earlier draft");
		expect(mocks.draft).toHaveBeenCalledWith(
			{ id: "letter", variant: "shorter", previous: "The earlier draft" },
			expect.anything(),
		);
		expect(store().draft).toMatchObject({ phase: "failed", provider: "OpenAI" });
		expect(store().letter?.content).toBe("<p>Mine</p>");
	});
});
