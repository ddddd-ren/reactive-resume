/**
 * Renders the landing page to HTML, one file per locale, at build time (see `prerenderHomepage` in vite.config.ts).
 * The server sends the file for the visitor's locale, so every heading and paragraph is in the first response and the
 * hero paints before any JavaScript runs; React renders the live page in its place once the route has loaded.
 */
import type { Locale } from "@reactive-resume/utils/locale";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRouter, RouterContextProvider } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { isRTL, localeSchema } from "@reactive-resume/utils/locale";
import { ThemeProvider } from "@/features/theme/provider";
import { getLocaleMessages } from "@/libs/locale";
import { getHomepageMeta } from "@/libs/seo";
import { Homepage } from "./page";

export const locales = localeSchema.options;

export async function renderHomepage(locale: Locale) {
	const { messages } = await getLocaleMessages(locale);
	i18n.loadAndActivate({ locale, messages });

	// Links only need a router to build their hrefs; nothing is loaded or navigated.
	const router = createRouter({
		routeTree: createRootRoute(),
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});
	const dir = isRTL(locale) ? "rtl" : "ltr";

	const html = renderToString(
		<RouterContextProvider router={router}>
			<QueryClientProvider client={new QueryClient()}>
				<I18nProvider i18n={i18n}>
					<ThemeProvider theme="system">
						<DirectionProvider direction={dir}>
							<Homepage />
						</DirectionProvider>
					</ThemeProvider>
				</I18nProvider>
			</QueryClientProvider>
		</RouterContextProvider>,
	);

	return { html, dir, ...getHomepageMeta() };
}
