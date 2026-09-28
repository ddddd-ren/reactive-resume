import type { DocumentsSearch } from "@/features/documents/documents-page";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import z from "zod";
import { DocumentsPage } from "@/features/documents/documents-page";

const defaults = { type: "all", q: "", tags: [], sort: "edited" } satisfies DocumentsSearch;

export const Route = createFileRoute("/dashboard/")({
	validateSearch: z.object({
		type: z.enum(["all", "resume", "letter"]).default("all").catch("all"),
		q: z.string().default("").catch(""),
		tags: z.array(z.string()).default([]).catch([]),
		sort: z.enum(["edited", "name", "created"]).default("edited").catch("edited"),
		// Without one, the page uses the last view picked on this device.
		view: z.enum(["grid", "list"]).optional().catch(undefined),
		letter: z.string().optional().catch(undefined),
	}),
	search: { middlewares: [stripSearchParams(defaults)] },
	component: RouteComponent,
});

function RouteComponent() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	return (
		<DocumentsPage
			search={search}
			onSearchChange={(patch) =>
				void navigate({ search: (previous: DocumentsSearch) => ({ ...previous, ...patch }), replace: true })
			}
		/>
	);
}
