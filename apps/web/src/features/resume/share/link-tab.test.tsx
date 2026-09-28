// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { ORPCError } from "@orpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PromptDialogProvider } from "@/hooks/use-prompt";
import { LinkTab } from "./link-tab";

const mocks = vi.hoisted(() => ({
	setPassword: vi.fn(),
	update: vi.fn(),
	checkSlug: vi.fn(),
	patchResume: vi.fn(),
	resume: { id: "resume-id", name: "Resume", slug: "resume", isPublic: true, hasPassword: false, isLocked: false },
}));

vi.mock("@/features/resume/builder/draft", () => ({
	useCurrentResume: () => mocks.resume,
	usePatchResume: () => mocks.patchResume,
}));
vi.mock("@/libs/auth/client", () => ({
	authClient: { useSession: () => ({ data: { user: { username: "owner" } } }) },
}));
vi.mock("@/libs/orpc/client", () => ({
	orpc: {
		resume: {
			setPassword: { mutationOptions: () => ({ mutationFn: mocks.setPassword }) },
			update: { mutationOptions: () => ({ mutationFn: mocks.update }) },
			removePassword: { mutationOptions: () => ({ mutationFn: vi.fn() }) },
			checkSlug: {
				queryOptions: ({ input }: { input: { slug: string } }) => ({
					queryKey: ["checkSlug", input.slug],
					queryFn: () => mocks.checkSlug(input),
				}),
			},
			statistics: {
				getById: { queryOptions: () => ({ queryKey: ["stats"], queryFn: async () => ({ lastViewedAt: null }) }) },
				getDailyById: { queryOptions: () => ({ queryKey: ["daily"], queryFn: async () => [] }) },
			},
		},
	},
}));
vi.mock("@/hooks/use-confirm", () => ({ useConfirm: () => vi.fn() }));
vi.mock("@reactive-resume/ui/components/toast", () => ({ toast: { add: vi.fn(), close: vi.fn() } }));
vi.mock("usehooks-ts", async (importOriginal) => ({
	...(await importOriginal<typeof import("usehooks-ts")>()),
	// The address check waits 300 ms after typing; tests skip the wait.
	useDebounceValue: <T,>(value: T) => [value, vi.fn()],
}));

beforeAll(() => {
	i18n.loadAndActivate({ locale: "en", messages: {} });
});
beforeEach(() => {
	vi.clearAllMocks();
	mocks.setPassword.mockResolvedValue(undefined);
	mocks.update.mockImplementation(async (input: { slug?: string }) => ({ ...mocks.resume, ...input }));
});
afterEach(cleanup);

function renderTab() {
	render(
		<I18nProvider i18n={i18n}>
			<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
				<PromptDialogProvider>
					<LinkTab />
				</PromptDialogProvider>
			</QueryClientProvider>
		</I18nProvider>,
	);
}

async function openDialog() {
	renderTab();
	await act(() => {
		fireEvent.click(screen.getByRole("switch", { name: "Require a password" }));
	});
	return within(screen.queryByRole("dialog") ?? screen.getByRole("alertdialog"));
}

async function submit(dialog: ReturnType<typeof within>, password: string, confirmation = password) {
	fireEvent.change(dialog.getByLabelText("Password", { exact: true }), { target: { value: password } });
	fireEvent.change(dialog.getByLabelText("Confirm Password"), { target: { value: confirmation } });
	await act(() => {
		fireEvent.click(dialog.getByRole("button", { name: "Set Password" }));
	});
}

describe("resume password sharing", () => {
	it.each(["", "abc", "abcde", "x".repeat(65)])(
		"keeps invalid length %j open and explains the range",
		async (password) => {
			const dialog = await openDialog();
			await submit(dialog, password);
			expect(mocks.setPassword).not.toHaveBeenCalled();
			expect(dialog.getByRole("alert").textContent).toContain("6 and 64");
		},
	);

	it("requires matching confirmation", async () => {
		const dialog = await openDialog();
		await submit(dialog, "secret", "typooo");
		expect(mocks.setPassword).not.toHaveBeenCalled();
		expect(dialog.getByRole("alert").textContent).toContain("match");
	});

	it.each(["secret", "x".repeat(64)])("saves valid length and closes only after success", async (password) => {
		const dialog = await openDialog();
		await submit(dialog, password);
		expect(mocks.setPassword).toHaveBeenCalledWith({ id: "resume-id", password }, expect.anything());
		expect(mocks.patchResume).toHaveBeenCalledOnce();
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("preserves values and reports a server failure for retry", async () => {
		mocks.setPassword.mockRejectedValueOnce(
			new ORPCError("INTERNAL_SERVER_ERROR", { message: "Could not save password" }),
		);
		const dialog = await openDialog();
		await submit(dialog, "secret");
		expect(dialog.getByRole("alert").textContent).toBe("Could not save password");
		expect((dialog.getByLabelText("Password", { exact: true }) as HTMLInputElement).value).toBe("secret");
		expect(mocks.patchResume).not.toHaveBeenCalled();
		await act(() => {
			fireEvent.click(dialog.getByRole("button", { name: "Set Password" }));
		});
		expect(mocks.setPassword).toHaveBeenCalledTimes(2);
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("keeps the dialog open and prevents duplicate submission while saving", async () => {
		let resolveSave!: () => void;
		mocks.setPassword.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					resolveSave = resolve;
				}),
		);
		const dialog = await openDialog();
		await submit(dialog, "secret");
		expect(screen.getByRole("dialog")).toBeTruthy();
		expect((dialog.getByRole("button", { name: "Set Password" }) as HTMLButtonElement).disabled).toBe(true);
		const form = dialog.getByLabelText("Password", { exact: true }).closest("form");
		if (!form) throw new Error("Missing password form");
		await act(() => {
			fireEvent.submit(form);
		});
		expect(mocks.setPassword).toHaveBeenCalledOnce();
		expect(mocks.patchResume).not.toHaveBeenCalled();
		await act(() => {
			resolveSave();
		});
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("validates form submission used by Enter", async () => {
		const dialog = await openDialog();
		fireEvent.change(dialog.getByLabelText("Password", { exact: true }), { target: { value: "abc" } });
		const form = dialog.getByLabelText("Password", { exact: true }).closest("form");
		if (!form) throw new Error("Missing password form");
		await act(() => {
			fireEvent.submit(form);
		});
		expect(mocks.setPassword).not.toHaveBeenCalled();
		expect(dialog.getByRole("alert").textContent).toContain("6 and 64");
	});

	it("clears passwords after cancel and reopen", async () => {
		const dialog = await openDialog();
		fireEvent.change(dialog.getByLabelText("Password", { exact: true }), { target: { value: "secret" } });
		await act(() => {
			fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
		});
		// Cancelling leaves the switch off; turning it on again starts over.
		expect(screen.getByRole("switch", { name: "Require a password" })).not.toBeChecked();
		await act(() => {
			fireEvent.click(screen.getByRole("switch", { name: "Require a password" }));
		});
		expect((screen.getByLabelText("Password", { exact: true }) as HTMLInputElement).value).toBe("");
		expect(mocks.setPassword).not.toHaveBeenCalled();
	});
});

describe("the address", () => {
	const address = () => screen.getByRole("textbox", { name: "Address" });
	const type = (value: string) =>
		act(() => {
			fireEvent.change(address(), { target: { value } });
		});

	it("explains the pattern without asking the server", async () => {
		renderTab();
		await type("My Resume!");

		expect(address()).toHaveValue("my-resume!");
		expect(screen.getByText("Use lowercase letters, numbers and single dashes.")).toBeInTheDocument();
		expect(mocks.checkSlug).not.toHaveBeenCalled();
	});

	it("names the resume using a taken address and applies the suggestion", async () => {
		mocks.checkSlug.mockResolvedValueOnce({ status: "taken", takenBy: "Resume 2024", suggestion: "resume-lumen" });
		renderTab();
		await type("taken");

		expect(await screen.findByText("You already use this for “Resume 2024”.")).toBeInTheDocument();
		mocks.checkSlug.mockResolvedValueOnce({ status: "available" });
		await act(() => {
			fireEvent.click(screen.getByRole("button", { name: "Try resume-lumen" }));
		});
		expect(address()).toHaveValue("resume-lumen");
	});

	it("saves a new address once it checks out, keeping the old one until then", async () => {
		mocks.checkSlug.mockResolvedValueOnce({ status: "available" });
		renderTab();
		await type("product-designer");

		await vi.waitFor(() =>
			expect(mocks.update).toHaveBeenCalledWith({ id: "resume-id", slug: "product-designer" }, expect.anything()),
		);
		expect(mocks.patchResume).toHaveBeenCalled();
	});
});
