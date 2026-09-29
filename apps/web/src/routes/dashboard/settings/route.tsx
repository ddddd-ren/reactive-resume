import type { IconName } from "@reactive-resume/ui/components/icon";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Icon } from "@reactive-resume/ui/components/icon";
import { popTransition } from "@/features/settings/root";

type Page = {
	to: "/dashboard/settings/account" | "/dashboard/settings/preferences" | "/dashboard/settings/ai";
	icon: IconName;
	label: () => string;
};

// Six pages became three, each with one job (README §5.9).
const SETTINGS_PAGES: Page[] = [
	{ to: "/dashboard/settings/account", icon: "account_circle", label: () => t`Account` },
	{ to: "/dashboard/settings/preferences", icon: "tune", label: () => t`Preferences` },
	{ to: "/dashboard/settings/ai", icon: "hub", label: () => t`AI & developer` },
];

export const Route = createFileRoute("/dashboard/settings")({ component: RouteComponent });

function RouteComponent() {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const isRoot = pathname.replace(/\/$/, "") === "/dashboard/settings";

	return (
		<div className="grid min-h-full content-start lg:grid-cols-[220px_minmax(0,1fr)] lg:content-stretch">
			<nav
				aria-label={t`Settings`}
				className="flex flex-col gap-1 border-line [view-transition-name:settings-nav] max-sm:hidden max-lg:border-b lg:border-e lg:py-7 lg:ps-6 lg:pe-3"
			>
				<h1 className="ms-2 mb-3.5 font-display font-medium text-[26px] leading-8 max-lg:hidden">
					<Trans>Settings</Trans>
				</h1>
				<div className="flex gap-1 max-lg:overflow-x-auto max-lg:px-6 max-lg:py-2 lg:flex-col">
					{SETTINGS_PAGES.map((page) => (
						<Link
							key={page.to}
							to={page.to}
							className="flex h-10 shrink-0 items-center gap-2.5 rounded-lg px-2.5 font-medium text-ink-2 text-sm transition-colors duration-quick hover:bg-hover"
							activeProps={{ className: "bg-sunken text-ink", "aria-current": "page" }}
						>
							<Icon name={page.icon} size={20} />
							{page.label()}
						</Link>
					))}
				</div>
				<p className="mt-auto px-2.5 text-ink-3 text-xs leading-[18px] max-lg:hidden">
					<Trans>Reactive Resume {__APP_VERSION__} · MIT</Trans>
					<br />
					<a className="underline" href="https://docs.rxresu.me" target="_blank" rel="noopener noreferrer">
						<Trans>Docs</Trans>
					</a>
					{" · "}
					<a
						className="underline"
						href="https://github.com/reactive-resume/reactive-resume"
						target="_blank"
						rel="noopener noreferrer"
					>
						<Trans>Source</Trans>
					</a>
					{" · "}
					<a
						className="underline"
						href="https://opencollective.com/reactive-resume/donate"
						target="_blank"
						rel="noopener noreferrer"
					>
						<Trans>Donate</Trans>
					</a>
				</p>
			</nav>

			<div className="min-w-0 px-12 pt-8 pb-16 max-sm:px-4 max-sm:pt-4 max-lg:px-6">
				{!isRoot && (
					<Link
						to="/dashboard/settings"
						viewTransition={popTransition}
						className="mb-4 inline-flex h-9 items-center gap-1 text-ink-2 text-sm sm:hidden"
					>
						<Icon name="chevron_left" size={20} />
						<Trans>Settings</Trans>
					</Link>
				)}
				<div className="grid max-w-[680px] gap-8">
					<Outlet />
				</div>
			</div>
		</div>
	);
}
