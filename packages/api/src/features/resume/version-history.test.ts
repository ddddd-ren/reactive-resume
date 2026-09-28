import type { ResumeData } from "@reactive-resume/schema/resume/data";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";

const dbMock = vi.hoisted(() => ({ select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() }));
vi.mock("@reactive-resume/db/client", () => ({ db: dbMock }));

const { deleteVersion, renameVersion, saveSessionVersion, writeVersion } = await import("./version-history");

const MINUTE = 60 * 1000;

// `select().from().where().orderBy().limit()` resolving to `rows`.
const selectChain = (rows: unknown[]) => ({
	from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => rows }) }) }),
});

const insertValues = () => {
	const values = vi.fn((_input: Record<string, unknown>) => ({
		returning: async () => [{ id: "v1", kind: _input.kind, name: _input.name, label: _input.label }],
	}));
	dbMock.insert.mockReturnValue({ values });
	return values;
};

const updateSet = (rows: unknown[] = [{ id: "v1" }]) => {
	const set = vi.fn((_input: Record<string, unknown>) => ({
		where: () => Object.assign(Promise.resolve(), { returning: async () => rows }),
	}));
	dbMock.update.mockReturnValue({ set });
	return set;
};

const data = (): ResumeData => structuredClone(defaultResumeData);

beforeEach(() => {
	for (const mock of Object.values(dbMock)) mock.mockReset();
	dbMock.delete.mockReturnValue({ where: () => Object.assign(Promise.resolve(), { returning: async () => [] }) });
	// The retention query that picks the newest autosaves to keep.
	dbMock.select.mockReturnValue(selectChain([]));
});

describe("writeVersion", () => {
	it("stores normalized data with its kind and an English label, then applies retention", async () => {
		const values = insertValues();
		const input = { ...data(), basics: { ...data().basics, name: "Ada" } };

		await writeVersion(dbMock as never, { resumeId: "r1", userId: "u1", data: input, kind: "before-restore" });

		expect(values).toHaveBeenCalledWith(
			expect.objectContaining({ kind: "before-restore", label: "Before restore", name: null, sessionId: null }),
		);
		expect(values.mock.calls[0]?.[0]).toHaveProperty("data.basics.name", "Ada");
		// Expired versions, then autosaves beyond the cap.
		expect(dbMock.delete).toHaveBeenCalledTimes(2);
	});

	it("labels a named version with its name", async () => {
		const values = insertValues();

		await writeVersion(dbMock as never, { resumeId: "r1", userId: "u1", data: data(), kind: "named", name: "Sent" });

		expect(values).toHaveBeenCalledWith(expect.objectContaining({ kind: "named", name: "Sent", label: "Sent" }));
	});
});

describe("saveSessionVersion", () => {
	const save = (sessionId?: string) =>
		saveSessionVersion({ resumeId: "r1", userId: "u1", data: data(), ...(sessionId ? { sessionId } : {}) });

	it("leaves a session's version alone within two minutes", async () => {
		dbMock.select.mockReturnValueOnce(selectChain([{ id: "v1", createdAt: new Date(Date.now() - MINUTE) }]));

		await save("visit");

		expect(dbMock.update).not.toHaveBeenCalled();
		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it("refreshes the session's one version after two minutes instead of adding another", async () => {
		dbMock.select.mockReturnValueOnce(selectChain([{ id: "v1", createdAt: new Date(Date.now() - 3 * MINUTE) }]));
		const set = updateSet();

		await save("visit");

		expect(set).toHaveBeenCalledWith(expect.objectContaining({ createdAt: expect.any(Date) }));
		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it("starts a session's version on its first save", async () => {
		dbMock.select.mockReturnValueOnce(selectChain([]));
		const values = insertValues();

		await save("visit");

		expect(values).toHaveBeenCalledWith(expect.objectContaining({ kind: "auto", sessionId: "visit" }));
	});

	it("without a session, adds an autosave only when the newest version is two minutes old", async () => {
		const values = insertValues();

		dbMock.select.mockReturnValueOnce(selectChain([{ id: "v1", createdAt: new Date(Date.now() - MINUTE) }]));
		await save();
		expect(values).not.toHaveBeenCalled();

		dbMock.select.mockReturnValueOnce(selectChain([{ id: "v1", createdAt: new Date(Date.now() - 3 * MINUTE) }]));
		await save();
		expect(values).toHaveBeenCalledWith(expect.objectContaining({ kind: "auto", sessionId: null }));
	});

	it("never fails the save", async () => {
		dbMock.select.mockImplementationOnce(() => {
			throw new Error("database down");
		});
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

		await expect(save("visit")).resolves.toBeUndefined();
		warn.mockRestore();
	});
});

describe("named versions", () => {
	it("renames and deletes only named versions", async () => {
		updateSet([]);
		await expect(
			renameVersion({ resumeId: "r1", userId: "u1", versionId: "auto-version", name: "New" }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });

		await expect(deleteVersion({ resumeId: "r1", userId: "u1", versionId: "auto-version" })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
	});
});
