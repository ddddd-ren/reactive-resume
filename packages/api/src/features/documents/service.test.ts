import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({ select: vi.fn(), update: vi.fn(), delete: vi.fn() }));
const resumeServiceMock = vi.hoisted(() => ({
	getById: vi.fn(),
	create: vi.fn(),
	delete: vi.fn(),
	setLocked: vi.fn(),
}));
vi.mock("@reactive-resume/db/client", () => ({ db: dbMock }));
vi.mock("../resume/service", () => ({ resumeService: resumeServiceMock }));
vi.mock("../cover-letters/service", () => ({ linkLetterApplication: vi.fn() }));

const { documentsService, suggestCopyName } = await import("./service");

// `select().from().where()` (optionally `.leftJoin()` first) resolving to `rows`.
const rows = (result: unknown[]) => {
	const where = () => Promise.resolve(result);
	return { from: () => ({ where, leftJoin: () => ({ where }) }) };
};

const updates = () => {
	const set = vi.fn((_changes: Record<string, unknown>) => ({
		where: () => Object.assign(Promise.resolve(), { returning: async () => [{ id: "x" }] }),
	}));
	dbMock.update.mockReturnValue({ set });
	return set;
};

beforeEach(() => {
	for (const mock of [...Object.values(dbMock), ...Object.values(resumeServiceMock)]) mock.mockReset();
	dbMock.delete.mockReturnValue({ where: async () => undefined });
});

describe("suggestCopyName", () => {
	it("uses the source's base name and the company, or marks a plain copy", () => {
		expect(suggestCopyName("Product Designer — Lumen", "Orbital")).toBe("Product Designer — Orbital");
		expect(suggestCopyName("Product Designer")).toBe("Product Designer (copy)");
	});
});

describe("Trash", () => {
	it("won't move a locked document, and keeps the resume's error code", async () => {
		dbMock.select.mockReturnValueOnce(rows([{ isLocked: true, trashedAt: null }]));

		await expect(documentsService.trash({ userId: "u1", type: "resume", id: "r1" })).rejects.toMatchObject({
			code: "RESUME_LOCKED",
		});
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("moves an unlocked letter to Trash and moves its revision on", async () => {
		dbMock.select.mockReturnValueOnce(rows([{ isLocked: false, trashedAt: null }]));
		const set = updates();

		await documentsService.trash({ userId: "u1", type: "letter", id: "l1" });

		expect(set).toHaveBeenCalledWith(
			expect.objectContaining({ trashedAt: expect.any(Date), revision: expect.anything() }),
		);
	});

	it("deletes for good only what is already in Trash", async () => {
		dbMock.select.mockReturnValueOnce(rows([{ isLocked: false, trashedAt: null }]));
		await expect(documentsService.purge({ userId: "u1", type: "resume", id: "r1" })).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});

		dbMock.select.mockReturnValueOnce(rows([{ isLocked: false, trashedAt: new Date() }]));
		await documentsService.purge({ userId: "u1", type: "resume", id: "r1" });
		expect(resumeServiceMock.delete).toHaveBeenCalledWith({ id: "r1", userId: "u1" });
	});
});

describe("list", () => {
	it("purges documents trashed over 30 days ago, then merges resumes and letters by last edit", async () => {
		const day = (n: number) => new Date(2026, 8, n);
		dbMock.select
			// Expired Trash: one old resume, no letters.
			.mockReturnValueOnce(rows([{ id: "old" }]))
			.mockReturnValueOnce(rows([]))
			// The live documents.
			.mockReturnValueOnce(
				rows([
					{
						id: "r1",
						name: "Resume",
						tags: [],
						isLocked: false,
						trashedAt: null,
						createdAt: day(1),
						updatedAt: day(2),
						applicationId: "a1",
						company: "Lumen",
						role: "Designer",
					},
				]),
			)
			.mockReturnValueOnce(
				rows([
					{
						id: "l1",
						name: "Letter",
						tags: [],
						isLocked: false,
						trashedAt: null,
						createdAt: day(1),
						updatedAt: day(5),
						applicationId: null,
						company: null,
						role: null,
					},
				]),
			);

		const documents = await documentsService.list({ userId: "u1", trashed: false });

		expect(resumeServiceMock.delete).toHaveBeenCalledWith({ id: "old", userId: "u1" });
		expect(documents.map((document) => [document.type, document.id])).toEqual([
			["letter", "l1"],
			["resume", "r1"],
		]);
		expect(documents[1]?.application).toEqual({ id: "a1", company: "Lumen", role: "Designer" });
		expect(documents[0]?.application).toBeNull();
	});
});

describe("copyForJob", () => {
	const source = {
		name: "Product Designer — Lumen",
		tags: ["design"],
		data: { metadata: { page: { locale: "en-US" } } },
	};

	it("links the copy to the job, and gives the job the copy when it has no resume", async () => {
		resumeServiceMock.getById.mockResolvedValueOnce(source);
		dbMock.select.mockReturnValueOnce(rows([{ id: "a1", company: "Orbital", resumeId: null }]));
		resumeServiceMock.create.mockResolvedValueOnce("copy");
		const set = updates();

		const id = await documentsService.copyForJob({ userId: "u1", resumeId: "r1", applicationId: "a1" });

		expect(id).toBe("copy");
		expect(resumeServiceMock.create).toHaveBeenCalledWith(
			expect.objectContaining({ name: "Product Designer — Orbital", tags: ["design"] }),
		);
		expect(set).toHaveBeenCalledWith({ applicationId: "a1" });
		expect(set).toHaveBeenCalledWith({ resumeId: "copy" });
	});

	it("leaves an application's existing resume alone", async () => {
		resumeServiceMock.getById.mockResolvedValueOnce(source);
		dbMock.select.mockReturnValueOnce(rows([{ id: "a1", company: "Orbital", resumeId: "base" }]));
		resumeServiceMock.create.mockResolvedValueOnce("copy");
		const set = updates();

		await documentsService.copyForJob({ userId: "u1", resumeId: "r1", applicationId: "a1", name: "Mine" });

		expect(resumeServiceMock.create).toHaveBeenCalledWith(expect.objectContaining({ name: "Mine" }));
		expect(set).toHaveBeenCalledTimes(1);
	});
});
