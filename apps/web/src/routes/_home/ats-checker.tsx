import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import z from "zod";
import { Spinner } from "@reactive-resume/ui/components/spinner";

const PAGE_TITLE = "ATS Checker - Reactive Resume";
const PAGE_DESCRIPTION =
	"Check whether software can read your resume PDF. Runs entirely in your browser, so your file is never uploaded.";

// The checker pulls in PDF.js and the analysis engine, neither of which the page shell needs.
const AtsChecker = lazy(() =>
	import("@/features/ats-checker/checker").then((module) => ({ default: module.AtsChecker })),
);

export const Route = createFileRoute("/_home/ats-checker")({
	component: RouteComponent,
	// Back from signing up with a checked file to import.
	validateSearch: z.object({ import: z.coerce.boolean().optional().catch(undefined) }),
	head: () => {
		const origin = window.location.origin;
		const canonicalUrl = new URL("/ats-checker", origin).toString();
		const imageUrl = new URL("/opengraph/ats-checker.png", origin).toString();

		return {
			meta: [
				{ title: PAGE_TITLE },
				{ name: "description", content: PAGE_DESCRIPTION },
				{ property: "og:title", content: PAGE_TITLE },
				{ property: "og:description", content: PAGE_DESCRIPTION },
				{ property: "og:url", content: canonicalUrl },
				{ property: "og:type", content: "website" },
				{ property: "og:image", content: imageUrl },
				{ name: "twitter:card", content: "summary_large_image" },
				{ name: "twitter:url", content: canonicalUrl },
				{ name: "twitter:title", content: PAGE_TITLE },
				{ name: "twitter:description", content: PAGE_DESCRIPTION },
				{ name: "twitter:image", content: imageUrl },
			],
			links: [{ rel: "canonical", href: canonicalUrl }],
		};
	},
});

function RouteComponent() {
	const { session } = Route.useRouteContext();
	const { import: importPending } = Route.useSearch();

	return (
		// The marketing header is fixed and 65px tall, so the page makes room for it.
		<main id="main-content" className="min-h-svh bg-bg pt-20">
			<Suspense
				fallback={
					<div className="grid place-items-center py-24">
						<Spinner className="size-5" />
					</div>
				}
			>
				<AtsChecker signedIn={Boolean(session)} importPending={importPending === true} />
			</Suspense>
		</main>
	);
}
