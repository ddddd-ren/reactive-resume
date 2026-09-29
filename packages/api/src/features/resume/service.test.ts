import type { ResumeData } from "@reactive-resume/schema/resume/data";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";

// Characterization tests for the resume service. The goal is to pin down CURRENT behavior
// (CRUD / lock / password / statistics branching) so later changes are deliberate. The DB
// layer and side-effecting helpers are mocked; the branching in service.ts is what's under test.

const dbMock = vi.hoisted(() => ({
	select: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
	transaction: vi.fn(),
}));
const hashMock = vi.hoisted(() => vi.fn());
const compareMock = vi.hoisted(() => vi.fn());
const publishResumeUpdatedMock = vi.hoisted(() => vi.fn());
const grantResumeAccessMock = vi.hoisted(() => vi.fn());
const hasResumeAccessMock = vi.hoisted(() => vi.fn());
const storageDeleteMock = vi.hoisted(() => vi.fn());

vi.mock("../cover-letters/embedded", () => ({ adoptEmbeddedLetters: vi.fn(async () => undefined) }));
vi.mock("@reactive-resume/db/client", () => ({ db: dbMock }));
vi.mock("@reactive-resume/db/schema", () => ({
	resume: {
		id: "id",
		userId: "user_id",
		slug: "slug",
		name: "name",
		tags: "tags",
		data: "data",
		isPublic: "is_public",
		showDownloadButtons: "show_download_buttons",
		isLocked: "is_locked",
		password: "password",
		updatedAt: "updated_at",
		createdAt: "created_at",
	},
	resumeStatistics: {
		resumeId: "resume_id",
		views: "views",
		downloads: "downloads",
		lastViewedAt: "last_viewed_at",
		lastDownloadedAt: "last_downloaded_at",
	},
	resumeStatisticsDaily: {
		resumeId: "resume_id",
		date: "date",
		views: "views",
		downloads: "downloads",
	},
	resumeVersion: {
		id: "id",
		resumeId: "resume_id",
		userId: "user_id",
		data: "data",
		createdAt: "created_at",
	},
	user: { id: "id", username: "username" },
}));
vi.mock("drizzle-orm", () => ({
	and: (...a: unknown[]) => a,
	arrayContains: (...a: unknown[]) => a,
	asc: (x: unknown) => x,
	desc: (x: unknown) => x,
	eq: (...a: unknown[]) => a,
	gte: (...a: unknown[]) => a,
	isNotNull: (...a: unknown[]) => a,
	isNull: (...a: unknown[]) => a,
	notInArray: (...a: unknown[]) => a,
	sql: Object.assign((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }), {
		join: (values: unknown[]) => values,
	}),
}));
vi.mock("bcrypt", () => ({ hash: hashMock, compare: compareMock }));
vi.mock("./events", () => ({ publishResumeUpdated: publishResumeUpdatedMock }));
vi.mock("./access", () => ({
	grantResumeAccess: grantResumeAccessMock,
	hasResumeAccess: hasResumeAccessMock,
}));
vi.mock("../storage/service", () => ({
	getStorageService: () => ({ delete: storageDeleteMock }),
}));
// Version history and slugs have their own tests; here they only need to be called at the right moments.
const versionHistoryMock = vi.hoisted(() => ({
	writeVersion: vi.fn(),
	saveSessionVersion: vi.fn(),
	getVersion: vi.fn(),
	listVersions: vi.fn(),
	renameVersion: vi.fn(),
	deleteVersion: vi.fn(),
}));
vi.mock("./version-history", () => versionHistoryMock);
const recordSlugChangeMock = vi.hoisted(() => vi.fn());
vi.mock("./slugs", () => ({
	SLUG_PATTERN: /^[a-z0-9]+(-[a-z0-9]+)*$/,
	checkSlug: vi.fn(),
	findFreeSlug: vi.fn(async () => "generated-slug"),
	matchesSlug: (slug: string) => ["slug", slug],
	recordSlugChange: recordSlugChangeMock,
}));

const { resumeService } = await import("./service");
const { parseStoredResumeData } = await import("./resume-data-validation");

// A lookup by username and slug: `select().from().innerJoin().where().orderBy().limit()` resolving to `rows`.
const slugLookup = (rows: unknown[]) => ({
	from: () => ({ innerJoin: () => ({ where: () => ({ orderBy: () => ({ limit: async () => rows }) }) }) }),
});

// A `db.update(...).set(...).where(...).returning(...)` chain that resolves to `rows`.
const createUpdateChain = (rows: unknown[]) => {
	const returning = vi.fn(() => Promise.resolve(rows));
	const where = vi.fn(() => ({ returning }));
	const set = vi.fn((_input: unknown) => ({ where }));
	return { chain: { set }, set, where, returning };
};

// A `db.select(...).from(...).where(...)` chain that resolves to `rows`.
const createSelectChain = (rows: unknown[]) => ({
	from: () => ({ where: () => Promise.resolve(rows) }),
});

const createLockedSelectChain = (rows: unknown[]) => {
	const forUpdate = vi.fn(() => Promise.resolve(rows));
	return {
		chain: { from: () => ({ where: () => ({ for: forUpdate }) }) },
		forUpdate,
	};
};

const createSemanticResumeData = (): ResumeData => {
	const data: ResumeData = structuredClone(defaultResumeData);
	data.metadata.stylesheet = {
		mode: "semantic",
		source: { languageVersion: 1, text: "@version 1;\n" },
	};
	return data;
};

const createRendererUnsafeResumeData = (): ResumeData =>
	({
		...structuredClone(defaultResumeData),
		customSections: [
			{
				id: "custom-experience",
				type: "experience",
				title: "Experience",
				icon: "",
				columns: 1,
				hidden: false,
				keepTogether: false,
				startOnNewPage: false,
				items: [{ id: "summary-shaped-item", hidden: false, content: "<p>Missing company</p>" }],
			},
		],
	}) as unknown as ResumeData;

const createOverlappingRendererSafeResumeData = (): ResumeData =>
	({
		...structuredClone(defaultResumeData),
		customSections: [
			{
				id: "custom-experience",
				type: "experience",
				title: "Experience",
				icon: "",
				columns: 1,
				hidden: false,
				keepTogether: false,
				startOnNewPage: false,
				items: [
					{
						id: "experience-item",
						hidden: false,
						company: "Analytical Engines",
						position: "Programmer",
						location: "London",
						period: "1842–1843",
						description: "<p>Wrote the first algorithm.</p>",
						content: "<p>Renderer-irrelevant overlap must survive.</p>",
					},
				],
			},
		],
	}) as unknown as ResumeData;

const createResumeRow = (data: ResumeData, updatedAt = new Date()) => ({
	id: "r1",
	name: "Resume",
	slug: "resume",
	tags: [],
	data,
	isPublic: false,
	isLocked: false,
	updatedAt,
	hasPassword: false,
});

const createRestoreHarness = (currentData: ResumeData, restoredData: ResumeData) => {
	const currentRow = createResumeRow(currentData);
	dbMock.select.mockReturnValueOnce(createSelectChain([currentRow]));
	versionHistoryMock.getVersion.mockImplementationOnce(async () => ({ data: parseStoredResumeData(restoredData) }));
	const snapshotValues = versionHistoryMock.writeVersion;

	const lockedSelect = createLockedSelectChain([
		{
			data: currentData,
			isLocked: false,
			updatedAt: currentRow.updatedAt,
		},
	]);
	let persistedData: ResumeData | undefined;
	const returning = vi.fn(() =>
		Promise.resolve([createResumeRow(persistedData ?? restoredData, new Date("2026-01-02T00:00:00Z"))]),
	);
	const where = vi.fn(() => ({ returning }));
	const set = vi.fn((values: { data: ResumeData }) => {
		persistedData = values.data;
		return { where };
	});
	dbMock.transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) =>
		callback({ select: () => lockedSelect.chain, update: () => ({ set }) }),
	);

	return { set, snapshotValues };
};

beforeEach(() => {
	dbMock.select.mockReset();
	dbMock.insert.mockReset();
	dbMock.update.mockReset();
	dbMock.delete.mockReset();
	dbMock.transaction.mockReset();
	hashMock.mockReset();
	compareMock.mockReset();
	publishResumeUpdatedMock.mockReset();
	grantResumeAccessMock.mockReset();
	hasResumeAccessMock.mockReset();
	storageDeleteMock.mockReset();
	for (const mock of Object.values(versionHistoryMock)) mock.mockReset();
	versionHistoryMock.writeVersion.mockResolvedValue({ id: "v" });
	versionHistoryMock.saveSessionVersion.mockResolvedValue(undefined);
	recordSlugChangeMock.mockReset();
	hashMock.mockResolvedValue("hashed-password");
	publishResumeUpdatedMock.mockResolvedValue(undefined);
	storageDeleteMock.mockResolvedValue(true);
});

it("imports", () => {
	expect(resumeService).toBeDefined();
});

describe("create", () => {
	// The resume and any letters it carried save in one transaction.
	beforeEach(() => {
		dbMock.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback(dbMock));
	});

	it("rejects out-of-range values before creating any record", async () => {
		const data = structuredClone(defaultResumeData);
		data.metadata.page.marginX = 500;
		dbMock.insert.mockReturnValue({ values: vi.fn(() => Promise.resolve()) });
		await expect(
			resumeService.create({ userId: "u1", name: "Resume", slug: "resume", tags: [], locale: "en-US", data }),
		).rejects.toMatchObject({ code: "BAD_REQUEST", status: 400 });
		expect(dbMock.insert).not.toHaveBeenCalled();
		expect(publishResumeUpdatedMock).not.toHaveBeenCalled();
	});

	it("copies stylesheet content", async () => {
		const data = createSemanticResumeData();
		const values = vi.fn((_input: unknown) => Promise.resolve());
		dbMock.insert.mockReturnValueOnce({ values });

		await resumeService.create({
			userId: "u1",
			name: "Copy",
			slug: "copy",
			tags: [],
			locale: "en-US",
			data,
		});

		expect(values).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					metadata: expect.objectContaining({ stylesheet: data.metadata.stylesheet }),
				}),
			}),
		);
	});

	it("rejects renderer-unsafe data from direct and duplicate callers before insertion", async () => {
		const values = vi.fn(() => Promise.resolve());
		dbMock.insert.mockReturnValueOnce({ values });

		const error = await resumeService
			.create({
				userId: "u1",
				name: "Unsafe copy",
				slug: "unsafe-copy",
				tags: [],
				locale: "en-US",
				data: createRendererUnsafeResumeData(),
			})
			.catch((caught: unknown) => caught);

		expect(error).toMatchObject({ code: "BAD_REQUEST", status: 400 });
		expect(error).toHaveProperty("cause.issues.0.path", ["customSections", 0, "items", 0, "company"]);
		expect(values).not.toHaveBeenCalled();
	});

	it("persists normalized renderer-safe overlapping data", async () => {
		const values = vi.fn((_input: unknown) => Promise.resolve());
		dbMock.insert.mockReturnValueOnce({ values });

		await resumeService.create({
			userId: "u1",
			name: "Compatible",
			slug: "compatible",
			tags: [],
			locale: "en-US",
			data: createOverlappingRendererSafeResumeData(),
		});

		expect(values.mock.calls[0]?.[0]).toHaveProperty(
			"data.customSections.0.items.0.content",
			"<p>Renderer-irrelevant overlap must survive.</p>",
		);
		expect(values.mock.calls[0]?.[0]).toHaveProperty("data.customSections.0.items.0.roles", []);
		expect(values.mock.calls[0]?.[0]).toHaveProperty("data.customSections.0.items.0.website", {
			url: "",
			label: "",
			inlineLink: false,
		});
	});
});

describe("create", () => {
	// The resume and any letters it carried save in one transaction.
	beforeEach(() => {
		dbMock.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback(dbMock));
	});

	it("generates a unique slug from the name and starts History with the document's origin", async () => {
		const values = vi.fn((_input: unknown) => Promise.resolve());
		dbMock.insert.mockReturnValueOnce({ values });

		await resumeService.create({ userId: "u1", name: "My Resume", tags: [], locale: "en-US", origin: "import" });

		expect(values).toHaveBeenCalledWith(expect.objectContaining({ slug: "generated-slug" }));
		expect(versionHistoryMock.writeVersion).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ userId: "u1", kind: "import" }),
		);
	});
});

describe("versions.restore", () => {
	it("normalizes a historical applied stylesheet while restoring its canonical source", async () => {
		const currentData = createSemanticResumeData();
		const restoredData = createSemanticResumeData();
		const source = { languageVersion: 1, text: "@version 1;\nname { color: blue; }\n" };
		const legacyRestoredData = {
			...restoredData,
			metadata: {
				...restoredData.metadata,
				stylesheet: {
					mode: "semantic",
					source,
					applied: { languageVersion: 1, text: "@version 1;\nname { color: red; }\n" },
				},
			},
		} as unknown as ResumeData;
		const { set } = createRestoreHarness(currentData, legacyRestoredData);

		const result = await resumeService.versions.restore({
			resumeId: "r1",
			versionId: "v1",
			userId: "u1",
		});

		expect(set).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					metadata: expect.objectContaining({ stylesheet: { mode: "semantic", source } }),
				}),
			}),
		);
		expect(result.data.metadata.stylesheet).toEqual({ mode: "semantic", source });
	});

	it("rejects a currently locked resume before version lookup or snapshots", async () => {
		const callOrder: string[] = [];
		const currentRow = {
			...createResumeRow(createSemanticResumeData()),
			isLocked: true,
		};
		const currentLookup = {
			from: () => ({
				where: () => {
					callOrder.push("getById");
					return Promise.resolve([currentRow]);
				},
			}),
		};
		versionHistoryMock.getVersion.mockImplementation(() => {
			callOrder.push("versionLookup");
			return Promise.resolve({ data: createSemanticResumeData() });
		});
		dbMock.select.mockReturnValue(currentLookup);
		await expect(
			resumeService.versions.restore({
				resumeId: "r1",
				versionId: "v1",
				userId: "u1",
			}),
		).rejects.toMatchObject({ code: "RESUME_LOCKED" });

		expect(callOrder).toEqual(["getById"]);
		expect(versionHistoryMock.writeVersion).not.toHaveBeenCalled();
		expect(dbMock.transaction).not.toHaveBeenCalled();
	});

	it("rejects a renderer-unsafe historical snapshot before snapshots or update", async () => {
		const currentData = createSemanticResumeData();
		const { set, snapshotValues } = createRestoreHarness(currentData, createRendererUnsafeResumeData());
		await expect(
			resumeService.versions.restore({
				resumeId: "r1",
				versionId: "v1",
				userId: "u1",
			}),
		).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", status: 500 });

		expect(snapshotValues).not.toHaveBeenCalled();
		expect(set).not.toHaveBeenCalled();
		expect(dbMock.transaction).not.toHaveBeenCalled();
	});

	it("saves the current state as Before restore first, then marks the restore", async () => {
		const currentData = createSemanticResumeData();
		createRestoreHarness(currentData, createSemanticResumeData());

		await resumeService.versions.restore({ resumeId: "r1", versionId: "v1", userId: "u1" });

		expect(versionHistoryMock.writeVersion.mock.calls.map(([, input]) => input.kind)).toEqual([
			"before-restore",
			"restored",
		]);
		expect(versionHistoryMock.saveSessionVersion).not.toHaveBeenCalled();
	});

	it("normalizes a valid historical snapshot before persistence", async () => {
		const currentData = createSemanticResumeData();
		const restoredData = createOverlappingRendererSafeResumeData();
		const { set } = createRestoreHarness(currentData, restoredData);
		await resumeService.versions.restore({
			resumeId: "r1",
			versionId: "v1",
			userId: "u1",
		});
		expect(set.mock.calls[0]?.[0].data.customSections[0]?.items[0]).toMatchObject({
			content: "<p>Renderer-irrelevant overlap must survive.</p>",
			roles: [],
			website: { url: "", label: "", inlineLink: false },
		});
	});
});

describe("update", () => {
	it.each([false, true])(
		"persists showDownloadButtons=%s without changing resume content",
		async (showDownloadButtons) => {
			const row = { ...createResumeRow(defaultResumeData), showDownloadButtons };
			const select = createLockedSelectChain([{ data: defaultResumeData, isLocked: false }]);
			const update = createUpdateChain([row]);
			dbMock.transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) =>
				callback({ select: () => select.chain, update: () => update.chain }),
			);

			const result = await resumeService.update({ id: "r1", userId: "u1", showDownloadButtons });

			expect(update.set).toHaveBeenCalledWith({ showDownloadButtons });
			expect(update.returning).toHaveBeenCalledWith(
				expect.objectContaining({ showDownloadButtons: "show_download_buttons" }),
			);
			expect(result.showDownloadButtons).toBe(showDownloadButtons);
			expect(result.data).toEqual(defaultResumeData);
		},
	);

	const updateHarness = (existing: { slug: string }) => {
		const row = { ...createResumeRow(defaultResumeData), slug: existing.slug };
		const select = createLockedSelectChain([{ data: defaultResumeData, isLocked: false, slug: existing.slug }]);
		const update = createUpdateChain([row]);
		const tx = { select: () => select.chain, update: () => update.chain };
		dbMock.transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => callback(tx));
		return { tx, update };
	};

	it("keeps the old address as a redirect when the slug changes", async () => {
		const { tx, update } = updateHarness({ slug: "old-address" });

		await resumeService.update({ id: "r1", userId: "u1", slug: "new-address" });

		expect(recordSlugChangeMock).toHaveBeenCalledWith(tx, {
			userId: "u1",
			resumeId: "r1",
			from: "old-address",
			to: "new-address",
		});
		expect(update.set).toHaveBeenCalledWith({ slug: "new-address" });
	});

	it("rejects a new slug outside the pattern, but accepts an unchanged legacy one", async () => {
		updateHarness({ slug: "Legacy_Slug" });
		await expect(resumeService.update({ id: "r1", userId: "u1", slug: "Not Valid" })).rejects.toMatchObject({
			code: "INVALID_SLUG",
			status: 400,
		});

		const { update } = updateHarness({ slug: "Legacy_Slug" });
		await resumeService.update({ id: "r1", userId: "u1", name: "Renamed", slug: "Legacy_Slug" });
		// A name typed by hand also ends automatic naming.
		expect(update.set).toHaveBeenCalledWith({ name: "Renamed", autoName: false, slug: "Legacy_Slug" });
		expect(recordSlugChangeMock).not.toHaveBeenCalled();
	});

	it("names a blank resume after its headline until someone renames it", async () => {
		const data = structuredClone(defaultResumeData);
		data.basics.headline = "  Product Designer ";
		const select = createLockedSelectChain([{ data: defaultResumeData, isLocked: false, slug: "s", autoName: true }]);
		const update = createUpdateChain([{ ...createResumeRow(data), name: "Product Designer" }]);
		dbMock.transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) =>
			callback({ select: () => select.chain, update: () => update.chain }),
		);

		await resumeService.update({ id: "r1", userId: "u1", data });

		expect(update.set).toHaveBeenCalledWith(expect.objectContaining({ name: "Product Designer" }));
	});

	it("passes the editing session to the autosave version, and skips it for restores", async () => {
		updateHarness({ slug: "s" });
		await resumeService.update({ id: "r1", userId: "u1", data: defaultResumeData, sessionId: "visit-1" });
		expect(versionHistoryMock.saveSessionVersion).toHaveBeenCalledWith(
			expect.objectContaining({ resumeId: "r1", userId: "u1", sessionId: "visit-1" }),
		);

		versionHistoryMock.saveSessionVersion.mockClear();
		updateHarness({ slug: "s" });
		await resumeService.update({ id: "r1", userId: "u1", data: defaultResumeData, skipAutoSnapshot: true });
		expect(versionHistoryMock.saveSessionVersion).not.toHaveBeenCalled();
	});

	it("throws RESUME_LOCKED when the pre-read reports the resume is locked", async () => {
		const select = createLockedSelectChain([{ data: defaultResumeData, isLocked: true, updatedAt: new Date() }]);
		dbMock.transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) =>
			callback({ select: () => select.chain }),
		);

		await expect(resumeService.update({ id: "r1", userId: "u1", name: "New" })).rejects.toMatchObject({
			code: "RESUME_LOCKED",
		});
		expect(select.forUpdate).toHaveBeenCalledWith("update");
	});

	it("updates and returns the ordinary row inside one locked transaction", async () => {
		const row = {
			id: "r1",
			name: "New",
			slug: "slug",
			tags: [],
			data: {},
			isPublic: false,
			isLocked: false,
			updatedAt: new Date("2026-01-01T00:00:00Z"),
			hasPassword: false,
		};
		const select = createLockedSelectChain([{ data: defaultResumeData, isLocked: false, updatedAt: row.updatedAt }]);
		const update = createUpdateChain([row]);
		dbMock.transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) =>
			callback({ select: () => select.chain, update: () => update.chain }),
		);

		const result = await resumeService.update({ id: "r1", userId: "u1", name: "New" });

		expect(result).toEqual(row);
		expect(dbMock.transaction).toHaveBeenCalledTimes(1);
		expect(select.forUpdate).toHaveBeenCalledWith("update");
		expect(publishResumeUpdatedMock).toHaveBeenCalledTimes(1);
	});

	it("throws NOT_FOUND when the UPDATE ... RETURNING matches no row", async () => {
		const select = createLockedSelectChain([{ data: defaultResumeData, isLocked: false, updatedAt: new Date() }]);
		dbMock.transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) =>
			callback({ select: () => select.chain, update: () => createUpdateChain([]).chain }),
		);

		await expect(resumeService.update({ id: "r1", userId: "u1", name: "New" })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
	});

	it("maps a resume_slug_user_id_unique violation to RESUME_SLUG_ALREADY_EXISTS", async () => {
		const select = createLockedSelectChain([{ data: defaultResumeData, isLocked: false, updatedAt: new Date() }]);
		const update = {
			set: () => ({
				where: () => ({
					returning: () => {
						const error = new Error("duplicate key") as Error & { cause: { constraint: string } };
						error.cause = { constraint: "resume_slug_user_id_unique" };
						return Promise.reject(error);
					},
				}),
			}),
		};
		dbMock.transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) =>
			callback({ select: () => select.chain, update: () => update }),
		);

		await expect(resumeService.update({ id: "r1", userId: "u1", slug: "taken" })).rejects.toMatchObject({
			code: "RESUME_SLUG_ALREADY_EXISTS",
		});
	});

	it("persists the stylesheet supplied through the ordinary update path", async () => {
		const serverData = createSemanticResumeData();
		const clientData = createSemanticResumeData();
		if (clientData.metadata.stylesheet) {
			clientData.metadata.stylesheet.source.text = "@version 1;\nname { color: blue; }\n";
		}
		const row = createResumeRow(clientData);
		const select = createLockedSelectChain([{ data: serverData, isLocked: false, updatedAt: row.updatedAt }]);
		const update = createUpdateChain([row]);
		dbMock.transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) =>
			callback({ select: () => select.chain, update: () => update.chain }),
		);

		await resumeService.update({ id: "r1", userId: "u1", data: clientData, skipAutoSnapshot: true });

		expect(update.set).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					metadata: expect.objectContaining({ stylesheet: clientData.metadata.stylesheet }),
				}),
			}),
		);
	});

	it("rejects out-of-range PUT data before any update or notification", async () => {
		const data = structuredClone(defaultResumeData);
		data.metadata.typography.body.fontSize = 999;
		const select = createLockedSelectChain([{ data: defaultResumeData, isLocked: false }]);
		const update = createUpdateChain([createResumeRow(defaultResumeData)]);
		dbMock.transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) =>
			callback({ select: () => select.chain, update: () => update.chain }),
		);
		await expect(resumeService.update({ id: "r1", userId: "u1", data, skipAutoSnapshot: true })).rejects.toMatchObject({
			code: "BAD_REQUEST",
			status: 400,
		});
		expect(update.set).not.toHaveBeenCalled();
		expect(publishResumeUpdatedMock).not.toHaveBeenCalled();
	});

	it("rejects renderer-unsafe data before updating the JSONB column", async () => {
		const select = createLockedSelectChain([{ data: defaultResumeData, isLocked: false, updatedAt: new Date() }]);
		const update = createUpdateChain([createResumeRow(defaultResumeData)]);
		dbMock.transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) =>
			callback({ select: () => select.chain, update: () => update.chain }),
		);

		await expect(
			resumeService.update({
				id: "r1",
				userId: "u1",
				data: createRendererUnsafeResumeData(),
				skipAutoSnapshot: true,
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST", status: 400 });

		expect(update.set).not.toHaveBeenCalled();
		expect(publishResumeUpdatedMock).not.toHaveBeenCalled();
	});

	it("persists normalized renderer-safe overlapping data", async () => {
		const clientData = createOverlappingRendererSafeResumeData();
		const select = createLockedSelectChain([{ data: defaultResumeData, isLocked: false, updatedAt: new Date() }]);
		const update = createUpdateChain([createResumeRow(clientData)]);
		dbMock.transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) =>
			callback({ select: () => select.chain, update: () => update.chain }),
		);

		await resumeService.update({ id: "r1", userId: "u1", data: clientData, skipAutoSnapshot: true });

		expect(update.set).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					customSections: [
						expect.objectContaining({
							items: [
								expect.objectContaining({
									content: "<p>Renderer-irrelevant overlap must survive.</p>",
									roles: [],
									website: { url: "", label: "", inlineLink: false },
								}),
							],
						}),
					],
				}),
			}),
		);
	});
});

describe("patch", () => {
	const styleRule = {
		id: "rule",
		label: "Rule",
		enabled: true,
		target: { scope: "global" as const },
		slots: { heading: { color: "#000000" } },
	};

	const createPatchTx = (existing: { data: ResumeData; isLocked: boolean; updatedAt: Date }) => {
		const lockedSelect = createLockedSelectChain([existing]);
		const row = createResumeRow(existing.data, existing.updatedAt);
		const update = createUpdateChain([row]);
		update.returning.mockImplementation(() => {
			const written = update.set.mock.calls.at(-1)?.[0] as { data: ResumeData };
			return Promise.resolve([{ ...row, data: written.data }]);
		});
		const versionSelect = {
			from: () => ({ where: () => ({ orderBy: () => ({ limit: () => [] }) }) }),
		};
		const tx = {
			select: vi.fn().mockReturnValueOnce(lockedSelect.chain).mockReturnValueOnce(versionSelect),
			update: vi.fn(() => update.chain),
			insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
			delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
		};

		return { tx, update };
	};

	it.each([
		["/metadata/template", "unknown-template"],
		["/metadata/page/format", "a3"],
		["/metadata/page/marginX", 500],
		["/metadata/typography/body/fontSize", 999],
	] as const)("rejects an invalid patch at %s atomically", async (path, value) => {
		const data = structuredClone(defaultResumeData);
		data.metadata.template = "chikorita";
		data.metadata.page.marginX = 40;
		const before = structuredClone(data);
		const { tx, update } = createPatchTx({ data, isLocked: false, updatedAt: new Date() });
		await expect(
			resumeService.patchInTransaction(tx as never, {
				id: "r1",
				userId: "u1",
				operations: [
					{ op: "replace", path: "/basics/name", value: "Must not persist" },
					{ op: "replace", path, value },
				],
			}),
		).rejects.toMatchObject({ code: "INVALID_PATCH_OPERATIONS", status: 400 });
		expect(update.set).not.toHaveBeenCalled();
		expect(tx.insert).not.toHaveBeenCalled();
		expect(data).toEqual(before);
	});

	it("normalizes stored legacy data before validating newly submitted patch values", async () => {
		const data = structuredClone(defaultResumeData);
		data.metadata.page.marginX = 500;
		const { tx, update } = createPatchTx({ data, isLocked: false, updatedAt: new Date() });
		await resumeService.patchInTransaction(tx as never, {
			id: "r1",
			userId: "u1",
			operations: [{ op: "replace", path: "/basics/name", value: "Ada" }],
		});
		expect(update.set).toHaveBeenCalledWith({
			data: expect.objectContaining({
				basics: expect.objectContaining({ name: "Ada" }),
				metadata: expect.objectContaining({ page: expect.objectContaining({ marginX: 14 }) }),
			}),
		});
	});

	it("persists stylesheet source through the ordinary patch path", async () => {
		const data = createSemanticResumeData();
		const { tx, update } = createPatchTx({
			data,
			isLocked: false,
			updatedAt: new Date(),
		});

		await resumeService.patchInTransaction(tx as never, {
			id: "r1",
			userId: "u1",
			operations: [
				{
					op: "replace",
					path: "/metadata/stylesheet/source/text",
					value: "@version 1;\nname { color: blue; }\n",
				},
			],
		});

		expect(update.set).toHaveBeenCalledWith({
			data: expect.objectContaining({
				metadata: expect.objectContaining({
					stylesheet: {
						mode: "semantic",
						source: { languageVersion: 1, text: "@version 1;\nname { color: blue; }\n" },
					},
				}),
			}),
		});
	});

	it.each([
		{
			name: "path",
			operation: { op: "add" as const, path: "/metadata/~2stylesheet", value: "invalid escape" },
		},
		{
			name: "from",
			operation: {
				op: "copy" as const,
				from: "/metadata/notes~",
				path: "/metadata/notes",
			},
		},
	])("rejects malformed JSON Pointer escapes in $name before applying", async ({ operation }) => {
		const data = createSemanticResumeData();
		const { tx, update } = createPatchTx({
			data,
			isLocked: false,
			updatedAt: new Date(),
		});

		const error = await resumeService
			.patchInTransaction(tx as never, {
				id: "r1",
				userId: "u1",
				operations: [operation],
			})
			.catch((caught: unknown) => caught);

		expect(error).toMatchObject({
			code: "INVALID_PATCH_OPERATIONS",
			message: expect.stringContaining("valid JSON Pointer"),
		});
		expect((error as { data: unknown }).data).toEqual({ index: 0, operation });
		expect(update.set).not.toHaveBeenCalled();
	});

	it("persists legacy style-rule changes through the ordinary patch path", async () => {
		const data = createSemanticResumeData();
		const { tx, update } = createPatchTx({
			data,
			isLocked: false,
			updatedAt: new Date(),
		});

		await resumeService.patchInTransaction(tx as never, {
			id: "r1",
			userId: "u1",
			operations: [{ op: "add", path: "/metadata/styleRules/-", value: styleRule }],
		});
		expect(update.set).toHaveBeenCalledWith({
			data: expect.objectContaining({ metadata: expect.objectContaining({ styleRules: [styleRule] }) }),
		});
	});

	it("allows a harmless sibling operation below metadata while preserving the server stylesheet", async () => {
		const data = createSemanticResumeData();
		const { tx, update } = createPatchTx({
			data,
			isLocked: false,
			updatedAt: new Date(),
		});

		await resumeService.patchInTransaction(tx as never, {
			id: "r1",
			userId: "u1",
			operations: [{ op: "replace", path: "/metadata/notes", value: "private note" }],
		});

		expect(update.set).toHaveBeenCalledWith({
			data: expect.objectContaining({
				metadata: expect.objectContaining({
					notes: "private note",
					stylesheet: data.metadata.stylesheet,
				}),
			}),
		});
	});
});

describe("setLocked", () => {
	it("resolves and notifies on success (mutation: lock)", async () => {
		dbMock.update.mockReturnValueOnce(
			createUpdateChain([{ id: "r1", updatedAt: new Date("2026-01-01T00:00:00Z") }]).chain,
		);

		await expect(resumeService.setLocked({ id: "r1", userId: "u1", isLocked: true })).resolves.toBeUndefined();

		expect(publishResumeUpdatedMock).toHaveBeenCalledTimes(1);
		expect(publishResumeUpdatedMock).toHaveBeenCalledWith(expect.objectContaining({ mutation: "lock" }));
	});

	// Plan 003: no matching row now rejects with NOT_FOUND (previously a silent resolve).
	it("throws NOT_FOUND when no row matches, without notifying", async () => {
		dbMock.update.mockReturnValueOnce(createUpdateChain([]).chain);

		await expect(resumeService.setLocked({ id: "r1", userId: "u1", isLocked: true })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		expect(publishResumeUpdatedMock).not.toHaveBeenCalled();
	});
});

describe("setPassword", () => {
	it("hashes the password then resolves and notifies on success (mutation: password)", async () => {
		dbMock.update.mockReturnValueOnce(
			createUpdateChain([{ id: "r1", updatedAt: new Date("2026-01-01T00:00:00Z") }]).chain,
		);

		await expect(resumeService.setPassword({ id: "r1", userId: "u1", password: "secret" })).resolves.toBeUndefined();

		expect(hashMock).toHaveBeenCalledWith("secret", 10);
		expect(publishResumeUpdatedMock).toHaveBeenCalledTimes(1);
		expect(publishResumeUpdatedMock).toHaveBeenCalledWith(expect.objectContaining({ mutation: "password" }));
	});

	// Plan 003: no matching row now rejects with NOT_FOUND (previously a silent resolve).
	it("throws NOT_FOUND when no row matches, without notifying", async () => {
		dbMock.update.mockReturnValueOnce(createUpdateChain([]).chain);

		await expect(resumeService.setPassword({ id: "r1", userId: "u1", password: "secret" })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		expect(publishResumeUpdatedMock).not.toHaveBeenCalled();
	});
});

describe("removePassword", () => {
	it("resolves and notifies on success (mutation: password)", async () => {
		dbMock.update.mockReturnValueOnce(
			createUpdateChain([{ id: "r1", updatedAt: new Date("2026-01-01T00:00:00Z") }]).chain,
		);

		await expect(resumeService.removePassword({ id: "r1", userId: "u1" })).resolves.toBeUndefined();

		expect(publishResumeUpdatedMock).toHaveBeenCalledTimes(1);
		expect(publishResumeUpdatedMock).toHaveBeenCalledWith(expect.objectContaining({ mutation: "password" }));
	});

	// Plan 003: no matching row now rejects with NOT_FOUND (previously a silent resolve).
	it("throws NOT_FOUND when no row matches, without notifying", async () => {
		dbMock.update.mockReturnValueOnce(createUpdateChain([]).chain);

		await expect(resumeService.removePassword({ id: "r1", userId: "u1" })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		expect(publishResumeUpdatedMock).not.toHaveBeenCalled();
	});
});

describe("verifyPassword", () => {
	it("throws INVALID_PASSWORD when no matching row is found", async () => {
		dbMock.select.mockReturnValueOnce(slugLookup([]));

		await expect(resumeService.verifyPassword({ slug: "s", username: "u", password: "p" })).rejects.toMatchObject({
			code: "INVALID_PASSWORD",
		});
	});

	it("throws INVALID_PASSWORD when bcrypt.compare returns false", async () => {
		dbMock.select.mockReturnValueOnce(slugLookup([{ id: "r1", password: "hash" }]));
		compareMock.mockResolvedValueOnce(false);

		await expect(resumeService.verifyPassword({ slug: "s", username: "u", password: "p" })).rejects.toMatchObject({
			code: "INVALID_PASSWORD",
		});
	});

	it("returns true and grants access when bcrypt.compare returns true", async () => {
		dbMock.select.mockReturnValueOnce(slugLookup([{ id: "r1", password: "hash" }]));
		compareMock.mockResolvedValueOnce(true);
		const responseHeaders = new Headers();

		const result = await resumeService.verifyPassword({
			slug: "s",
			username: "u",
			password: "p",
			responseHeaders,
		});

		expect(result).toBe(true);
		expect(grantResumeAccessMock).toHaveBeenCalledWith(responseHeaders, "r1", "hash");
	});
});

describe("delete", () => {
	const runTransaction = (tx: unknown) => {
		dbMock.transaction.mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));
	};

	it("throws NOT_FOUND when the row is missing", async () => {
		runTransaction({
			select: () => createSelectChain([]),
		});

		await expect(resumeService.delete({ id: "r1", userId: "u1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("throws RESUME_LOCKED when the row is locked", async () => {
		runTransaction({
			select: () => createSelectChain([{ isLocked: true }]),
		});

		await expect(resumeService.delete({ id: "r1", userId: "u1" })).rejects.toMatchObject({
			code: "RESUME_LOCKED",
		});
	});

	it("deletes storage for screenshot and pdf keys on success", async () => {
		const deleteWhere = vi.fn(() => Promise.resolve());
		runTransaction({
			select: () => createSelectChain([{ isLocked: false }]),
			delete: () => ({ where: deleteWhere }),
		});

		await resumeService.delete({ id: "r1", userId: "u1" });

		expect(deleteWhere).toHaveBeenCalledTimes(1);
		expect(storageDeleteMock).toHaveBeenCalledWith("uploads/u1/screenshots/r1");
		expect(storageDeleteMock).toHaveBeenCalledWith("uploads/u1/pdfs/r1");
		expect(publishResumeUpdatedMock).toHaveBeenCalledWith(expect.objectContaining({ mutation: "delete" }));
	});
});

describe("statistics.increment", () => {
	it("writes both resumeStatistics and resumeStatisticsDaily inside one transaction", async () => {
		const values = vi.fn(() => ({ onConflictDoUpdate: vi.fn(() => Promise.resolve()) }));
		const txInsert = vi.fn(() => ({ values }));
		dbMock.transaction.mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) =>
			cb({ insert: txInsert }),
		);

		await resumeService.statistics.increment({ id: "r1", views: true });

		expect(dbMock.transaction).toHaveBeenCalledTimes(1);
		expect(txInsert).toHaveBeenCalledTimes(2);
	});
});

describe("sharing preferences", () => {
	it("returns the saved preference when the owner reloads the builder", async () => {
		const row = { ...createResumeRow(defaultResumeData), showDownloadButtons: false };
		dbMock.select.mockReturnValue(createSelectChain([row]));
		const result = await resumeService.getById({ id: "r1", userId: "u1" });
		expect(dbMock.select).toHaveBeenCalledWith(
			expect.objectContaining({ showDownloadButtons: "show_download_buttons" }),
		);
		expect(result.showDownloadButtons).toBe(false);
	});

	it.each([false, true])("returns saved showDownloadButtons=%s to public viewers", async (showDownloadButtons) => {
		const row = {
			...createResumeRow(defaultResumeData),
			userId: "u1",
			isPublic: true,
			showDownloadButtons,
			passwordHash: null,
		};
		dbMock.select.mockReturnValue(slugLookup([row]));
		const increment = vi.spyOn(resumeService.statistics, "increment").mockResolvedValue();
		try {
			const result = await resumeService.getBySlug({
				username: "owner",
				slug: "resume",
				requestHeaders: new Headers(),
			});
			expect(dbMock.select).toHaveBeenCalledWith(
				expect.objectContaining({ showDownloadButtons: "show_download_buttons" }),
			);
			expect(result.showDownloadButtons).toBe(showDownloadButtons);
		} finally {
			increment.mockRestore();
		}
	});
});

describe("statistics.recordDownload", () => {
	const input = { username: "owner", slug: "resume", requestHeaders: new Headers() };
	const publicResume = { id: "r1", userId: "u1", isPublic: true, passwordHash: null };
	const selectResume = (rows: unknown[]) =>
		dbMock.select.mockReturnValueOnce({
			from: () => ({ innerJoin: () => ({ where: () => Promise.resolve(rows) }) }),
		});
	const captureWrites = () => {
		const values = vi.fn((_input: unknown) => ({ onConflictDoUpdate: vi.fn(async () => undefined) }));
		dbMock.transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) =>
			callback({ insert: () => ({ values }) }),
		);
		return values;
	};

	it.each([undefined, "another-user"])(
		"counts a public visitor (%s) in totals and daily downloads without adding views",
		async (currentUserId) => {
			selectResume([publicResume]);
			const values = captureWrites();
			await resumeService.statistics.recordDownload({ ...input, ...(currentUserId ? { currentUserId } : {}) });
			expect(values).toHaveBeenCalledTimes(2);
			expect(values.mock.calls[0]?.[0]).toMatchObject({ resumeId: "r1", views: 0, downloads: 1 });
			expect(values.mock.calls[0]?.[0]).toHaveProperty("lastDownloadedAt");
			expect(values.mock.calls[0]?.[0]).toHaveProperty("lastViewedAt", undefined);
			expect(values.mock.calls[1]?.[0]).toMatchObject({
				resumeId: "r1",
				views: 0,
				downloads: 1,
				date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
			});
		},
	);

	it("does not count the owner's own download", async () => {
		selectResume([publicResume]);
		await resumeService.statistics.recordDownload({ ...input, currentUserId: "u1" });
		expect(dbMock.transaction).not.toHaveBeenCalled();
	});

	it.each([{ rows: [] }, { rows: [{ ...publicResume, isPublic: false }] }])(
		"rejects unavailable resumes without recording a download",
		async ({ rows }) => {
			selectResume(rows);
			await expect(resumeService.statistics.recordDownload(input)).rejects.toMatchObject({ code: "NOT_FOUND" });
			expect(dbMock.transaction).not.toHaveBeenCalled();
		},
	);

	it("requires current password access before recording a download", async () => {
		selectResume([{ ...publicResume, passwordHash: "hash" }]);
		hasResumeAccessMock.mockReturnValueOnce(false);
		await expect(resumeService.statistics.recordDownload(input)).rejects.toMatchObject({ code: "NEED_PASSWORD" });
		expect(hasResumeAccessMock).toHaveBeenCalledWith(input.requestHeaders, "r1", "hash");
		expect(dbMock.transaction).not.toHaveBeenCalled();
	});

	it("records a visitor with valid password access", async () => {
		selectResume([{ ...publicResume, passwordHash: "hash" }]);
		hasResumeAccessMock.mockReturnValueOnce(true);
		const values = captureWrites();
		await resumeService.statistics.recordDownload(input);
		expect(values).toHaveBeenCalledTimes(2);
	});
});

describe("root public-only lookup", () => {
	it("rejects a private target even for its owner after identity resolution", async () => {
		const row = {
			...createResumeRow(defaultResumeData),
			userId: "u1",
			isPublic: false,
			hasPassword: false,
			passwordHash: null,
		};
		dbMock.select.mockReturnValue(slugLookup([row]));
		await expect(
			resumeService.getBySlug({
				username: "owner",
				slug: "resume",
				requestHeaders: new Headers(),
				currentUserId: "u1",
				requirePublic: true,
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});

it("rejects a different resume reusing the resolved root slug", async () => {
	const row = {
		...createResumeRow(defaultResumeData),
		id: "replacement-id",
		userId: "u1",
		isPublic: true,
		hasPassword: false,
		passwordHash: null,
	};
	dbMock.select.mockReturnValue(slugLookup([row]));
	await expect(
		resumeService.getBySlug({
			username: "owner",
			slug: "resume",
			requestHeaders: new Headers(),
			currentUserId: "u1",
			requirePublic: true,
			expectedResumeId: "configured-id",
		}),
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});
