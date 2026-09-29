import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { loadRootContext, sessionQueryKey } from "./root-context";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	getFlags: vi.fn(async () => ({ disableSignups: false, disableEmailAuth: false, smtpEnabled: false })),
}));

vi.mock("./auth/session", () => ({ getSession: mocks.getSession }));
vi.mock("./orpc/client", () => ({ client: { flags: { get: mocks.getFlags } } }));
vi.mock("./locale", () => ({ getLocale: () => "en-US", loadLocale: vi.fn(async () => {}) }));

const signedIn = { user: { id: "user-1" }, session: { id: "session-1" } };

describe("loadRootContext", () => {
	beforeEach(() => {
		mocks.getSession.mockReset();
		mocks.getFlags.mockClear();
	});

	it("reuses a signed-in session and the flags across navigations", async () => {
		mocks.getSession.mockResolvedValue(signedIn);
		const queryClient = new QueryClient();

		await loadRootContext(queryClient);
		const second = await loadRootContext(queryClient);

		expect(second.session).toEqual(signedIn);
		expect(mocks.getSession).toHaveBeenCalledTimes(1);
		expect(mocks.getFlags).toHaveBeenCalledTimes(1);
	});

	it("refetches the session after it is invalidated (sign-out)", async () => {
		mocks.getSession.mockResolvedValueOnce(signedIn).mockResolvedValueOnce(null);
		const queryClient = new QueryClient();

		await loadRootContext(queryClient);
		await queryClient.invalidateQueries({ queryKey: sessionQueryKey });
		const after = await loadRootContext(queryClient);

		expect(after.session).toBeNull();
		expect(mocks.getSession).toHaveBeenCalledTimes(2);
		expect(mocks.getFlags).toHaveBeenCalledTimes(1);
	});

	it("never reuses a signed-out result, so a sign-in elsewhere is seen on the next navigation", async () => {
		mocks.getSession.mockResolvedValueOnce(null).mockResolvedValueOnce(signedIn);
		const queryClient = new QueryClient();

		await loadRootContext(queryClient);
		const after = await loadRootContext(queryClient);

		expect(after.session).toEqual(signedIn);
		expect(mocks.getSession).toHaveBeenCalledTimes(2);
	});
});
