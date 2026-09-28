import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({ select: vi.fn(), insert: vi.fn(), delete: vi.fn() }));
vi.mock("@reactive-resume/db/client", () => ({ db: dbMock }));

const { checkSlug, pickFreeSlug, recordSlugChange, SLUG_PATTERN } = await import("./slugs");

// `select().from().where()` resolving to `rows`.
const selectRows = (rows: unknown[]) => ({ from: () => ({ where: async () => rows }) });

beforeEach(() => {
	for (const mock of Object.values(dbMock)) mock.mockReset();
});

describe("SLUG_PATTERN", () => {
	it.each(["resume", "resume-2024", "a", "senior-product-designer"])("accepts %s", (slug) => {
		expect(SLUG_PATTERN.test(slug)).toBe(true);
	});

	it.each(["", "Resume", "resume--2024", "-resume", "resume-", "résumé", "my resume", "a_b"])("rejects %j", (slug) => {
		expect(SLUG_PATTERN.test(slug)).toBe(false);
	});
});

describe("pickFreeSlug", () => {
	it("keeps the stem when free, otherwise takes the first free number from 2", () => {
		expect(pickFreeSlug("resume", new Set())).toBe("resume");
		expect(pickFreeSlug("resume", new Set(["resume", "resume-2"]))).toBe("resume-3");
	});
});

describe("checkSlug", () => {
	const check = (slug: string) => checkSlug({ userId: "u1", resumeId: "r1", slug });

	it("explains an invalid slug and suggests a valid one", async () => {
		await expect(check("My Resume")).resolves.toEqual({ status: "invalid", suggestion: "my-resume" });
		expect(dbMock.select).not.toHaveBeenCalled();
	});

	it("reports a free slug, and this resume's own slug, as usable", async () => {
		dbMock.select.mockReturnValueOnce(selectRows([]));
		await expect(check("design")).resolves.toEqual({ status: "available" });

		dbMock.select.mockReturnValueOnce(selectRows([{ id: "r1", name: "This one" }]));
		await expect(check("design")).resolves.toEqual({ status: "current" });
	});

	it("names the resume that uses a taken slug and suggests a free one", async () => {
		dbMock.select
			.mockReturnValueOnce(selectRows([{ id: "r2", name: "Resume 2024" }]))
			.mockReturnValueOnce(selectRows([{ slug: "resume" }, { slug: "resume-2" }]));

		await expect(check("resume")).resolves.toEqual({
			status: "taken",
			takenBy: "Resume 2024",
			suggestion: "resume-3",
		});
	});
});

describe("recordSlugChange", () => {
	it("frees the new address from old redirects and keeps the old one for 30 days", async () => {
		const deleteWhere = vi.fn(async () => undefined);
		dbMock.delete.mockReturnValue({ where: deleteWhere });
		const onConflictDoUpdate = vi.fn(async () => undefined);
		const values = vi.fn((_input: { expiresAt: Date }) => ({ onConflictDoUpdate }));
		dbMock.insert.mockReturnValue({ values });

		await recordSlugChange(dbMock as never, { userId: "u1", resumeId: "r1", from: "old", to: "new" });

		expect(deleteWhere).toHaveBeenCalled();
		expect(values).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", resumeId: "r1", slug: "old" }));
		const expiresIn = (values.mock.calls[0]?.[0].expiresAt.getTime() ?? 0) - Date.now();
		expect(Math.round(expiresIn / (24 * 60 * 60 * 1000))).toBe(30);
		expect(onConflictDoUpdate).toHaveBeenCalled();
	});
});
