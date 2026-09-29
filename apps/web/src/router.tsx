import { createRouter } from "@tanstack/react-router";
import { ErrorScreen } from "./components/layout/error-screen";
import { LoadingScreen } from "./components/layout/loading-screen";
import { NotFoundScreen } from "./components/layout/not-found-screen";
import { orpc } from "./libs/orpc/client";
import { getQueryClient } from "./libs/query/client";
import { loadRootContext } from "./libs/root-context";
import { routeTree } from "./routeTree.gen";

export const getRouter = async () => {
	const queryClient = getQueryClient();

	const { theme, locale, session, flags } = await loadRootContext(queryClient);

	const router = createRouter({
		routeTree,
		scrollRestoration: true,
		defaultStructuralSharing: true,
		// Hovering a link starts its loaders; TanStack Query decides freshness, not the router's preload cache.
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		// Past 300ms a navigation shows the loader, held long enough (300ms) for its 200ms fade-in to land.
		defaultPendingMs: 300,
		defaultPendingMinMs: 300,
		defaultErrorComponent: ErrorScreen,
		defaultPendingComponent: LoadingScreen,
		defaultNotFoundComponent: NotFoundScreen,
		context: { orpc, queryClient, theme, locale, session, flags },
	});

	return router;
};
