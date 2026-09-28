// @vitest-environment happy-dom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";

const mocks = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock("@/libs/orpc/client", () => ({
	orpc: {
		applications: {
			list: { queryOptions: () => ({ queryKey: ["applications"], queryFn: mocks.list }) },
			tags: { queryOptions: () => ({ queryKey: ["tags"], queryFn: async () => [] }) },
		},
	},
}));
vi.mock("@/features/applications/components/application-detail-sheet", () => ({ ApplicationDetailSheet: () => null }));
vi.mock("@/features/applications/components/application-form-sheet", () => ({ ApplicationFormSheet: () => null }));
vi.mock("@/features/applications/components/add-application-dialog", () => ({ AddApplicationDialog: () => null }));
vi.mock("@/features/applications/components/export-applications-sheet", () => ({
	ExportApplicationsSheet: () => null,
}));
vi.mock("@/features/applications/components/import-applications-sheet", () => ({
	ImportApplicationsSheet: () => null,
}));
vi.mock("@/features/applications/components/board", () => ({ ApplicationBoard: () => null }));
vi.mock("@/features/applications/components/insights-view", () => ({ ApplicationInsights: () => null }));
vi.mock("@/features/applications/components/calendar-view", () => ({ ApplicationCalendar: () => null }));

type ListProps = { applications: { id: string; company: string; status: string }[]; showClosed: boolean };
vi.mock("@/features/applications/components/list-view", () => ({
	ApplicationList: ({ applications, showClosed }: ListProps) => (
		<ul aria-label="Applications">
			{applications
				.filter((application) => showClosed || application.status !== "closed")
				.map((application) => (
					<li key={application.id}>{application.company}</li>
				))}
		</ul>
	),
}));

import { Route } from "./index";

beforeEach(() => {
	vi.restoreAllMocks();
	vi.clearAllMocks();
	i18n.loadAndActivate({ locale: "en-US", messages: {} });
	const base = { tags: [], contacts: [], activity: [], location: null, followUpAt: null, appliedAt: new Date() };
	mocks.list.mockResolvedValue([
		{ ...base, id: "one", company: "Acme", role: "Engineer", status: "applied" },
		{ ...base, id: "two", company: "Example", role: "Designer", status: "saved" },
		{ ...base, id: "closed", company: "Closed company", role: "Engineer", status: "closed" },
	]);
});

async function renderApplications(url: string) {
	const rootRoute = createRootRoute();
	const routeOptions = { ...Route.options, path: "/dashboard/applications/", getParentRoute: () => rootRoute };
	const routeTree = rootRoute.addChildren([Route.update(routeOptions)]);
	const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [url] }) });
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	await router.load();
	render(
		<QueryClientProvider client={queryClient}>
			<I18nProvider i18n={i18n}>
				<RouterProvider router={router} />
			</I18nProvider>
		</QueryClientProvider>,
	);
	await screen.findByPlaceholderText("Search role, company or contact");
	return router;
}

it("clears a URL-seeded search that matches nothing, keeping the view", async () => {
	const router = await renderApplications("/dashboard/applications/?q=no-such-company&view=list&closed=true");
	expect(screen.getByPlaceholderText("Search role, company or contact")).toHaveValue("no-such-company");
	await userEvent.click(await screen.findByRole("button", { name: "Clear search" }));

	expect(screen.getByPlaceholderText("Search role, company or contact")).toHaveValue("");
	expect(await screen.findByText("Acme")).toBeVisible();
	expect(screen.getByText("Closed company")).toBeVisible();
	await waitFor(() => expect(router.state.location.search).toMatchObject({ closed: true }));
});

it("filters typed searches without navigating or refetching, and hides closed applications by default", async () => {
	const router = await renderApplications("/dashboard/applications/");
	const navigate = vi.spyOn(router, "navigate");
	const url = router.history.location.href;
	const input = screen.getByPlaceholderText("Search role, company or contact");

	expect(await screen.findByText("Acme")).toBeVisible();
	expect(screen.queryByText("Closed company")).not.toBeInTheDocument();

	await userEvent.type(input, "acme");
	expect(screen.getByText("Acme")).toBeVisible();
	expect(screen.queryByText("Example")).not.toBeInTheDocument();
	await userEvent.clear(input);
	await userEvent.type(input, "designer");
	expect(screen.getByText("Example")).toBeVisible();
	expect(screen.queryByText("Acme")).not.toBeInTheDocument();
	expect(navigate).not.toHaveBeenCalled();
	expect(router.history.location.href).toBe(url);
	expect(mocks.list).toHaveBeenCalledTimes(1);
});
