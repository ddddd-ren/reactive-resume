import { t } from "@lingui/core/macro";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

// Settings leave the app sidebar in 6.0; until they're regrouped (M11) the pages sit behind this tab strip.
const PAGES = [
	{ to: "/dashboard/settings/profile", label: () => t`Profile` },
	{ to: "/dashboard/settings/preferences", label: () => t`Preferences` },
	{ to: "/dashboard/settings/authentication", label: () => t`Authentication` },
	{ to: "/dashboard/settings/api-keys", label: () => t`API Keys` },
	{ to: "/dashboard/settings/integrations", label: () => t`Integrations` },
	{ to: "/dashboard/settings/account", label: () => t`Account` },
] as const;

export const Route = createFileRoute("/dashboard/settings")({ component: RouteComponent });

function RouteComponent() {
	return (
		<div className="mx-auto grid w-full max-w-[1180px] content-start gap-5 px-8 py-8 max-sm:px-4 max-sm:py-5">
			<nav aria-label={t`Settings`} className="flex gap-5 overflow-x-auto border-line border-b">
				{PAGES.map((page) => (
					<Link
						key={page.to}
						to={page.to}
						className="flex h-10 shrink-0 items-center font-medium text-ink-2 text-sm hover:text-ink"
						activeProps={{ className: "text-ink shadow-[inset_0_-2px_0_var(--ink)]", "aria-current": "page" }}
					>
						{page.label()}
					</Link>
				))}
			</nav>
			<Outlet />
		</div>
	);
}
