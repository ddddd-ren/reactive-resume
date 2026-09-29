import { describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({
	api: {
		getSession: vi.fn(),
		verifyApiKey: vi.fn(),
	},
}));
const verifyOAuthTokenMock = vi.hoisted(() => vi.fn());

const dbMock = vi.hoisted(() => ({
	select: vi.fn(),
}));

vi.mock("@reactive-resume/auth/config", () => ({
	auth: authMock,
	verifyOAuthToken: verifyOAuthTokenMock,
}));
vi.mock("@reactive-resume/db/client", () => ({ db: dbMock }));
vi.mock("@reactive-resume/db/schema", () => ({ user: { __table: "user" } }));
vi.mock("drizzle-orm", () => ({ eq: () => "EQ" }));

const { resolveUserFromRequestHeaders } = await import("./context");

const setupDbResolves = (userResult: unknown) => {
	dbMock.select.mockReturnValueOnce({
		from: () => ({
			where: () => ({
				limit: () => Promise.resolve(userResult ? [userResult] : []),
			}),
		}),
	});
};

const reset = () => {
	authMock.api.getSession.mockReset();
	authMock.api.verifyApiKey.mockReset();
	verifyOAuthTokenMock.mockReset();
	dbMock.select.mockReset();
};

describe("resolveUserFromRequestHeaders", () => {
	it("returns the user resolved from a valid x-api-key", async () => {
		reset();
		authMock.api.verifyApiKey.mockResolvedValueOnce({ valid: true, key: { referenceId: "user-1" } });
		setupDbResolves({ id: "user-1", name: "Alice" });

		const headers = new Headers({ "x-api-key": "abc123" });
		const user = await resolveUserFromRequestHeaders(headers);

		expect(authMock.api.verifyApiKey).toHaveBeenCalledWith({ body: { key: "abc123" } });
		expect(user).toMatchObject({ id: "user-1", name: "Alice" });
	});

	it("uses Bearer token when present and no api key", async () => {
		reset();
		verifyOAuthTokenMock.mockResolvedValueOnce({ sub: "user-bearer" });
		setupDbResolves({ id: "user-bearer", name: "Bob" });

		const headers = new Headers({ authorization: "Bearer xxx.yyy.zzz" });
		const user = await resolveUserFromRequestHeaders(headers);

		expect(verifyOAuthTokenMock).toHaveBeenCalledWith("xxx.yyy.zzz");
		expect(user).toMatchObject({ id: "user-bearer", name: "Bob" });
	});
});
