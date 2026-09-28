import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createNoindexFollowMeta } from "@/libs/seo";
import { AppShell } from "./-components/app-shell";

export const Route = createFileRoute("/dashboard")({
	component: RouteComponent,
	beforeLoad: ({ context }) => {
		if (!context.session) throw redirect({ to: "/auth/login", replace: true });
		return { session: context.session };
	},
	head: () => ({
		meta: [createNoindexFollowMeta()],
	}),
});

function RouteComponent() {
	return (
		<AppShell>
			<Outlet />
		</AppShell>
	);
}
